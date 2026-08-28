# 오류 기록

## 2026-08-28 — STEP 2 빌드 타입 오류

- 증상: `useActionState` 초기 상태의 `error: null`이 서버 액션 반환 타입과 맞지 않아 빌드가 실패했습니다.
- 원인: 로그인 액션의 오류 반환값이 `string`인데 폼 초기 상태가 `null`로 선언되어 React 타입 오버로드가 일치하지 않았습니다.
- 해결: 로그인 폼의 초기 상태를 `{ error: '' }`로 변경했습니다.

## 2026-08-28 — Supabase SSR cookie 타입 오류

- 증상: `@supabase/ssr` cookie adapter의 `setAll` 매개변수가 암시적으로 `any`로 추론되어 빌드가 실패했습니다.
- 원인: 현재 설치된 Supabase SSR 타입과 Next.js middleware/server cookie adapter의 콜백 추론이 일치하지 않았습니다.
- 해결: 두 cookie adapter의 `setAll` 쿠키 배열 매개변수 타입을 명시했습니다.
