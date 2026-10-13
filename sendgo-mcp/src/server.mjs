#!/usr/bin/env node
/**
 * sendgo-mcp — KBizHub Business MCP 서버 (카카오 알림톡/SMS).
 *
 * transport: stdio (MCP 표준). Claude Desktop / Cursor / KBizHub Gateway 에서
 * child process 로 실행된다.
 *
 * 자격증명은 환경변수로만 주입한다. 인자·로그·에러 메시지에 노출 금지.
 *   SENDGO_ACCESS_KEY, SENDGO_SECRET_KEY   (필수)
 *   SENDGO_API_VERSION   v1 | v2           (기본 v2)
 *   SENDGO_BASE_URL                         (기본 https://sendgo.io)
 *   SENDGO_KAKAO_SENDER_KEY                 (선택 — 기본 발신프로필)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SendgoClient } from './client.mjs';
import { TOOLS, createHandlers } from './tools.mjs';

/**
 * 비밀값 마스킹 — 에러 메시지에 키가 새어나가지 않게 한다.
 *
 * 구분자는 `=` 또는 `:` 만 인정한다. 공백을 구분자로 넣으면
 * "SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY" 처럼 변수명만 나열한 안내 문장까지
 * 삼켜 버리므로 의도적으로 제외했다 (값이 아닌 이름은 노출해도 안전).
 */
export function redact(text) {
  return String(text)
    .replace(/(SENDGO_[A-Z_]*KEY["']?\s*[=:]\s*["']?)\S+/gi, '$1***')
    .replace(/((?:access|secret)[-_]?key["']?\s*[=:]\s*["']?)\S+/gi, '$1***')
    .replace(/(Bearer\s+)\S+/gi, '$1***')
    .replace(/(Basic\s+)[A-Za-z0-9+/=]{8,}/gi, '$1***');
}

export function buildClientFromEnv() {
  const accessKey = process.env.SENDGO_ACCESS_KEY;
  const secretKey = process.env.SENDGO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    // 서버는 시작하되 호출 시 명확히 실패 — 클라이언트는 도구 목록 조회가 가능해야 함.
    console.error('[sendgo-mcp] 경고: SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY 미설정. 도구 호출 시 실패합니다.');
    return null;
  }
  return new SendgoClient({
    accessKey,
    secretKey,
    apiVersion: process.env.SENDGO_API_VERSION || 'v2',
    baseUrl: process.env.SENDGO_BASE_URL,
    kakaoSenderKey: process.env.SENDGO_KAKAO_SENDER_KEY,
  });
}

export function createServer(clientFactory = buildClientFromEnv) {
  const server = new Server(
    { name: 'sendgo-mcp', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions:
        '카카오 알림톡/SMS 발송 도구. 발송 전 list_kakao_senders 로 발신프로필을, ' +
        'list_alimtalk_templates 로 승인된(APR) 템플릿과 변수명을 확인하세요. ' +
        '발송은 접수만 완료되며, Sendgo 스펙에 결과 조회 엔드포인트가 없으므로 ' +
        '실결과는 POST /{version}/webhook 구독으로 수신해야 합니다.',
    }
  );

  // 지연 초기화 — 키가 없어도 서버 기동과 도구 목록 조회는 가능해야 한다.
  let cachedClient;
  const getClient = () => {
    if (!cachedClient) cachedClient = clientFactory();
    if (!cachedClient) {
      throw new Error(
        'Sendgo 자격증명이 설정되지 않았습니다. SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY 환경변수를 확인하세요.'
      );
    }
    return cachedClient;
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      // 도구명 검증을 먼저 — 존재하지 않는 도구면 자격증명 유무와 무관하게 알려야 한다.
      if (!TOOLS.some((t) => t.name === name)) {
        return { isError: true, content: [{ type: 'text', text: `알 수 없는 도구: ${name}` }] };
      }

      const handlers = createHandlers(getClient());
      const result = await handlers[name](args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      // 입력 오류는 그대로, 시스템 오류는 마스킹.
      const message = redact(error?.message || String(error));
      console.error(`[sendgo-mcp] ${name} 실패:`, redact(error?.stack || message));
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });

  return server;
}

/** 직접 실행 시에만 transport 연결 (테스트 임포트 시에는 하지 않는다). */
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[sendgo-mcp] 준비 완료 (stdio)');
}
