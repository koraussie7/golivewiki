/**
 * KBizHub Business MCP 도구 정의 + 핸들러.
 *
 * 근거: send-go/openapi OpenAPI 3.0.3 (58 엔드포인트) 중 KBizHub 예약 안내 루프에
 * 필요한 4개만 노출한다. 나머지는 의도적으로 제외 — MCP 표면을 최소화하는 것이
 * Zero-Trust 원칙에 부합한다.
 *
 * 노출 4개 (스펙 확인 완료 2026-10-13):
 *   GET  /{version}/kakao-senders     발신프로필 목록        (필터 파라미터 없음)
 *   GET  /{version}/notice-templates  알림톡 템플릿 목록      (kakaoSenderKey·inspectionStatus·search·count)
 *   POST /{version}/notices/send      알림톡 발송            (+ SMS 자동 대체)
 *   POST /{version}/messages/send     SMS/LMS/MMS 발송
 *
 * ⚠️ 결과 조회 엔드포인트는 스펙에 없다 (58개 전체에 없음).
 *    실결과는 POST /{version}/webhook 구독으로 수신해야 한다.
 *    이전 초안의 /alimtalk/messages/{messageId} 는 존재하지 않는 경로였다.
 */

/** 한국 휴대폰 01x 형식. 하이픈/공백 허용. */
const PHONE_RE = /^01[0-9]{1}-?\d{3,4}-?\d{4}$/;

/** SMS 단문 기준 90바이트. 초과 시 LMS 승격 필요. */
const SMS_BYTE_LIMIT = 90;

export function validatePhone(raw) {
  const value = String(raw || '').trim();
  if (!PHONE_RE.test(value)) {
    throw new Error(
      `휴대폰 번호 형식이 올바르지 않습니다: "${value}". 예) 01012345678 또는 010-1234-5678`
    );
  }
  // 하이픈 제거 후에도 01x + 7~8자리(총 9~10자리)인지 확인 —
  // PHONE_RE 는 가운데 자릿수가 3~4로 유동적이라 자릿수가 어긋난 번호도 통과한다.
  const digits = value.replace(/[^0-9]/g, '');
  if (!/^01[0-9]{8,9}$/.test(digits)) {
    throw new Error(
      `휴대폰 번호 자릿수가 올바르지 않습니다: "${value}" (${digits.length}자리). 예) 01012345678`
    );
  }
  return digits;
}

/** 본문 바이트 길이 근사 (한글 2바이트, 그 외 1바이트). */
function smsByteLength(text) {
  let bytes = 0;
  for (const ch of text) {
    bytes += ch.codePointAt(0) > 0x7f ? 2 : 1;
  }
  return bytes;
}

