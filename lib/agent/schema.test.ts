import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentAnswerJsonSchema,
  cannotAnswer,
  parseAgentAnswer,
} from './schema.ts';

test('returns null for malformed JSON', () => {
  assert.equal(parseAgentAnswer('{"answer":'), null);
});

test('returns null when a required answer field is missing', () => {
  assert.equal(parseAgentAnswer(JSON.stringify({
    answer: '재고가 부족합니다.',
    verdict: 'CRITICAL',
    evidence: [],
    data_as_of: '2026-09-04',
    risk: 'CRITICAL',
    recommended_action: '즉시 발주',
    cannot_answer: false,
  })), null);
});

test('accepts a calculation-unavailable answer without replacing it with a number', () => {
  const result = parseAgentAnswer(JSON.stringify(cannotAnswer('NO_FORECAST')));

  assert.deepEqual(result, {
    answer: '답변할 수 없습니다.',
    verdict: null,
    evidence: [],
    data_as_of: null,
    risk: 'CALCULATION_UNAVAILABLE',
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: 'NO_FORECAST',
  });
});

test('defines a strict Structured Outputs schema for every object', () => {
  const schema = agentAnswerJsonSchema.schema;
  const evidence = schema.properties.evidence.items;

  assert.equal(agentAnswerJsonSchema.strict, true);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    'answer',
    'verdict',
    'evidence',
    'data_as_of',
    'risk',
    'recommended_action',
    'cannot_answer',
    'cannot_answer_reason',
  ]);
  assert.equal(evidence.additionalProperties, false);
  assert.deepEqual(evidence.required, ['source', 'summary', 'value', 'reason_code', 'data_as_of']);
});
