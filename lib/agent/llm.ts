import type { AgentTool } from './tools';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
};

export type LlmToolCall = {
  id: string;
  type: 'function';
  name: string;
  arguments: string;
};

export type ChatResult = {
  content: string | null;
  toolCalls: LlmToolCall[];
  error: string | null;
};

export type ChatResponseFormat =
  | { type: 'json_schema'; json_schema: Record<string, unknown> }
  | { type: 'json_object' }
  | { type: 'text' };

export type FetchImplementation = (url: string, init: RequestInit) => Promise<Response>;

export type ChatRequest = {
  messages: ChatMessage[];
  tools?: readonly AgentTool[];
  toolChoice?: 'auto';
  temperature?: number;
  responseFormat?: ChatResponseFormat;
  fetchImpl?: FetchImplementation;
  timeoutMs?: number;
};

type LlmConfig = { baseUrl: string; apiKey: string; model: string };
type HttpFailure = { status: number; body: string };
type Attempt = { result: ChatResult } | { failure: HttpFailure };

const jsonSchemaUnsupported = new Set<string>();
const temperatureUnsupported = new Set<string>();

function empty(error: string): ChatResult {
  return { content: null, toolCalls: [], error };
}

function readConfig(): LlmConfig | null {
  // These variables are intentionally read only at server-call time and have no NEXT_PUBLIC_ prefix.
  const baseUrl = (process.env.OPENAI_BASE_URL ?? '').trim();
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
  const model = (process.env.OPENAI_MODEL ?? '').trim();
  return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

function toWireTool(tool: AgentTool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: true,
    },
  };
}

function toWireMessage(message: ChatMessage) {
  return {
    role: message.role,
    content: message.content,
    ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
  };
}

function parseToolCalls(value: unknown): LlmToolCall[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const toolCalls: LlmToolCall[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const call = entry as Record<string, unknown>;
    const fn = call.function;
    if (call.type !== 'function' || typeof call.id !== 'string' || !fn || typeof fn !== 'object') return null;
    const functionCall = fn as Record<string, unknown>;
    if (typeof functionCall.name !== 'string' || typeof functionCall.arguments !== 'string') return null;
    toolCalls.push({ id: call.id, type: 'function', name: functionCall.name, arguments: functionCall.arguments });
  }
  return toolCalls;
}

function parseResponse(value: unknown): ChatResult {
  if (!value || typeof value !== 'object') return empty('PARSE_ERROR');
  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0 || !choices[0] || typeof choices[0] !== 'object') return empty('PARSE_ERROR');
  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') return empty('PARSE_ERROR');
  const parsed = message as Record<string, unknown>;
  const content = parsed.content;
  if (content !== null && content !== undefined && typeof content !== 'string') return empty('PARSE_ERROR');
  const toolCalls = parseToolCalls(parsed.tool_calls);
  if (!toolCalls) return empty('PARSE_ERROR');
  return { content: typeof content === 'string' ? content : null, toolCalls, error: null };
}

async function requestCompletion(
  config: LlmConfig,
  request: ChatRequest,
  fetchImpl: FetchImplementation,
  useJsonObject: boolean,
  includeTemperature: boolean,
): Promise<Attempt> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000);
  const responseFormat = useJsonObject ? { type: 'json_object' } : request.responseFormat;
  const payload: Record<string, unknown> = {
    model: config.model,
    messages: request.messages.map(toWireMessage),
    tool_choice: request.toolChoice ?? 'auto',
  };
  if (request.tools?.length) payload.tools = request.tools.map(toWireTool);
  if (includeTemperature) payload.temperature = request.temperature ?? 0;
  if (responseFormat) payload.response_format = responseFormat;

  try {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return { failure: { status: response.status, body: await response.text() } };
    try {
      return { result: parseResponse(await response.json()) };
    } catch {
      return { result: empty('PARSE_ERROR') };
    }
  } catch {
    return { result: empty(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR') };
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatCompletion(request: ChatRequest): Promise<ChatResult> {
  const config = readConfig();
  if (!config) return empty('CONFIGURATION_MISSING');
  const fetchImpl = request.fetchImpl ?? ((url, init) => fetch(url, init));
  const capabilityKey = `${config.baseUrl}|${config.model}`;
  let useJsonObject = request.responseFormat?.type === 'json_schema' && jsonSchemaUnsupported.has(capabilityKey);
  let includeTemperature = !temperatureUnsupported.has(capabilityKey);

  const initial = await requestCompletion(config, request, fetchImpl, useJsonObject, includeTemperature);
  if (!('failure' in initial)) return initial.result;
  if (initial.failure.status !== 400) return empty(`HTTP_${initial.failure.status}`);

  if (includeTemperature && /temperature/i.test(initial.failure.body)) {
    temperatureUnsupported.add(capabilityKey);
    includeTemperature = false;
    const retry = await requestCompletion(config, request, fetchImpl, useJsonObject, includeTemperature);
    return 'failure' in retry ? empty(`HTTP_${retry.failure.status}`) : retry.result;
  }

  if (!useJsonObject && request.responseFormat?.type === 'json_schema') {
    jsonSchemaUnsupported.add(capabilityKey);
    useJsonObject = true;
    const retry = await requestCompletion(config, request, fetchImpl, useJsonObject, includeTemperature);
    return 'failure' in retry ? empty(`HTTP_${retry.failure.status}`) : retry.result;
  }

  return empty('HTTP_400');
}
