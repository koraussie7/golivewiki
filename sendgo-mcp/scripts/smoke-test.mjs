/**
 * 스모크 테스트 — 실제 MCP 프로토콜(stdio)로 서버를 띄워 검증한다.
 *
 * 외부 API 호출은 하지 않는다 (키 불필요).
 * 검증 대상: 핸드셰이크 · tools/list · tools/call 에러 경로 · 입력 검증 · 마스킹.
 *
 * 실행: node scripts/smoke-test.mjs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../src/server.mjs');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

// 자격증명 없이 띄운다 — 도구 목록은 되고, 호출은 명확히 실패해야 한다.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env, SENDGO_ACCESS_KEY: '', SENDGO_SECRET_KEY: '' },
  stderr: 'pipe',
});

const client = new Client({ name: 'smoke-test', version: '0.0.1' }, { capabilities: {} });

console.log('\n[sendgo-mcp] smoke test\n');
await client.connect(transport);

// 1. tools/list
const { tools } = await client.listTools();
console.log('1) tools/list');
check('4 tools exposed', tools.length === 4, `got ${tools.length}`);
const names = tools.map((t) => t.name).sort();
check(
  'tool names',
  JSON.stringify(names) ===
    JSON.stringify(
      ['list_alimtalk_templates', 'list_kakao_senders', 'send_alimtalk', 'send_sms'].sort()
    ),
  names.join(',')
);
check(
  'all have object inputSchema',
  tools.every((t) => t.inputSchema?.type === 'object')
);
check(
  'send_alimtalk requires templateCode+recipients',
  (() => {
    const req = tools.find((t) => t.name === 'send_alimtalk')?.inputSchema?.required || [];
    return req.includes('templateCode') && req.includes('recipients');
  })()
);

// 2. unknown tool
console.log('\n2) tools/call -- unknown tool');
const unknown = await client.callTool({ name: 'does_not_exist', arguments: {} });
check('isError=true', unknown.isError === true);
check('error mentions tool name', /does_not_exist/.test(unknown.content?.[0]?.text || ''));

// 3. missing credentials
console.log('\n3) tools/call -- no credentials');
const noCred = await client.callTool({ name: 'list_kakao_senders', arguments: {} });
const noCredText = noCred.content?.[0]?.text || '';
check('isError=true', noCred.isError === true);
check('points at env vars', /SENDGO_ACCESS_KEY/.test(noCredText), noCredText);

// 4. redaction
console.log('\n4) secret redaction');
const { redact } = await import('../src/server.mjs');
check('env key redacted', redact('SENDGO_SECRET_KEY=abc123') === 'SENDGO_SECRET_KEY=***');
check('Bearer redacted', redact('Authorization: Bearer eyJhbGciOi') === 'Authorization: Bearer ***');
check('Basic redacted', redact('Basic YWJjZGVmZ2hpams=') === 'Basic ***');
// 회귀 방지: 변수명만 나열한 안내 문장은 삼키면 안 된다 (값이 아닌 이름은 안전).
const helpMsg =
  'Sendgo 자격증명이 설정되지 않았습니다. SENDGO_ACCESS_KEY / SENDGO_SECRET_KEY 환경변수를 확인하세요.';
check(
  'variable-name guidance NOT mangled',
  redact(helpMsg) === helpMsg,
  redact(helpMsg)
);
check('still masks a real secret', /SENDGO_ACCESS_KEY=abc123/.test(redact('SENDGO_ACCESS_KEY=abc123')) === false);

// 5. template var coherence (pure fn)
console.log('\n5) template param coherence');
const { resolveTemplateParams } = await import('../src/tools.mjs');
let missingThrew = false;
try {
  resolveTemplateParams(['var1', 'var2'], { var1: 'a' });
} catch {
  missingThrew = true;
}
check('rejects missing var', missingThrew === true);

const { params, extras } = resolveTemplateParams(['var1'], { var1: 'a', var9: 'b' });
check('detects extra var', extras.length === 1 && extras[0] === 'var9');
check('passes declared var', params.var1 === 'a');

// 6. phone validation
console.log('\n6) phone validation');
const { validatePhone } = await import('../src/tools.mjs');
check('accepts 01012345678', validatePhone('01012345678') === '01012345678');
check('strips hyphens', validatePhone('010-1234-5678') === '01012345678');
let badThrew = false;
try {
  validatePhone('02-123-4567');
} catch {
  badThrew = true;
}
check('rejects landline', badThrew === true);

await client.close();

console.log(`\n[sendgo-mcp] ${passed} passed / ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
