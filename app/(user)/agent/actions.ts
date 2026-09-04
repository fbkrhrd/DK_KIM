'use server';

import { requireUser } from '@/lib/auth';
import { runAgent } from '@/lib/agent/orchestrator';
import { initialAgentState, validateAgentQuestion, type AgentActionState } from './state';

export async function askAgent(_previous: AgentActionState, formData: FormData): Promise<AgentActionState> {
  const user = await requireUser();
  const questionError = validateAgentQuestion(formData.get('question'));
  if (questionError) return { ...initialAgentState, error: questionError };
  if (!(process.env.OPENAI_BASE_URL ?? '').trim() || !(process.env.OPENAI_API_KEY ?? '').trim() || !(process.env.OPENAI_MODEL ?? '').trim()) {
    return { ...initialAgentState, error: 'AI Agent 서버 설정이 아직 완료되지 않았습니다.' };
  }

  const result = await runAgent({
    question: String(formData.get('question')).trim(),
    user: { id: user.user_id, role: user.role },
    history: [],
  });
  return { answer: result.answer, trace: result.trace, error: null };
}
