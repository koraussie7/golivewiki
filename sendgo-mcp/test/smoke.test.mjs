/**
 * sendgo-mcp 단위 테스트 — `node --test test/`
 *
 * 외부 네트워크 호출 없음. Sendgo API 는 fetch 스텁으로 대체한다.
 * (자격증명이 없는 개발 환경에서도 항상 실행 가능해야 한다.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SendgoClient, SendgoError } from '../src/client.mjs';
import { TOOLS, createHandlers, validatePhone, resolveTemplateParams } from '../src/tools.mjs';
import { redact } from '../src/server.mjs';

const FAKE = { accessKey: 'ak_test', secretKey: 'sk_test', apiVersion: 'v2' };

/** fetch 스텁 — 호출 기록을 남기고 미리 정한 응답을 돌려준다. */
function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return calls;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const isToken = (url) => /\/token$/.test(url);

// ── client ────────────────────────────────────────────────────────────────

test('SendgoClient: 자격증명 없으면 생성 즉시 실패', () => {
  assert.throws(() => new SendgoClient({ accessKey: '', secretKey: '' }), SendgoError);
});

test('SendgoClient: v1/v2 외 버전은 거부', () => {
  assert.throws(() => new SendgoClient({ ...FAKE, apiVersion: 'v3' }), /v1.*v2/);
});

test('SendgoClient: 토큰은 Basic 인증으로 발급하고 이후 Bearer 로 사용', async () => {
  const calls = stubFetch(() => json({ data: { token: 'tok-123' } }));
  await new SendgoClient(FAKE).request('/notice-templates', {});

  const [auth, api] = calls;
  assert.match(auth.url, /\/v2\/token$/);
  assert.match(auth.init.headers.Authorization, /^Basic /);
  assert.match(api.init.headers.Authorization, /^Bearer tok-123$/);
});

test('SendgoClient: 토큰 캐시 — 두 호출에 토큰 발급은 1회', async () => {
  const calls = stubFetch(() => json({ data: { token: 'tok-cached' } }));
  const client = new SendgoClient(FAKE);

  await client.request('/kakao-senders', {});
  await client.request('/kakao-senders', {});

  assert.equal(calls.filter((c) => isToken(c.url)).length, 1, '토큰을 재발급하면 안 된다');
});

test('SendgoClient: 401 이면 토큰 재발급 후 1회 재시도', async () => {
  let apiHits = 0;
  const calls = stubFetch((url) => {
    if (isToken(url)) return json({ data: { token: `tok-${calls.length}` } });
    apiHits += 1;
    return apiHits === 1
      ? json({ code: 'UNAUTHORIZED', message: 'expired' }, 401)
      : json({ data: { ok: true } });
  });
  const client = new SendgoClient(FAKE);

  assert.deepEqual(await client.request('/notice-templates', {}), { data: { ok: true } });
  assert.equal(apiHits, 2, 'API 는 정확히 2회 호출되어야 한다');
  assert.equal(calls.filter((c) => isToken(c.url)).length, 2);
});

test('SendgoClient: 정책 필드 불일치는 POLICY_VALIDATION_FAILED 코드를 보존', async () => {
  stubFetch((url) =>
    isToken(url)
      ? json({ data: { token: 'tok' } })
      : json({ code: 'POLICY_VALIDATION_FAILED', message: '목적 불일치' }, 400)
  );

  await assert.rejects(
    () => new SendgoClient(FAKE).request('/notices/send', { method: 'POST', body: {} }),
    (err) =>
      err instanceof SendgoError &&
      err.code === 'POLICY_VALIDATION_FAILED' &&
      err.status === 400
  );
});

test('SendgoClient: 204 는 null', async () => {
  stubFetch((url) =>
    isToken(url) ? json({ data: { token: 'tok' } }) : new Response(null, { status: 204 })
  );
  assert.equal(await new SendgoClient(FAKE).request('/x', {}), null);
});

// ── tools / handlers ──────────────────────────────────────────────────────

test('도구 노출: 4개, 이름과 스키마 고정', () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name),
    ['list_kakao_senders', 'list_alimtalk_templates', 'send_alimtalk', 'send_sms']
  );
  for (const tool of TOOLS) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(typeof tool.description, 'string');
  }
});

