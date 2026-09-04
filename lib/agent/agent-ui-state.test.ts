import assert from 'node:assert/strict';
import test from 'node:test';
import { answerDisplayState, validateAgentQuestion } from '../../app/(user)/agent/state.ts';
import { cannotAnswer, type AgentAnswer } from './schema.ts';

test('rejects a blank agent question', () => {
  assert.equal(validateAgentQuestion('   '), '질문을 입력해 주세요.');
});

test('marks calculation-unavailable answers for the explicit unavailable UI state', () => {
  assert.equal(answerDisplayState(cannotAnswer('NO_FORECAST')), 'unavailable');
});

test('marks a valid structured answer for the normal UI state', () => {
  const answer: AgentAnswer = { answer: '정상', verdict: null, evidence: [], data_as_of: null, risk: 'SAFE', recommended_action: null, cannot_answer: false, cannot_answer_reason: null };
  assert.equal(answerDisplayState(answer), 'normal');
});
