import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';

export default function AdminPage() {
  return <><PageHeader eyebrow="ADMIN" title="관리자" description="사용자와 운영 환경을 관리하는 공간입니다." /><Panel title="관리자 기능" description="관리자 전용 운영 기능입니다."><div className="ui-chart-placeholder">사용자 관리 메뉴에서 계정과 권한을 관리하세요.</div></Panel></>;
}
