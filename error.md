# 오류 기록

## 2026-08-28 — STEP 2 빌드 타입 오류

- 증상: `useActionState` 초기 상태의 `error: null`이 서버 액션 반환 타입과 맞지 않아 빌드가 실패했습니다.
- 해결: 로그인 폼의 초기 상태를 `{ error: '' }`로 변경했습니다.

## 2026-08-28 — Supabase SSR cookie 타입 오류

- 증상: `@supabase/ssr` cookie adapter의 `setAll` 매개변수가 암시적으로 `any`로 추론되어 빌드가 실패했습니다.
- 해결: 두 cookie adapter의 `setAll` 쿠키 배열 매개변수 타입을 명시했습니다.

## 2026-08-28 — Vercel에서 로그아웃 버튼 미표시

- 증상: Vercel 기본 진입 화면에서 로그아웃 버튼이 보이지 않았습니다.
- 원인: `/workflow`는 신규 `UserShell` 상단바를 사용하지 않는 레거시 화면이며, 상단바 수정분도 아직 GitHub에 푸시되지 않았습니다.
- 해결: 레거시 workflow에 동일한 `logoutAction` 버튼을 추가하고, 수정분을 원격 `main`에 푸시해 새 Vercel 배포가 생성되도록 했습니다.