/**
 * 발송 경로 테스트용 픽스처.
 *
 * send_alimtalk 은 발송 전에 템플릿 목록을 조회해 치환변수명(#{var1})을 확인한다.
 * 이 조회를 스텁하지 않으면 declaredKeys 가 빈 배열이 되어 정상 발송도 거부되므로,
 * 템플릿 응답을 명시적으로 제공한다.
 */
/**
 * 발송 경로 테스트용 픽스처.
 *
 * send_alimtalk 은 발송 전에 (1) kakaoSenderKey 유무, (2) 템플릿 목록을 조회해
 * 치환변수명(#{var1}) 확인 — 두 가지를 먼저 통과해야 한다. 그래서 기본
 * kakaoSenderKey 를 넣어두고, 개별 테스트가 관심 있는 필드만 extra 로 덮어쓴다.
 * (예: `clientWith({ smsSenderKey: undefined })` — smsSenderKey 만 비운다.)
 */
const TEMPLATE_ORDER = {
  templateCode: 'ORDER_CONFIRM_001',
  templateName: '주문 접수 안내',
  inspectionStatus: 'APR',
  templateContent: '#{name}님, 주문 #{orderNo}이 접수되었습니다.',
};

const clientWith = (extra = {}) => {
  stubFetch((url) => {
    if (isToken(url)) return json({ data: { token: 'tok' } });
    if (/\/notice-templates/.test(url)) return json({ data: { templates: [TEMPLATE_ORDER] } });
    return json({ data: { messageId: 'm-1' } });
  });
  const client = new SendgoClient({
    ...FAKE,
    kakaoSenderKey: 'kakao-key',
    smsSenderKey: 'sms-key',
    ...extra,
  });
  return client;
};

/**
 * clientCalls — 템플릿/발송 응답을 분기하는 fetch 스텁 + 호출 기록.
 * send_alimtalk 은 발송 전에 (1) kakaoSenderKey 유무, (2) 템플릿 목록 조회를 먼저
 * 통과해야 한다. 여기서는 템플릿 목록과 발송 응답을 분리해, 실제 전송된 본문을
 * 호출 기록에서 그대로 검증할 수 있게 한다.
 *
 * @param {{templates?: any[], send?: any}} cfg
 *   templates: /notice-templates 응답 배열 (기본 [TEMPLATE_ORDER])
 *   send:      발송(/notices/send·/messages/send) 응답 객체
 */
const clientCalls = ({ templates = [TEMPLATE_ORDER], send = { data: { messageId: 'm-1' } } } = {}) => {
  return stubFetch((url) => {
    if (isToken(url)) return json({ data: { token: 'tok' } });
    if (/\/notice-templates/.test(url)) return json({ data: { templates } });
    if (/\/notices\/send$/.test(url) || /\/messages\/send$/.test(url)) return json(send);
    return json({ data: { messageId: 'm-1' } });
  });
};

test('send_alimtalk: 승인(APR)되지 않은 템플릿은 거부', async () => {
  stubFetch((url) => {
    if (isToken(url)) return json({ data: { token: 'tok' } });
    if (/\/notice-templates/.test(url)) {
      return json({ data: { templates: [{ ...TEMPLATE_ORDER, inspectionStatus: 'REJ' }] } });
    }
    return json({ data: { messageId: 'm-1' } });
  });

  const h = createHandlers(new SendgoClient({ ...FAKE, kakaoSenderKey: 'kakao-key' }));
  await assert.rejects(
    () =>
      h.send_alimtalk({
        templateCode: 'ORDER_CONFIRM_001',
        recipients: [{ phone: '01012345678', vars: { name: '홍길동', orderNo: 'ORD-1' } }],
      }),
    /REJ|APR/
  );
});

test('send_alimtalk: 템플릿에 없는 변수를 보내면 거부', async () => {
  const h = createHandlers(clientWith({ kakaoSenderKey: 'kakao-key' }));
  await assert.rejects(
    () =>
      h.send_alimtalk({
        templateCode: 'ORDER_CONFIRM_001',
        recipients: [{ phone: '01012345678', vars: { name: '홍길동', orderNo: 'ORD-1', ghost: 'x' } }],
      }),
    /없는 변수/
  );
});

