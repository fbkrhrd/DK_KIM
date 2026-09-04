import assert from 'node:assert/strict';
import test from 'node:test';
import { chatCompletion, type ChatMessage } from './llm.ts';

const messages: ChatMessage[] = [{ role: 'user', content: '출고 추이를 알려줘.' }];

async function withLlmEnv<T>(baseUrl: string, model: string, run: () => Promise<T>): Promise<T> {
  const previous = {
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  };
  process.env.OPENAI_BASE_URL = `  ${baseUrl}  `;
  process.env.OPENAI_API_KEY = '  test-secret  ';
  process.env.OPENAI_MODEL = `  ${model}  `;
  try {
    return await run();
  } finally {
    process.env.OPENAI_BASE_URL = previous.baseUrl;
    process.env.OPENAI_API_KEY = previous.apiKey;
    process.env.OPENAI_MODEL = previous.model;
  }
}

test('returns an error instead of throwing when server-only LLM configuration is missing', async () => {
  const previous = {
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  };
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    const result = await chatCompletion({ messages });
    assert.deepEqual(result, { content: null, toolCalls: [], error: 'CONFIGURATION_MISSING' });
  } finally {
    process.env.OPENAI_BASE_URL = previous.baseUrl;
    process.env.OPENAI_API_KEY = previous.apiKey;
    process.env.OPENAI_MODEL = previous.model;
  }
});

test('trims environment values and parses OpenAI-compatible tool_calls', async () => {
  await withLlmEnv('https://llm.example/v1', 'tool-model', async () => {
    let requestBody: Record<string, unknown> | null = null;
    let authorization: string | null = null;
    const result = await chatCompletion({
      messages,
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        authorization = new Headers(init.headers).get('authorization');
        return Response.json({
          choices: [{ message: {
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_shipment_trend', arguments: '{"itemCode":"602K02693"}' } }],
          } }],
        });
      },
    });

    assert.equal(authorization, 'Bearer test-secret');
    assert.equal((requestBody as Record<string, unknown> | null)?.model, 'tool-model');
    assert.deepEqual(result, {
      content: null,
      toolCalls: [{ id: 'call_1', type: 'function', name: 'get_shipment_trend', arguments: '{"itemCode":"602K02693"}' }],
      error: null,
    });
  });
});

test('falls back from json_schema to json_object once and remembers the capability by base URL and model', async () => {
  await withLlmEnv('https://llm.example/v1', 'schema-fallback-model', async () => {
    const bodies: Record<string, unknown>[] = [];
    let calls = 0;
    const fakeFetch = async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      calls += 1;
      return calls === 1
        ? new Response('json_schema is not supported', { status: 400 })
        : Response.json({ choices: [{ message: { content: '{"answer":"ok"}' } }] });
    };
    const responseFormat = { type: 'json_schema' as const, json_schema: { name: 'answer', strict: true, schema: { type: 'object' } } };

    assert.equal((await chatCompletion({ messages, fetchImpl: fakeFetch, responseFormat })).error, null);
    assert.equal((bodies[0].response_format as { type: string }).type, 'json_schema');
    assert.deepEqual(bodies[1].response_format, { type: 'json_object' });

    assert.equal((await chatCompletion({ messages, fetchImpl: fakeFetch, responseFormat })).error, null);
    assert.equal(calls, 3);
    assert.deepEqual(bodies[2].response_format, { type: 'json_object' });
  });
});

test('retries once without temperature when the model rejects temperature and remembers the capability', async () => {
  await withLlmEnv('https://llm.example/v1', 'temperature-fallback-model', async () => {
    const bodies: Record<string, unknown>[] = [];
    let calls = 0;
    const fakeFetch = async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      calls += 1;
      return calls === 1
        ? new Response("'temperature' does not support 0 with this model", { status: 400 })
        : Response.json({ choices: [{ message: { content: 'ok' } }] });
    };

    assert.equal((await chatCompletion({ messages, fetchImpl: fakeFetch })).error, null);
    assert.equal(bodies[0].temperature, 0);
    assert.equal('temperature' in bodies[1], false);

    assert.equal((await chatCompletion({ messages, fetchImpl: fakeFetch })).error, null);
    assert.equal(calls, 3);
    assert.equal('temperature' in bodies[2], false);
  });
});

test('returns TIMEOUT when the injected fetch is aborted', async () => {
  await withLlmEnv('https://llm.example/v1', 'timeout-model', async () => {
    const result = await chatCompletion({
      messages,
      timeoutMs: 1,
      fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    });
    assert.deepEqual(result, { content: null, toolCalls: [], error: 'TIMEOUT' });
  });
});
