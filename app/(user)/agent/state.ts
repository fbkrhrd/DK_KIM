import type { AgentAnswer } from '../../../lib/agent/schema.ts';
import type { AgentTrace } from '../../../lib/agent/orchestrator.ts';

export type AgentActionState = {
  answer: AgentAnswer | null;
  trace: AgentTrace[];
  error: string | null;
};

export const initialAgentState: AgentActionState = { answer: null, trace: [], error: null };

export function validateAgentQuestion(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || value.trim() === '') return '질문을 입력해 주세요.';
  return null;
}

export function answerDisplayState(answer: AgentAnswer): 'normal' | 'unavailable' {
  return answer.cannot_answer ? 'unavailable' : 'normal';
}