/** 템플릿 본문의 #{var} 키 추출. */
function extractTemplateVarKeys(template) {
  const content = template?.templateContent || template?.content || '';
  return [...new Set([...content.matchAll(/#\{(\w+)\}/g)].map((m) => m[1]))];
}

export function resolveTemplateParams(declared, provided) {
  const declaredKeys = Array.isArray(declared) ? declared.map(String) : [];
  const map = new Map(Object.entries(provided || {}).map(([k, v]) => [String(k), String(v)]));

  // 템플릿이 요구하는 변수가 모두 채워졌는지 확인 — 누락은 카카오 검수 거절 사유.
  const missing = declaredKeys.filter((key) => !map.has(key));
  if (missing.length > 0) {
    throw new Error(`템플릿 필수 변수 누락: ${missing.join(', ')}`);
  }
  return {
    params: Object.fromEntries(map),
    extras: Object.keys(provided || {}).filter((k) => !declaredKeys.includes(k)),
  };
}

/**
 * 발송 가능한(검수 승인) 템플릿을 조회한다.
 * 반환: { template, declaredKeys } — declaredKeys 는 템플릿 본문이 요구하는 변수 키.
 * 템플릿 코드가 목록에 없으면 검수 상태를 알 수 없으므로 발송을 중단한다.
 */
/** notice-templates 목록 응답의 봉투를 정규화해 배열로 돌려준다. */
async function fetchTemplates(client, params = new URLSearchParams()) {
  const res = await client.request(`/notice-templates?${params.toString()}`);
  const data = res?.data ?? res ?? {};
  return data.templates ?? (Array.isArray(data) ? data : []);
}

async function resolveApprovedTemplate(client, templateCode) {
  const params = new URLSearchParams();
  params.set('search', templateCode);
  const sender = client.kakaoSenderKey;
  if (sender) params.set('kakaoSenderKey', sender);
  params.set('count', '100');

  const templates = await fetchTemplates(client, params);
  const template = templates.find((t) => String(t.templateCode) === String(templateCode));
  if (!template) {
    throw new Error(`승인된 알림톡 템플릿을 찾을 수 없습니다: ${templateCode}`);
  }
  const inspectionStatus = template.inspectionStatus ?? template.status ?? template.templateStatus;
  if (inspectionStatus !== 'APR') {
    throw new Error(
      `승인(APR)되지 않은 알림톡 템플릿입니다: ${templateCode} (검수 상태: ${inspectionStatus ?? '알 수 없음'})`
    );
  }
  return { template, declaredKeys: extractTemplateVarKeys(template) };
}

/** 수신자 목록을 발송용 contacts 로 변환한다. (전화번호 검증 + 템플릿 변수 매핑) */
function buildContacts(recipients, declaredKeys) {
  return recipients.map((raw) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const phone = validatePhone(r.phone);
    const { params, extras } = resolveTemplateParams(declaredKeys, r.vars);
    if (extras.length > 0) {
      throw new Error(
        `템플릿에 없는 변수 전달됨: ${extras.join(', ')}. 선언된 변수: ${declaredKeys.join(', ') || '없음'}`
      );
    }
    const entry = { contact: phone };
    for (const [k, v] of Object.entries(params)) entry[k] = v;
    return entry;
  });
}

/**
 * SMS 자동 대체(fallbackSms) 필드를 만든다. fallbackSms 미지정 시 빈 객체.
 * 지정 시 문자 발신번호 키가 필요하다.
 */
function buildFallbackFields({ client, fallbackSms, smsSenderKey, template }) {
  const useFallback = Boolean(fallbackSms);
  if (!useFallback) return { replaceSms: 'N' };

  const key = smsSenderKey || client.smsSenderKey;
  if (!key) {
    throw new Error(
      'replaceSms=Y 발송에는 senderKey(문자 발신번호 키) 가 필요합니다. ' +
        'smsSenderKey 인자 또는 SENDGO_SMS_SENDER_KEY 환경변수를 설정하세요.'
    );
  }

  const content = fallbackSms.content || template?.templateContent || template?.content || '';
  if (!content) {
    throw new Error('fallbackSms.content 가 비어있고 템플릿 본문도 없습니다.');
  }
  const bytes = smsByteLength(content);
  if (bytes > SMS_BYTE_LIMIT && !fallbackSms.subject) {
    throw new Error(
      `SMS 본문이 ${bytes}바이트로 90바이트를 초과합니다. LMS 승격을 위해 fallbackSms.subject 가 필요합니다.`
    );
  }
  const fields = {
    replaceSms: 'Y',
    senderKey: key,
    smsContent: content,
  };
  if (fallbackSms.subject) fields.smsSubject = fallbackSms.subject;
  return fields;
}

/** MCP 도구 스키마 — KBizHub Gateway 뒤에 노출되는 최소 집합. */
export const TOOLS = [
  {
    name: 'list_kakao_senders',
    description:
      '카카오 발신프로필(채널) 목록을 조회한다. 발송 전 kakaoSenderKey 확인용. 기업(Team) 애플리케이션만 사용 가능.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_alimtalk_templates',
    description: '알림톡 템플릿 목록을 조회한다. 승인된(APR) 템플릿만 발송 가능.',
    inputSchema: {
      type: 'object',
      properties: {
        kakaoSenderKey: { type: 'string', description: '발신프로필 키. 생략 시 클라이언트 기본값.' },
        inspectionStatus: {
          type: 'string',
          enum: ['REG', 'REQ', 'APR', 'REJ'],
          description: '검수 상태. 기본 APR(승인).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'send_alimtalk',
    description:
      '카카오 알림톡을 발송한다. 실패 시 SMS 자동 대체(fallbackSms)를 설정하면 발신실패 알림톡이 SMS/LMS로 전환된다. 예약 확인·리마인더 안내에 사용.',
    inputSchema: {
      type: 'object',
      properties: {
        kakaoSenderKey: { type: 'string', description: '발신프로필 키. 생략 시 클라이언트 기본값.' },
        templateCode: { type: 'string', description: '승인된 알림톡 템플릿 코드 (예: ORDER_001)' },
        recipients: {
          type: 'array',
          description: '수신자 목록. 1건 이상.',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              phone: { type: 'string', description: '휴대폰 번호 (01012345678)' },
              vars: {
                type: 'object',
                description: '템플릿 변수 맵 {var1: "...", var2: "..."}',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['phone'],
            additionalProperties: false,
          },
        },
        fallbackSms: {
          type: 'object',
          description:
            '알림톡 실패 시 SMS 자동 대체. 지정 시 문자 발신번호 키(senderKey) 가 필수다. content 미지정 시 템플릿 본문 사용.',
          properties: {
            subject: { type: 'string', description: 'LMS 제목 (90바이트 초과 시 필수)' },
            content: { type: 'string', description: 'SMS 본문. #{var1} 치환 사용 가능.' },
          },
          additionalProperties: false,
        },
        smsSenderKey: {
          type: 'string',
          description: '문자 발신번호 키. fallbackSms 사용 시 필수. 미지정 시 SENDGO_SMS_SENDER_KEY.',
        },
      },
      required: ['templateCode', 'recipients'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_sms',
    description:
      'SMS/LMS/MMS 문자를 발송한다. LMS/MMS 는 subject 필수. 문자 발신번호 키(senderKey) 필수.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '메시지 본문 (필수)' },
        recipients: {
          type: 'array',
          description: '수신자 목록.',
          minItems: 1,
          items: {
            type: 'object',
            properties: { phone: { type: 'string', description: '휴대폰 번호 (01012345678)' } },
            required: ['phone'],
            additionalProperties: false,
          },
        },
        senderKey: {
          type: 'string',
          description: '문자 발신번호 키. 미지정 시 SENDGO_SMS_SENDER_KEY.',
        },
        messageType: {
          type: 'string',
          enum: ['SMS', 'LMS', 'MMS'],
          description: 'SMS(단문 90자) / LMS(장문 2,000자) / MMS. 기본 SMS.',
        },
        subject: { type: 'string', description: '메시지 제목. LMS/MMS 필수.' },
      },
      required: ['content', 'recipients'],
      additionalProperties: false,
    },
  },
];

/** 도구 핸들러 팩토리. */
export function createHandlers(client) {
  return {
    list_kakao_senders: async () => {
      // GET /{version}/kakao-senders — 필터 파라미터 없음 (전체 조회).
      const res = await client.request('/kakao-senders');
      const data = res?.data ?? res ?? {};
      return { senders: data.senders ?? (Array.isArray(data) ? data : []) };
    },

    list_alimtalk_templates: async ({ kakaoSenderKey, inspectionStatus = 'APR', search, count = 30 } = {}) => {
      const params = new URLSearchParams();
      if (inspectionStatus) params.set('inspectionStatus', inspectionStatus);
      const sender = kakaoSenderKey || client.kakaoSenderKey;
      if (sender) params.set('kakaoSenderKey', sender);
      if (search) params.set('search', search);
      params.set('count', String(Number(count) || 30));
      const templates = await fetchTemplates(client, params);
      return {
        templates: templates.map((t) => ({
          templateCode: t.templateCode,
          templateName: t.templateName,
          inspectionStatus: t.inspectionStatus ?? t.status,
          variableKeys: extractTemplateVarKeys(t),
        })),
      };
    },

    send_alimtalk: async ({ kakaoSenderKey, templateCode, recipients, fallbackSms, smsSenderKey } = {}) => {
      if (!templateCode) throw new Error('templateCode 는 필수입니다.');
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('recipients 는 1건 이상 필요합니다.');
      }

      const senderKey = kakaoSenderKey || client.kakaoSenderKey;
      if (!senderKey) {
        throw new Error(
          'kakaoSenderKey 가 없습니다. 요청에 포함하거나 클라이언트 기본 발신프로필을 설정하세요.'
        );
      }

      const { template, declaredKeys } = await resolveApprovedTemplate(client, templateCode);
      const contacts = buildContacts(recipients, declaredKeys);
      const fallbackFields = buildFallbackFields({
        client,
        fallbackSms,
        smsSenderKey,
        template,
      });

      const body = {
        scheduleType: 'DIRECTLY',
        at: null,
        templateCode,
        kakaoSenderKey: senderKey,
        contacts,
        ...fallbackFields,
      };

      const res = await client.request('/notices/send', { method: 'POST', body });
      const data = res?.data ?? res ?? {};
      return {
        messageId: data.messageId ?? data.id ?? null,
        requestCount: contacts.length,
        accepted: true,
        // 스펙에 결과 조회 엔드포인트가 없다. 웹훅으로 수신해야 한다.
        note:
          '발송 접수 완료. 실결과는 Sendgo API 에 조회 엔드포인트가 없어 ' +
          '웹훅(POST /{version}/webhook) 구독으로 수신해야 합니다.',
      };
    },

    send_sms: async ({ content, recipients, senderKey, messageType = 'SMS', subject } = {}) => {
      if (!content) throw new Error('content 는 필수입니다.');
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('recipients 는 1건 이상 필요합니다.');
      }
      const key = senderKey || client.smsSenderKey;
      if (!key) {
        throw new Error(
          'senderKey(문자 발신번호 키) 가 필요합니다. SENDGO_SMS_SENDER_KEY 환경변수를 설정하세요.'
        );
      }
      if (messageType !== 'SMS' && !subject) {
        throw new Error(`${messageType} 발송에는 subject 가 필수입니다.`);
      }

      // SMS(90바이트) 한도를 넘으면 자동으로 LMS 로 승격한다. 제목이 필요한 유형은
      // 이미 위에서 검증했다.
      const bytes = smsByteLength(content);
      let resolvedType = messageType;
      if (bytes > SMS_BYTE_LIMIT && messageType === 'SMS') {
        if (!subject) {
          throw new Error(
            `본문이 ${bytes}바이트로 SMS 한도(${SMS_BYTE_LIMIT}바이트)를 초과합니다. ` +
              'subject 를 지정해 LMS 로 발송하거나 본문을 줄이세요.'
          );
        }
        resolvedType = 'LMS';
      }

      const body = {
        campaignType: 'MESSAGE',
        messageType: resolvedType,
        scheduleType: 'DIRECTLY',
        at: null,
        content,
        senderKey: key,
        contacts: recipients.map((r) => ({ contact: validatePhone(r.phone) })),
      };
      if (subject) body.subject = subject;

      const res = await client.request('/messages/send', { method: 'POST', body });
      const data = res?.data ?? res ?? {};
      return {
        messageId: data.messageId ?? data.id ?? null,
        requestCount: recipients.length,
        accepted: true,
        messageType: resolvedType,
        byteLength: bytes,
      };
    },
  };
}

