import { requireUser } from '../auth';
import { createSupabaseServerClient } from '../supabase/server';
import type { AgentAnswer } from './schema';
import type { AgentTrace } from './orchestrator';

export async function listConversations() { const user=await requireUser(); const s=await createSupabaseServerClient(); const {data,error}=await s.schema('core').from('agent_conversation').select('*').eq('user_id',user.user_id).order('last_at',{ascending:false}); return {rows:data??[],error:error?.message??null}; }
export async function getConversationMessages(conversationId:string) { await requireUser(); const s=await createSupabaseServerClient(); const {data,error}=await s.schema('core').from('agent_message').select('*').eq('conversation_id',conversationId).order('created_at'); return {rows:data??[],error:error?.message??null}; }
export async function saveTurn(question:string,answer:AgentAnswer,trace:AgentTrace[]) { await requireUser(); try { const s=await createSupabaseServerClient(); const {data,error}=await s.schema('core').rpc('save_agent_turn',{p_title:question.slice(0,80),p_question:question,p_answer:answer,p_tool_trace:trace,p_usage:null,p_guardrail:null}); return {conversationId:data as string|null,error:error?.message??null}; } catch(error) { return {conversationId:null,error:error instanceof Error?error.message:'CONVERSATION_SAVE_FAILED'}; } }
