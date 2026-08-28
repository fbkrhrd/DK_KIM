import PageHeader from '@/components/shell/page-header';
import ImportClient from './import-client';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DataManagementPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema('core').from('upload_batch').select('*').order('uploaded_at', { ascending: false });
  return <><PageHeader eyebrow="ADMIN / DATA" title="Data Management" description="Validate staged CSV or Excel data, import approved rows, and review batch history." /><ImportClient history={data ?? []} /></>;
}