test('send_alimtalk: replaceSms=Y 인데 smsSenderKey 없으면 거부', async () => {
  const h = createHandlers(clientWith({ smsSenderKey: undefined }));
  await assert.rejects(
    () =>
      h.send_alimtalk({
        templateCode: 'ORDER_CONFIRM_001',
        recipients: [{ phone: '01012345678', vars: { name: '홍길동', orderNo: 'ORD-1' } }],
        fallbackSms: { content: '안내' },
      }),
    /SENDGO_SMS_SENDER_KEY|senderKey/
  );
});

test('send_alimtalk: 90바이트 초과 대체문구는 subject 요구', async () => {
  const h = createHandlers(clientWith({ smsSenderKey: 'smskey' }));
  await assert.rejects(
    () =>
      h.send_alimtalk({
        templateCode: 'ORDER_CONFIRM_001',
        recipients: [{ phone: '01012345678', vars: { name: '홍길동', orderNo: 'ORD-1' } }],
        fallbackSms: { content: '가'.repeat(60) }, // 120바이트
      }),
    /90바이트/
  );
});

test('send_alimtalk: 정상 본문은 스펙 필드명으로 전송된다', async () => {
  const calls = clientCalls({
    templates: [TEMPLATE_ORDER],
    send: { data: { messageId: 'm-1' } },
  });
  const client = new SendgoClient({ ...FAKE, kakaoSenderKey: 'kakao-key', smsSenderKey: 'sms-key' });

  const h = createHandlers(client);
  const out = await h.send_alimtalk({
    templateCode: 'ORDER_CONFIRM_001',
    recipients: [{ phone: '010-1234-5678', vars: { name: '홍길동', orderNo: 'ORD-1' } }],
    fallbackSms: { content: '주문이 접수되었습니다.', subject: '[안내]' },
  });

  const api = calls.find((c) => /\/notices\/send$/.test(c.url));
  assert.ok(api, 'notices/send 를 호출해야 한다');
  const body = JSON.parse(api.init.body);

  assert.equal(body.scheduleType, 'DIRECTLY');
  assert.equal(body.templateCode, 'ORDER_CONFIRM_001');
  assert.equal(body.kakaoSenderKey, 'kakao-key');
  assert.equal(body.replaceSms, 'Y');
  assert.equal(body.senderKey, 'sms-key');
  assert.equal(body.contacts[0].contact, '01012345678', '하이픈 제거');
  assert.equal(body.contacts[0].name, '홍길동', '템플릿 변수명 그대로 전달');
  assert.equal(body.contacts[0].orderNo, 'ORD-1');
  assert.equal(out.messageId, 'm-1');
});

test('send_alimtalk: 결과 조회 엔드포인트가 없음을 응답에 명시', async () => {
  clientCalls({ templates: [TEMPLATE_ORDER], send: { data: { messageId: 'm-2' } } });
  const h = createHandlers(new SendgoClient({ ...FAKE, kakaoSenderKey: 'kakao-key' }));

  const out = await h.send_alimtalk({
    templateCode: 'ORDER_CONFIRM_001',
    recipients: [{ phone: '01012345678', vars: { name: '홍길동', orderNo: 'ORD-2' } }],
  });

  assert.match(out.note, /웹훅/);
});

test('send_sms: LMS 는 subject 필수', async () => {
  const h = createHandlers(clientWith({ smsSenderKey: 'smskey' }));
  await assert.rejects(
    () =>
      h.send_sms({
        messageType: 'LMS',
        content: '장문',
        recipients: [{ phone: '01012345678' }],
      }),
    /subject/
  );
});

test('send_sms: senderKey 없으면 거부', async () => {
  const h = createHandlers(clientWith({ smsSenderKey: undefined }));
  await assert.rejects(
    () => h.send_sms({ content: 'x', recipients: [{ phone: '01012345678' }] }),
    /senderKey/
  );
});

test('send_sms: 정상 본문 전송 확인', async () => {
  const calls = stubFetch((url) =>
    isToken(url) ? json({ data: { token: 'tok' } }) : json({ data: { messageId: 's-1' } })
  );
  const client = new SendgoClient(FAKE);
  client.smsSenderKey = 'smskey';

  const out = await createHandlers(client).send_sms({
    messageType: 'LMS',
    subject: '점검 안내',
    content: '점검합니다',
    recipients: [{ phone: '01012345678' }],
  });

  const body = JSON.parse(calls.find((c) => /\/messages\/send$/.test(c.url)).init.body);
  assert.equal(body.campaignType, 'MESSAGE');
  assert.equal(body.messageType, 'LMS');
  assert.equal(body.subject, '점검 안내');
  assert.equal(body.senderKey, 'smskey');
  assert.equal(out.messageId, 's-1');
});

