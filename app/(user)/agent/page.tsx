import PageHeader from '@/components/shell/page-header';
import UserShell from '@/components/shell/user-shell';
import { requireUser } from '@/lib/auth';
import ChatForm from './chat-form';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  await requireUser();
  const enabled = Boolean((process.env.OPENAI_BASE_URL ?? '').trim() && (process.env.OPENAI_API_KEY ?? '').trim() && (process.env.OPENAI_MODEL ?? '').trim());
  return <UserShell>
    <PageHeader eyebrow="AI AGENT" title="SCM Agent" description="수요, 출고, OL 정확도, BOM 구성 데이터를 근거로 질문에 답합니다." />
    <ChatForm enabled={enabled} />
  </UserShell>;
}
