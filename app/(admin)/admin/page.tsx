import PageHeader from '@/components/shell/page-header';
import UserShell from '@/components/shell/user-shell';
import Panel from '@/components/ui/panel';

export default function AdminPage() {
  return <UserShell role="ADMIN"><PageHeader eyebrow="ADMIN" title="관리자" description="메뉴와 운영 환경을 관리하는 공간입니다." /><Panel title="관리자 기능 준비 중" description="사용자·권한·데이터 운영 기능을 이 영역에 확장할 수 있습니다."><div className="ui-chart-placeholder">관리자 모듈을 선택해 주세요.</div></Panel></UserShell>;
}
