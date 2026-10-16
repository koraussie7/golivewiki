/**
 * Sendgo API 클라이언트 — KBizHub MCP 래퍼용.
 *
 * 근거: send-go/openapi (OpenAPI 3.0.3, 58 엔드포인트) 중 KBizHub가 쓰는 4개만 구현.
 *
 * 인증 (openapi.yaml info.description 원문 기준):
 *   1. 토큰 발급: `accessKey:secretKey` 를 Base64 → Basic 인증으로 /token 요청
 *   2. API 호출: 발급받은 토큰으로 Bearer 인증
 *      - v1: `Authorization: Bearer base64(token)`
 *      - v2: `Authorization: Bearer token`
 *   토큰 유효기간: 24시간. SDK는 50분 캐시 + 401 자동 재시도로 관리.
 *
 * 외부 런타임 의존성 0개 — Node 18+ 내장 fetch 만 사용.
 */

/**
 * 기본 서버 주소.
 *
 * ⚠️ openapi.yaml 의 `servers[0].url` = `https://sendgo.io/api` 이다.
 * 즉 baseUrl 에 이미 `/api` 가 포함돼 있으므로, 경로 조립은 `{baseUrl}/{version}{path}`.
 * (스펙 경로 자체가 `/{version}/...` 형태다)
 */
const DEFAULT_BASE_URL = process.env.SENDGO_BASE_URL || 'https://sendgo.io/api';

/** API 버전별 토큰 사용 방식이 다르다 (v1 은 base64 재인코딩). */
function buildAuthHeader(token, apiVersion) {
  if (apiVersion === 'v1') {
    return `Bearer ${Buffer.from(token, 'utf8').toString('base64')}`;
  }
  return `Bearer ${token}`;
}

export class SendgoError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = 'SendgoError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class SendgoClient {
  /**
   * @param {object} opts
   * @param {string} opts.accessKey   SENDGO_ACCESS_KEY
   * @param {string} opts.secretKey   SENDGO_SECRET_KEY
   * @param {'v1'|'v2'} [opts.apiVersion='v2']
   * @param {string} [opts.baseUrl]
   * @param {string} [opts.kakaoSenderKey] 선택 — 기본 발신프로필
   */
  constructor({ accessKey, secretKey, apiVersion = 'v2', baseUrl, kakaoSenderKey, smsSenderKey }) {
    if (!accessKey || !secretKey) {
      throw new SendgoError(
        'accessKey/secretKey 필요. 환경변수 SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY 를 설정하세요.'
      );
    }
    if (apiVersion !== 'v1' && apiVersion !== 'v2') {
      throw new SendgoError(`apiVersion 은 'v1' | 'v2' 만 허용 (받은 값: ${apiVersion})`);
    }
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.apiVersion = apiVersion;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.kakaoSenderKey = kakaoSenderKey;
    // SMS 발신자 키. 스펙에서 SmsRequest.senderKey 는 required,
    // AlimtalkRequest.senderKey 는 replaceSms="Y" 일 때만 필수다.
    // 문자 발신번호: 인자 우선, 없으면 환경변수 폴백. (kakaoSenderKey 와 동일 규칙)
    this.smsSenderKey = smsSenderKey || process.env.SENDGO_SMS_SENDER_KEY || undefined;

    // 토큰 캐시 — SDK 정책(50분)과 동일하게 여유를 둔다.
    this._token = null;
    this._tokenExpiresAt = 0;
    this._tokenTtlMs = 50 * 60 * 1000;
    this._tokenPromise = null;
  }

  /** accessKey:secretKey Base64 Basic 인증으로 토큰 발급. */
  async #issueToken() {
    const basic = Buffer.from(`${this.accessKey}:${this.secretKey}`, 'utf8').toString('base64');
    const res = await fetch(`${this.baseUrl}/${this.apiVersion}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'content-type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new SendgoError(`토큰 발급 실패 (HTTP ${res.status})`, {
        status: res.status,
        code: body?.code,
        body,
      });
    }

    // v2 는 data.token / expiresAt, v1 은 data.access_token / expires_at 형태.
    const data = body?.data ?? body;
    const token = data?.token ?? data?.access_token;
    if (!token) {
      throw new SendgoError('토큰 응답에 token 필드가 없습니다', { body });
    }
    return token;
  }

  /** 유효 토큰 반환. 만료 임박 시 재발급. 401 이면 1회 재시도. */
  async #getToken(force = false) {
    const now = Date.now();
    if (!force && this._token && now < this._tokenExpiresAt) return this._token;

    if (force) {
      this._token = null;
      this._tokenExpiresAt = 0;
    }

    if (!this._tokenPromise) {
      const tokenPromise = this.#issueToken();
      this._tokenPromise = tokenPromise;
      try {
        this._token = await tokenPromise;
        this._tokenExpiresAt = Date.now() + this._tokenTtlMs;
      } finally {
        if (this._tokenPromise === tokenPromise) this._tokenPromise = null;
      }
    } else {
      const token = await this._tokenPromise;
      this._token = token;
      this._tokenExpiresAt = Date.now() + this._tokenTtlMs;
    }
    return this._token;
  }

  /**
   * 공개 요청 헬퍼. 401/403 시 토큰 재발급 후 1회 재시도.
   * path 는 버전 접두사 제외 상대경로 (예: '/kakao/alimtalk/send').
   */
  async request(path, { method = 'GET', body } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const force = attempt === 1;
      const token = await this.#getToken(force);
      const res = await fetch(`${this.baseUrl}/${this.apiVersion}${path}`, {
        method,
        headers: {
          Authorization: buildAuthHeader(token, this.apiVersion),
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401 || res.status === 403) {
        if (attempt === 0) continue; // 토큰 재발급 후 재시도
        const err = await res.json().catch(() => ({}));
        throw new SendgoError(`인증 실패 (HTTP ${res.status})`, {
          status: res.status,
          code: err?.code,
          body: err,
        });
      }

      const payload = res.status === 204 ? null : await res.json().catch(() => ({}));

      if (!res.ok) {
        // Sendgo 정책 필드 불일치는 POLICY_VALIDATION_FAILED 로 거절된다.
        const code = payload?.code || payload?.errors?.[0]?.code;
        const msg =
          payload?.message ||
          payload?.errors?.map((e) => e.message).join('; ') ||
          `Sendgo API 오류 (HTTP ${res.status})`;
        throw new SendgoError(msg, { status: res.status, code, body: payload });
      }
      return payload;
    }
    throw new SendgoError('요청 재시도 한도 초과');
  }

  /** 발급된 토큰 존재 여부 — 헬스체크용. */
  async healthcheck() {
    const token = await this.#getToken(true);
    return { ok: true, apiVersion: this.apiVersion, tokenLength: token.length };
  }
}
