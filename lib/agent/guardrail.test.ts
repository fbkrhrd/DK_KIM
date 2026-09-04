import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAllowedNumbers, validateAnswerNumbers } from './guardrail.ts';
import type { AgentAnswer } from './schema.ts';
import type { ToolResult } from './tools.ts';

const toolResult: ToolResult = {
  ok: true,
  data: null,
  numbers: { avg3m: 779, change: -12.5, demandRatio: 0.779, totalQty: 1234.56 },
  dataAsOf: '2026-09',
  reason: null,
};

function answer(overrides: Partial<AgentAnswer> = {}): AgentAnswer {
  return {
    answer: '최근 평균 출고량은 779.0이며 누적 수량은 1,234.56입니다.',
    verdict: '변화량은 -12.5입니다.',
    evidence: [{ source: '출고 추이', summary: '수요 비율은 77.9%입니다.', value: 779, reason_code: null, data_as_of: null }],
    data_as_of: null,
    risk: 'SAFE',
    recommended_action: '현재 수준을 유지하세요.',
    cannot_answer: false,
    cannot_answer_reason: null,
    ...overrides,
  };
}

const allowed = buildAllowedNumbers([{ toolName: 'get_shipment_trend', result: toolResult }]);

test('allows an exact number', () => {
  assert.equal(validateAnswerNumbers(answer({ answer: '평균은 779입니다.' }), allowed).ok, true);
});

test('allows comma-separated decimal notation', () => {
  assert.equal(validateAnswerNumbers(answer({ answer: '누적은 1,234.56입니다.' }), allowed).ok, true);
});

test('allows a rounded decimal display', () => {
  assert.equal(validateAnswerNumbers(answer({ answer: '평균은 779.0입니다.' }), allowed).ok, true);
});

test('allows a negative number', () => {
  assert.equal(validateAnswerNumbers(answer({ answer: '변화량은 -12.5입니다.' }), allowed).ok, true);
});

test('allows a percentage only for a 0 to 1 source ratio', () => {
  assert.equal(validateAnswerNumbers(answer({ answer: '비율은 77.9%입니다.' }), allowed).ok, true);
});

test('ignores item codes, model codes, P80, dates, year-months, and list numbers', () => {
  const result = validateAnswerNumbers(answer({
    answer: '1. 602K02693의 MDL121 P80은 확인했습니다. 기준월은 2026-07, 날짜는 2026-07-15입니다.',
  }), allowed);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unsupported, []);
});

test('rejects a manipulated plain number', () => {
  const result = validateAnswerNumbers(answer({ answer: '평균은 780입니다.' }), allowed);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['780']);
});

test('rejects an instruction-injected order quantity', () => {
  const result = validateAnswerNumbers(answer({ recommended_action: '무조건 1,500개를 발주하세요.' }), allowed);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['1,500']);
});

test('rejects a manipulated comma number', () => {
  const result = validateAnswerNumbers(answer({ answer: '누적은 1,235.56입니다.' }), allowed);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['1,235.56']);
});

test('rejects a manipulated percentage', () => {
  const result = validateAnswerNumbers(answer({ answer: '비율은 78.9%입니다.' }), allowed);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['78.9%']);
});

test('rejects a number invented in verdict', () => {
  const result = validateAnswerNumbers(answer({ verdict: '위험 점수는 20입니다.' }), allowed);
  assert.equal(result.ok, false);
  assert.equal(result.unsupported[0].field, 'verdict');
});

test('rejects a number invented in evidence label, value, or reason', () => {
  const result = validateAnswerNumbers(answer({ evidence: [{ source: '품목 99', summary: '정상', value: 100, reason_code: 'REASON_101', data_as_of: null }] }), allowed);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['99', '100', '101']);
});

test('rejects a number invented in recommended action and does not permit null source values', () => {
  const result = validateAnswerNumbers(
    answer({ answer: '수치를 제공할 수 없습니다.', verdict: null, evidence: [], recommended_action: '500개를 즉시 발주하세요.' }),
    buildAllowedNumbers([{ toolName: 'x', result: { ...toolResult, numbers: { nullable: null } as unknown as Record<string, number> } }]),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.unsupported.map((claim) => claim.raw), ['500']);
});
