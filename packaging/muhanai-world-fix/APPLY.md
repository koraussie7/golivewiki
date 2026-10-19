# muhanai.com/world 빈 화면 수정 패치

원인: 워커가 `/api/world/*`를 404로 버리고(`feed-api.ts` → `{"error":"not found"}`),
프론트 `WorldPage.load()`의 빈 `catch`가 `brief`를 `null`로 남김.

## 파일 구성

| 파일 | 적용 위치 (MuhanAI 체크아웃 기준) |
|---|---|
| `deploy-world-brief.ts` | `packaging/npm/token-free-gateway/agentmesh/deploy/world-brief.ts` 로 복사 (신규 파일) |
| `01-feed-api.world.patch` | `packaging/npm/token-free-gateway/agentmesh/` 에서 `git apply` |
| `02-WorldPage.offline-fallback.patch` | 동일 |
| `03-Ontology.offline-demo.patch` | 동일 (ontology 탭 오프라인 데모 그래프) |
| `04-Globe.restore-3d.patch` | 동일 (globe.gl 복원 + earth 텍스처; 적용 후 `pnpm install` 필요) |

## 적용

```bash
cd /Users/brianyeon/muhanai/muhanai/packaging/npm/token-free-gateway/agentmesh

# 1. 신규 파일 배치
cp <이_폴더>/deploy-world-brief.ts deploy/world-brief.ts

# 2. 패치 적용 (적용 전 확인: git apply --check)
for p in 01-feed-api.world 02-WorldPage.offline-fallback 03-Ontology.offline-demo 04-Globe.restore-3d; do
  git apply --check <이_폴더>/$p.patch || { echo "$p --check 실패"; break; }
done
git apply <이_폴더>/01-feed-api.world.patch \
&& git apply <이_폴더>/02-WorldPage.offline-fallback.patch \
&& git apply <이_폴더>/03-Ontology.offline-demo.patch \
&& git apply <이_폴더>/04-Globe.restore-3d.patch

# 2b. globe.gl 의존성 설치 (04번 패치 적용 후 필수)
cd apps/web && pnpm install   # globe.gl@^2.46.2 + three.js 포함

# 3. 검증 (리포 루트 스크립트 기준)
pnpm --filter @agentmesh/web run build   # 또는 리포의 build:web
```

`git apply` 실패 시: 체크아웃이 이 패치 기준과 다르면 `.rej`를 보고
해당 hunk를 수동 반영 (앵커: `feed-api.ts`의 import 1행·ROUTES ontology末尾,
`WorldPage.tsx`의 `// panel uses the ontology demo fallback` 주석).

## 배포·확인

```bash
pnpm deploy:worker   # muhanai 리포 루트 (wrangler deploy)
curl -s https://muhanai.com/api/world/brief | head -c 300
curl -s https://muhanai.com/api/world/health
```

기대값: `/api/world/brief` 200 + `"source":"offline"`,
`/world` 페이지에 OFFLINE 배지·스냅샷 문구 렌더.

## 이후 (실시간 데이터)

`deploy/world-brief.ts`는 엣지 오프라인 스냅샷 심입니다.
실시간 전환 시: `api.muhanai.com` 배포 후 워커 `API_ORIGIN` 설정
(워커 주석의 기존 계획 그대로), 또는 `handleFeedApi`에 upstream URL을
env로 전달하도록 확장 후 이 심을 삭제.
