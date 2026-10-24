export const DEPLOY_STEPS = [
  {
    step: "01",
    title: "XFS 마운트 + MI50 인식",
    cmd: `+ XFS mount /mnt/xfs
+ 20x MI50 인식 확인
rocm-smi | grep gfx906
# 예시 이미지 검증 필요`,
    time: "10분 (시뮬)",
  },
  {
    step: "02",
    title: "Vast 에이전트 + HF 캐시",
    cmd: `docker compose up vast-host hf-hub
# HF 모델 프리로드
python3 preload.py --models
qwen2.5-7b,qwen2.5-32b
# 예시 레지스트리 교체 필요`,
    time: "12분 (시뮬)",
  },
  {
    step: "03",
    title: "LiteLLM 라우터",
    cmd: `cp litellm-config.yaml ./
# 20개 GPU 로드밸런싱 설정
docker compose up super-router
curl localhost:4000/health
# 시뮬레이션`,
    time: "5분 (시뮬)",
  },
  {
    step: "04",
    title: "Caddy + 도메인 + 빌링",
    cmd: `caddy reverse-proxy :443 -> :4000
# Stripe 토큰 빌링 연동
./setup-billing.sh --price 0.15
# DONE: api.phungkhoang.ai
# 시뮬레이션`,
    time: "3분 (시뮬)",
  },
];

export const FARM_INFO = {
  name: "Phùng Khoang Farm — Hanoi, Vietnam",
  location: "Hanoi, Vietnam",
  badge: "(시뮬레이션)",
  specs: "20x MI50 • gfx906 • ROCm 5.7 • XFS 2TB • Caddy + LiteLLM • Live since 2024.11 (시뮬레이션)",
  sourceNote: "시뮬레이션 데이터",
};