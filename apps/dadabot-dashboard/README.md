# @golive/dadabot-dashboard — GoLive 위젯 패키지

이 패키지는 Dadabot 대시보드에 삽입되는 **GoLive 작업 인박스 위젯**만 제공합니다.
실제 Dadabot 대시보드 셸(라우팅·레이아웃·인증 UI)은 이 ZIP에 포함되어 있지 않으므로 여기서 만들지 않습니다.

## 사용법

```tsx
import { GoLiveTaskInbox } from "@golive/dadabot-dashboard/features/golive";

<GoLiveTaskInbox
  getAccessToken={() => supabase.auth.getSession().then((r) => r.data.session?.access_token ?? null)}
  apiBaseUrl={import.meta.env.VITE_GOLIVE_API_BASE}
/>
```

## Phase 2에서 필요한 작업
- 위젯이 호출하는 `/smartglass/tasks/*` 경로를 서버 계약(`server-example/openapi-contract.yaml`)에 맞춰 정합화
- `consent` / `video-session` 엔드포인트 구현 전까지 영상 버튼은 비활성 유지
