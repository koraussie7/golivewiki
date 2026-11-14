/**
 * 동시 예약 검증 (플랜 8장 "재고": 마지막 한 개를 동시 요청해 한 건만 성공).
 *
 * 단일 psql 세션으로는 교착/직렬화를 재현할 수 없어서 POSTGRES 클라이언트를
 * 여러 개 열어 같은 순간에 RPC 를 보낸다. RPC 를 보내기 직전에 advisory lock 으로
 * 출발 신호를 맞춰, 두 트랜잭션이 실제로 겹치게 만든다.
 *
 *   docker exec gig_postgres ... 로 준비된 banchan_test 사용
 *   node tests/banchan-concurrency.mjs
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(
  process.env.REPO_PKG ||
    "/Users/brianyeon/Domains/golive.wiki/golivewiki/package.json",
);
let pg;
try {
  pg = require("pg");
} catch {
  console.error(
    "pg 모듈이 필요합니다: cd ~/Domains/golive.wiki/golivewiki && npm i pg --no-save",
  );
  process.exit(2);
}

const CONTAINER = process.env.PG_CONTAINER || "gig_postgres";
const DB = process.env.BANCHAN_TEST_DB || "banchan_test";
const USER = process.env.PG_USER || process.env.PGUSER || "gig_admin";

// 두 가지 실행 환경을 모두 지원한다:
//   로컬 - 도커 컨테이너 gig_postgres (호스트 포트 5433)
//   CI   - GitHub Actions 서비스 컨테이너가 노출한 127.0.0.1:5432 (도커 없음)
// PG_HOST/PG_PORT 가 지정되거나 도커가 없으면 psql 직접 연결을 쓴다.
// 커넥션 대상이 컨테이너 안이 아니라 호스트 포트라면 직접 연결이다.
// (로컬 재현용으로 다른 컨테이너를 띄우는 경우가 있다)
const HAS_DOCKER = (() => {
  try {
    execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
})();
// PG_DIRECT=1 이면 무조건 직접 연결. 아니면 호스트/포트가 주어졌거나 도커가 없을 때.
const USE_DIRECT =
  process.env.PG_DIRECT === "1" ||
  Boolean(process.env.PG_HOST || process.env.PGHOST) ||
  !HAS_DOCKER;

// PG_HOST/PG_PORT 를 우선하고, 없으면 psql 관례인 PGHOST/PGPORT 를 따른다.
const HOST = process.env.PG_HOST || process.env.PGHOST || "127.0.0.1";
// 컨테이너 안의 postgres 는 5432, 로컬 호스트에 노출된 포트는 5433 (docker ps 로 확인)
const PORT = Number(process.env.PG_PORT || process.env.PGPORT || 5433);

function sql(q) {
  const args = USE_DIRECT
    ? ["-At", "-v", "ON_ERROR_STOP=1", "-c", q]
    : ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB, "-At", "-v", "ON_ERROR_STOP=1", "-c", q];
  // 도커 경로에서는 PGPASSWORD 가 무의미하다. 직접 연결이면 접속 정보를 명시한다.
  const env = USE_DIRECT
    ? { ...process.env, PGHOST: HOST, PGPORT: String(PORT), PGUSER: USER, PGDATABASE: DB }
    : process.env;
  return execFileSync(USE_DIRECT ? "psql" : "docker", args, {
    encoding: "utf8",
    env,
  }).trim();
}

// --- fixture: 재고 1개짜리 회차 + 두 사용자 ---------------------------------
const ids = JSON.parse(
  sql(`
    with ins_city as (
      -- 재실행 가능하게: 이미 있으면 아무 것도 하지 않는다
      insert into public.cities (country_code, name, timezone, latitude, longitude)
      values ('KR', 'Concurrency City', 'Asia/Seoul', 37.5, 127.0)
      on conflict do nothing
      returning id
    ), c as (
      select id from ins_city
      union all
      select id from public.cities where country_code = 'KR' and lower(name) = 'concurrency city'
      limit 1
    ), u as (
      insert into auth.users (id) values (gen_random_uuid()), (gen_random_uuid())
      returning id
    ), s as (
      insert into public.sellers (owner_user_id, city_id, name, public_address, latitude, longitude, approval_status)
      select (select id from u limit 1), c.id, 'Race Seller', 'addr', 37.5, 127.0, 'approved' from c
      returning id
    ), d as (
      insert into public.dishes (seller_id, name, category, status)
      select s.id, 'Last one', 'banchan', 'active' from s returning id
    ), o as (
      insert into public.dish_offers (dish_id, service_date, currency, unit_price_minor, order_deadline,
        pickup_start, pickup_end, min_qty, max_qty, pickup_place, status)
      select d.id, current_date + 1, 'KRW', 10000,
        now() + interval '1 day', now() + interval '1 day 2 hours', now() + interval '1 day 3 hours',
        null, 1, 'Spot', 'open'
      from d returning id
    )
    select json_build_object(
      'users', (select json_agg(id) from u),
      'offer', (select id from o)
    )::text;
  `),
);

const [userA, userB] = ids.users;

const client = (uid) =>
  new pg.Client({
    host: HOST,
    port: PORT,
    database: DB,
    user: USER,
    // PGPASSWORD 가 없으면 환경을 따른다(로컬 dev 컨테이너). CI 는 gig_admin 을 준다.
    password: process.env.PGPASSWORD || "changeme",
  });

async function book(uid, qty) {
  const c = client(uid);
  await c.connect();
  await c.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await c.query(
    "select set_config('request.jwt.claim.role', 'authenticated', false)",
  );
  await c.query("set role authenticated");
  return c;
}

const a = await book(userA);
const b = await book(userB);

// 동시 출발 게이트: 두 세션 모두 트랜잭션을 열고 offer 행을 잠근 뒤 기다린다.
// 게이트(advisory lock)가 풀리는 순간 양쪽이 동시에 INSERT 를 시도한다.
const LOCK = 987654321;
const gate = client(userA);
await gate.connect();
await gate.query("select pg_advisory_lock($1)", [LOCK]); // 게이트 소유

async function raceOne(c, who, contact) {
  try {
    await c.query("begin");
    // 같은 순간에 offer 행 잠금을 걸고 게이트를 기다린다
    await c.query("select 1 from public.dish_offers where id = $1 for update", [ids.offer]);
    await c.query("select pg_advisory_xact_lock_shared($1)", [LOCK]);
    const r = await c.query(
      "select * from public.banchan_create_preorder($1, $2, 'phone', $3)",
      [ids.offer, 1, contact]
    );
    await c.query("commit");
    return { who, ok: true, code: r.rows[0]?.reservation_code };
  } catch (e) {
    await c.query("rollback").catch(() => {});
    return { who, ok: false, err: e.message };
  }
}

const t0 = Date.now();
const racing = Promise.all([raceOne(a, "A", "010-0000-0001"), raceOne(b, "B", "010-0000-0002")]);
// 두 세션이 게이트 대기에 들어간 것을 확인하고 풀어준다
await new Promise((r) => setTimeout(r, 400));
await gate.query("select pg_advisory_unlock($1)", [LOCK]);
const race = await racing;
await gate.end().catch(() => {});

const okCount = race.filter((r) => r.ok).length;
const booked = Number(
  sql(
    `select count(*) from public.banchan_preorders where offer_id = '${ids.offer}'`,
  ),
);
const overbooked = Number(
  sql(
    `select coalesce(sum(qty),0) from public.banchan_preorders where offer_id = '${ids.offer}'`,
  ),
);

console.log(
  JSON.stringify(
    { elapsedMs: Date.now() - t0, race, okCount, booked, overbooked },
    null,
    1,
  ),
);

const pass = okCount === 1 && booked === 1 && overbooked === 1;
console.log(
  `\n${pass ? "PASS" : "FAIL"}  exactly one of two racing requests succeeded (booked=${booked}, qty=${overbooked})`,
);

// cleanup
sql(`delete from public.banchan_preorders where offer_id = '${ids.offer}'`);
for (const c of [a, b]) await c.end().catch(() => {});
process.exit(pass ? 0 : 1);