// ── 검증 헬퍼 ─────────────────────────────────────────────────────────────

test('validatePhone: 휴대폰만 허용, 하이픈 제거', () => {
  assert.equal(validatePhone('010-1234-5678'), '01012345678');
  assert.equal(validatePhone(' 01012345678 '), '01012345678');
  assert.throws(() => validatePhone('0212345678'), /형식/);
  assert.throws(() => validatePhone('010-123-456'), /형식/);
  assert.throws(() => validatePhone(''), /형식/);
});

test('resolveTemplateParams: 누락/초과 변수 감지', () => {
  assert.throws(() => resolveTemplateParams(['var1'], {}), /누락/);
  assert.deepEqual(resolveTemplateParams(['var1'], { var1: 'a', var9: 'b' }).extras, ['var9']);
  assert.deepEqual(resolveTemplateParams(['var1'], { var1: 'a' }).params, { var1: 'a' });
});

// ── 로그 마스킹 ───────────────────────────────────────────────────────────

test('redact: 비밀은 가리고 안내 문장은 보존', () => {
  assert.ok(!redact('SENDGO_ACCESS_KEY=abc123').includes('abc123'));
  assert.ok(!redact('Bearer eyJhbGciOi').includes('eyJhbGciOi'));
  assert.ok(!redact('Basic YWJjZGVmZ2hpams=').includes('YWJjZGVmZ2hpams='));

  // 변수명만 나열한 안내 문장이 망가지면 사용자가 무엇을 설정해야 할지 알 수 없다.
  const guide = 'SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY 환경변수를 설정하세요';
  assert.equal(redact(guide), guide);
});

test('SendgoClient: 정책 검증 실패는 원본 코드를 보존', async () => {
  stubFetch((url) =>
    isToken(url)
      ? json({ data: { token: 'tok' } })
      : json(
          {
            code: 'POLICY_VALIDATION_FAILED',
            message: '알림톡 정책 위반',
            errors: [{ code: 'POLICY_VALIDATION_FAILED', message: '광고성 내용' }],
          },
          400
        )
  );

  await assert.rejects(
    () => new SendgoClient(FAKE).request('/notices/send', { method: 'POST', body: {} }),
    (err) =>
      err instanceof SendgoError &&
      err.code === 'POLICY_VALIDATION_FAILED' &&
      err.status === 400
  );
});

test('SendgoClient: 204 는 null', async () => {
  stubFetch((url) =>
    isToken(url) ? json({ data: { token: 'tok' } }) : new Response(null, { status: 204 })
  );
  assert.equal(await new SendgoClient(FAKE).request('/x', {}), null);
});

// ── createHandlers: 검증 실패 경로 (모두 스텁 클라이언트 사용) ──────────────

/** 실제 HTTP 없이 createHandlers 만 검증하기 위한 스텁 클라이언트. */
const stubClient = (extra = {}) => {
  const calls = [];
  return {
    ...extra,
    calls,
    request: async (path, init) => {
      calls.push({ path, init });
      if (/notice-templates/.test(path)) return { data: { templates: [TEMPLATE_ORDER] } };
      return { data: { messageId: 'm-stub' } };
    },
  };
};

test('createHandlers: 템플릿 목록 조회는 요청 파라미터를 그대로 전달', async () => {
  const client = stubClient({ kakaoSenderKey: 'kakao-key' });
  const out = await createHandlers(client).list_alimtalk_templates({
    inspectionStatus: 'REJ',
    search: 'ORDER',
    count: '50',
  });

  const [call] = client.calls;
  const params = new URL(call.path, 'https://x').searchParams;
  assert.equal(params.get('inspectionStatus'), 'REJ');
  assert.equal(params.get('kakaoSenderKey'), 'kakao-key');
  assert.equal(params.get('search'), 'ORDER');
  assert.equal(params.get('count'), '50');
  assert.equal(out.templates.length, 1);
  assert.deepEqual(out.templates[0].variableKeys, ['name', 'orderNo']);
});

