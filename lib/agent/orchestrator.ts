import { agentAnswerJsonSchema, cannotAnswer, parseAgentAnswer, type AgentAnswer } from './schema.ts';
import { buildAllowedNumbers, validateAnswerNumbers, type NamedToolResult } from './guardrail.ts';
import { chatCompletion, type ChatRequest, type ChatResult, type ChatMessage, type LlmToolCall } from './llm.ts';
import { agentTools, type AgentRole, type AgentTool, type ToolResult } from './tools.ts';

const MAX_TOOL_ROUNDS = 6;
const TOTAL_TIMEOUT_MS = 60_000;

export type AgentUser = { id: string; role: AgentRole };

export type AgentMessage = ChatMessage & {
  toolCalls?: LlmToolCall[];
};

export type AgentLlmRequest = Omit<ChatRequest, 'messages'> & {
  messages: AgentMessage[];
};

export type AgentTrace = {
  name: string;
  args: Record<string, unknown> | null;
  ok: boolean;
  ms: number;
  reason: string | null;
};

export type AgentRunResult = { answer: AgentAnswer; trace: AgentTrace[] };

export type RunAgentInput = {
  question: string;
  user: AgentUser;
  history: ChatMessage[];
};

export type AgentDependencies = {
  tools?: readonly AgentTool[];
  chat?: (request: AgentLlmRequest) => Promise<ChatResult>;
  now?: () => number;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchesType(value: unknown, expected: string | string[]): boolean {
  const allowed = Array.isArray(expected) ? expected : [expected];
  return allowed.some((type) => (
    (type === 'null' && value === null)
    || (type === 'string' && typeof value === 'string')
    || (type === 'number' && typeof value === 'number' && Number.isFinite(value))
    || (type === 'boolean' && typeof value === 'boolean')
    || (type === 'object' && isRecord(value))
    || (type === 'array' && Array.isArray(value))
  ));
}

function parseToolArguments(call: LlmToolCall, tool: AgentTool): Record<string, unknown> | null {
  try {
    const args = JSON.parse(call.arguments) as unknown;
    if (!isRecord(args)) return null;
    const keys = Object.keys(args);
    if (tool.parameters.additionalProperties === false && keys.some((key) => !(key in tool.parameters.properties))) return null;
    if (tool.parameters.required.some((key) => !(key in args))) return null;
    return Object.entries(tool.parameters.properties).every(([key, schema]) => key in args && matchesType(args[key], schema.type)) ? args : null;
  } catch {
    return null;
  }
}

function allowedTools(tools: readonly AgentTool[], role: AgentRole): AgentTool[] {
  return tools.filter((tool) => tool.roles.includes(role));
}

function toolMessage(result: ToolResult): string {
  return JSON.stringify({ ok: result.ok, data: result.data, numbers: result.numbers, data_as_of: result.dataAsOf, reason: result.reason });
}

async function beforeDeadline<T>(promise: Promise<T>, remainingMs: number): Promise<T | null> {
  if (remainingMs <= 0) return null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), remainingMs); }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function unavailable(trace: AgentTrace[], reason: string): AgentRunResult {
  return { answer: cannotAnswer(reason), trace };
}

export async function runAgent(input: RunAgentInput, dependencies: AgentDependencies = {}): Promise<AgentRunResult> {
  const tools = dependencies.tools ?? agentTools;
  const now = dependencies.now ?? Date.now;
  const deadline = now() + (dependencies.timeoutMs ?? TOTAL_TIMEOUT_MS);
  const chat = dependencies.chat ?? (async (request: AgentLlmRequest) => chatCompletion(request as ChatRequest));
  const messages: AgentMessage[] = [...input.history, { role: 'user', content: input.question }];
  const trace: AgentTrace[] = [];
  const toolResults: NamedToolResult[] = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const remainingMs = deadline - now();
      const completion = await beforeDeadline(chat({
        messages: [...messages],
        tools: allowedTools(tools, input.user.role),
        toolChoice: 'auto',
        temperature: 0,
        responseFormat: { type: 'json_schema', json_schema: agentAnswerJsonSchema },
        timeoutMs: remainingMs,
      }), remainingMs);
      if (!completion) return unavailable(trace, 'AGENT_TIMEOUT');
      if (completion.error) return unavailable(trace, `LLM_${completion.error}`);

      messages.push({ role: 'assistant', content: completion.content, toolCalls: completion.toolCalls });
      if (completion.toolCalls.length === 0) {
        const answer = completion.content === null ? null : parseAgentAnswer(completion.content);
        if (!answer) return unavailable(trace, 'INVALID_AGENT_ANSWER');
        const validation = validateAnswerNumbers(answer, buildAllowedNumbers(toolResults));
        if (validation.ok) return { answer, trace };

        messages.push({
          role: 'user',
          content: `근거 없는 숫자를 제거하거나 Tool 결과 수치로 수정하세요: ${validation.unsupported.map((claim) => claim.raw).join(', ')}.`,
        });
        const regenerated = await beforeDeadline(chat({
          messages: [...messages],
          tools: [],
          toolChoice: 'auto',
          temperature: 0,
          responseFormat: { type: 'json_schema', json_schema: agentAnswerJsonSchema },
          timeoutMs: deadline - now(),
        }), deadline - now());
        if (!regenerated) return unavailable(trace, 'AGENT_TIMEOUT');
        if (regenerated.error || regenerated.toolCalls.length > 0 || regenerated.content === null) return unavailable(trace, 'GUARDRAIL_REGENERATION_FAILED');
        const corrected = parseAgentAnswer(regenerated.content);
        return corrected && validateAnswerNumbers(corrected, buildAllowedNumbers(toolResults)).ok
          ? { answer: corrected, trace }
          : unavailable(trace, 'UNSUPPORTED_NUMBERS');
      }

      for (const call of completion.toolCalls) {
        const startedAt = now();
        const tool = tools.find((candidate) => candidate.name === call.name);
        if (!tool || !tool.roles.includes(input.user.role)) {
          trace.push({ name: call.name, args: null, ok: false, ms: now() - startedAt, reason: 'TOOL_FORBIDDEN' });
          return unavailable(trace, 'TOOL_FORBIDDEN');
        }
        const args = parseToolArguments(call, tool);
        if (!args) {
          trace.push({ name: call.name, args: null, ok: false, ms: now() - startedAt, reason: 'INVALID_TOOL_ARGUMENTS' });
          return unavailable(trace, 'INVALID_TOOL_ARGUMENTS');
        }
        const result = await beforeDeadline(Promise.resolve().then(() => tool.run(args, input.user.role)), deadline - now());
        if (!result) {
          trace.push({ name: call.name, args, ok: false, ms: now() - startedAt, reason: 'AGENT_TIMEOUT' });
          return unavailable(trace, 'AGENT_TIMEOUT');
        }
        trace.push({ name: call.name, args, ok: result.ok, ms: now() - startedAt, reason: result.reason });
        if (!result.ok) return unavailable(trace, result.reason ?? 'TOOL_FAILED');
        toolResults.push({ toolName: call.name, result });
        messages.push({ role: 'tool', content: toolMessage(result), toolCallId: call.id });
      }
    }
    return unavailable(trace, 'TOOL_LOOP_LIMIT');
  } catch {
    return unavailable(trace, 'AGENT_EXECUTION_FAILED');
  }
}
