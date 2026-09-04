import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgent, type AgentLlmRequest, type AgentMessage } from './orchestrator.ts';
import type { AgentTool, ToolResult } from './tools.ts';

const answerJson = JSON.stringify({
  answer: '출고량은 안정적입니다.',
  verdict: 'SAFE',
  evidence: [],
  data_as_of: null,
  risk: 'SAFE',
  recommended_action: null,
  cannot_answer: false,
  cannot_answer_reason: null,
});

function tool(name = 'get_shipment_trend', roles: AgentTool['roles'] = ['USER', 'ADMIN'], run?: AgentTool['run']): AgentTool {
  return {
    name,
    description: '출고량을 조회합니다.',
    parameters: {
      type: 'object',
      properties: { itemCode: { type: 'string' } },
      required: ['itemCode'],
      additionalProperties: false,
    },
    roles,
    run: run ?? (async (): Promise<ToolResult> => ({
      ok: true,
      data: { itemCode: '602K02693', avg3m: 779 },
      numbers: { avg3m: 779 },
      dataAsOf: '2026-09',
      reason: null,
    })),
  };
}

test('keeps assistant tool_calls and matching tool_call_id in message order', async () => {
  const captured: AgentLlmRequest[] = [];
  const shipmentTool = tool();
  const result = await runAgent(
    { question: '602K02693 출고 추이를 알려줘.', user: { id: 'u1', role: 'USER' }, history: [] },
    {
      tools: [shipmentTool],
      chat: async (request) => {
        captured.push(request);
        return captured.length === 1
          ? { content: null, toolCalls: [{ id: 'call_1', type: 'function', name: shipmentTool.name, arguments: '{"itemCode":"602K02693"}' }], error: null }
          : { content: answerJson, toolCalls: [], error: null };
      },
    },
  );

  assert.equal(result.answer.cannot_answer, false);
  assert.equal(captured[0].tools?.length, 1);
  const history = captured[1].messages as AgentMessage[];
  assert.deepEqual(history.map((message) => message.role), ['user', 'assistant', 'tool']);
  assert.deepEqual(history[1].toolCalls, [{ id: 'call_1', type: 'function', name: shipmentTool.name, arguments: '{"itemCode":"602K02693"}' }]);
  assert.equal(history[2].toolCallId, 'call_1');
  assert.deepEqual(result.trace, [{ name: shipmentTool.name, args: { itemCode: '602K02693' }, ok: true, ms: result.trace[0].ms, reason: null }]);
});

test('does not expose or execute a tool disallowed for the user role', async () => {
  let executed = false;
  const adminTool = tool('admin_only', ['ADMIN'], async () => {
    executed = true;
    return { ok: true, data: {}, numbers: {}, dataAsOf: null, reason: null };
  });
  let firstRequest: AgentLlmRequest | null = null;
  const result = await runAgent(
    { question: '관리자 기능을 실행해줘.', user: { id: 'u2', role: 'USER' }, history: [] },
    {
      tools: [adminTool],
      chat: async (request) => {
        firstRequest ??= request;
        return { content: null, toolCalls: [{ id: 'call_admin', type: 'function', name: 'admin_only', arguments: '{"itemCode":"X"}' }], error: null };
      },
    },
  );

  assert.deepEqual((firstRequest as AgentLlmRequest | null)?.tools, []);
  assert.equal(executed, false);
  assert.equal(result.answer.cannot_answer_reason, 'TOOL_FORBIDDEN');
  assert.equal(result.trace[0].reason, 'TOOL_FORBIDDEN');
});

test('does not execute malformed tool arguments', async () => {
  let executed = false;
  const shipmentTool = tool('get_shipment_trend', ['USER'], async () => {
    executed = true;
    return { ok: true, data: {}, numbers: {}, dataAsOf: null, reason: null };
  });
  const result = await runAgent(
    { question: '출고 추이', user: { id: 'u3', role: 'USER' }, history: [] },
    { tools: [shipmentTool], chat: async () => ({ content: null, toolCalls: [{ id: 'bad', type: 'function', name: shipmentTool.name, arguments: '{not-json}' }], error: null }) },
  );

  assert.equal(executed, false);
  assert.equal(result.answer.cannot_answer_reason, 'INVALID_TOOL_ARGUMENTS');
  assert.equal(result.trace[0].args, null);
});

test('stops after six tool rounds instead of following an endless tool loop', async () => {
  let executions = 0;
  const shipmentTool = tool('get_shipment_trend', ['USER'], async () => {
    executions += 1;
    return { ok: true, data: {}, numbers: {}, dataAsOf: null, reason: null };
  });
  const result = await runAgent(
    { question: '계속 조회해줘.', user: { id: 'u4', role: 'USER' }, history: [] },
    { tools: [shipmentTool], chat: async () => ({ content: null, toolCalls: [{ id: `loop_${executions}`, type: 'function', name: shipmentTool.name, arguments: '{"itemCode":"602K02693"}' }], error: null }) },
  );

  assert.equal(executions, 6);
  assert.equal(result.trace.length, 6);
  assert.equal(result.answer.cannot_answer_reason, 'TOOL_LOOP_LIMIT');
});

test('regenerates once when the final answer contains a number absent from ToolResult.numbers', async () => {
  const shipmentTool = tool();
  let calls = 0;
  const result = await runAgent(
    { question: '출고 추이', user: { id: 'u5', role: 'USER' }, history: [] },
    {
      tools: [shipmentTool],
      chat: async () => {
        calls += 1;
        if (calls === 1) return { content: null, toolCalls: [{ id: 'call_guard', type: 'function', name: shipmentTool.name, arguments: '{"itemCode":"602K02693"}' }], error: null };
        if (calls === 2) return { content: answerJson.replace('출고량은 안정적입니다.', '출고량은 780입니다.'), toolCalls: [], error: null };
        return { content: answerJson.replace('출고량은 안정적입니다.', '출고량은 779입니다.'), toolCalls: [], error: null };
      },
    },
  );

  assert.equal(calls, 3);
  assert.equal(result.answer.answer, '출고량은 779입니다.');
  assert.equal(result.answer.cannot_answer, false);
});