test('createHandlers: send_alimtalk — templateCode 누락 시 거부', async () => {
  const client = stubClient({ kakaoSenderKey: 'kakao-key' });
  await assert.rejects(
    () => createHandlers(client).send_alimtalk({ recipients: [{ phone: '01012345678' }] }),
    /templateCode/
  );
  assert.equal(client.calls.length, 0, '검증 실패 시 API 를 호출하면 안 된다');
});

test('createHandlers: send_alimtalk — recipients 가 비면 거부', async () => {
  const client = stubClient({ kakaoSenderKey: 'kakao-key' });
  await assert.rejects(
    () => createHandlers(client).send_alimtalk({ templateCode: 'T1', recipients: [] }),
    /recipients/
  );
  assert.equal(client.calls.length, 0);
});

test('createHandlers: send_alimtalk — kakaoSenderKey 없으면 거부', async () => {
  const client = stubClient();
  await assert.rejects(
    () => createHandlers(client).send_alimtalk({ templateCode: 'T1', recipients: [{ phone: '01012345678' }] }),
    /kakaoSenderKey/
  );
  assert.equal(client.calls.length, 0);
});

test('createHandlers: send_alimtalk — 템플릿 목록에 없는 코드는 거부', async () => {
  const client = stubClient({ kakaoSenderKey: 'kakao-key' });
  await assert.rejects(
    () =>
      createHandlers(client).send_alimtalk({
        templateCode: 'NOT_IN_LIST',
        recipients: [{ phone: '01012345678' }],
      }),
    /찾을 수 없습니다/
  );
});

test('createHandlers: send_alimtalk — 수신자 전화번호 형식 오류는 거부', async () => {
  const client = stubClient({ kakaoSenderKey: 'kakao-key' });
  await assert.rejects(
    () =>
      createHandlers(client).send_alimtalk({
        templateCode: 'ORDER_CONFIRM_001',
        recipients: [{ phone: '0212345678' }],
      }),
    /형식/
  );
});

test('createHandlers: send_sms — content 누락 시 거부', async () => {
  const client = stubClient({ smsSenderKey: 'sms-key' });
  await assert.rejects(
    () => createHandlers(client).send_sms({ recipients: [{ phone: '01012345678' }] }),
    /content/
  );
  assert.equal(client.calls.length, 0);
});

test('createHandlers: send_sms — recipients 가 비면 거부', async () => {
  const client = stubClient({ smsSenderKey: 'sms-key' });
  await assert.rejects(
    () => createHandlers(client).send_sms({ content: 'x', recipients: [] }),
    /recipients/
  );
  assert.equal(client.calls.length, 0);
});

test('createHandlers: send_sms — SMS 한도 초과 + subject 없으면 거부', async () => {
  const client = stubClient({ smsSenderKey: 'sms-key' });
  await assert.rejects(
    () => createHandlers(client).send_sms({ content: '가'.repeat(50), recipients: [{ phone: '01012345678' }] }),
    /90바이트/
  );
  assert.equal(client.calls.length, 0);
});

test('createHandlers: send_sms — 한도 초과 시 LMS 로 자동 승격', async () => {
  const client = stubClient({ smsSenderKey: 'sms-key' });
  const out = await createHandlers(client).send_sms({
    content: '가'.repeat(50),
    subject: '[안내]',
    recipients: [{ phone: '01012345678' }],
  });

  const raw = client.calls.find((c) => /messages\/send/.test(c.path)).init.body;
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  assert.equal(body.messageType, 'LMS');
  assert.equal(out.messageType, 'LMS');
  assert.equal(out.byteLength, 100);
});

test('createHandlers: list_kakao_senders — data.senders 봉투를 정규화', async () => {
  const client = {
    request: async () => ({ data: { senders: [{ kakaoSenderKey: 'k-1' }] } }),
  };
  const out = await createHandlers(client).list_kakao_senders();
  assert.deepEqual(out.senders, [{ kakaoSenderKey: 'k-1' }]);
});

test('createHandlers: list_kakao_senders — 배열 응답도 허용', async () => {
  const client = { request: async () => [{ kakaoSenderKey: 'k-2' }] };
  const out = await createHandlers(client).list_kakao_senders();
  assert.deepEqual(out.senders, [{ kakaoSenderKey: 'k-2' }]);
});
