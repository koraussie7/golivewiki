-- =============================================================================
-- tests/banchan-db-checks.sql — 플랜 8장 검증 (로컬 PG 전용)
--
-- 설계: 역할 전환은 PL/pgSQL 안에서 하지 않는다. `SET LOCAL` 은 트랜잭션 밖에서
-- 무시되고, `EXECUTE 'begin'` 은 PL/pgSQL 에서 금지된다(=위반사항인데 예전 테스트가
-- 통과한 이유다). 그래서 검사마다 psql 수준에서 BEGIN → SET LOCAL ROLE → SQL → ROLLBACK
-- 을 직접 쓴다. 실제 사용자로 실행되므로 RLS 가 진짜로 검사된다.
--
-- 실행: tests/run-db-tests.sh
-- 전제: 0005/0006 migration 적용된 banchan_test
-- =============================================================================



\set VERBOSITY terse
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off
\set QUIET off

-- 기대한 거부/오류가 나오면 카운트한다. rollback 에도 살아남도록 temp table 사용.
create temp table _denied (n int) on commit preserve rows;
insert into _denied values (0);

-- 기대한 거부가 실제로 일어났을 때만 호출된다(오류 다음 줄은 psql 이 건너뛴다).
create or replace function _probe_deny() returns text language sql as $$
  select 'RECORDED'; $$;

-- --- 픽스처 (소유자 권한으로 준비) ------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@test');

insert into public.cities (id, country_code, name, timezone, latitude, longitude)
values ('c0000000-0000-0000-0000-000000000001', 'KR', 'Test City', 'Asia/Seoul', 37.5, 127.0)
on conflict do nothing;

-- 가게 A: 승인, 소유자 a / 가게 B: 미승인, 소유자 b
insert into public.sellers (id, owner_user_id, city_id, name, public_address, latitude, longitude, approval_status, approved_at)
values
  ('50000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Shop A', 'addr A', 37.5, 127.0, 'approved', now()),
  ('50000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'Shop B pending', 'addr B', 37.5, 127.0, 'pending', null)
on conflict (id) do nothing;

insert into public.seller_members (seller_id, user_id, role) values
  ('50000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('50000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner')
on conflict do nothing;

insert into public.dishes (id, seller_id, name, category, allergens, status) values
  ('d0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', 'Banchan set', 'banchan', '{soy}', 'active'),
  ('d0000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-00000000000a', 'Kimchi 1kg', 'banchan', '{}', 'active'),
  ('d0000000-0000-0000-0000-00000000000c', '50000000-0000-0000-0000-00000000000b', 'Hidden dish', 'banchan', '{}', 'active')
on conflict (id) do nothing;

-- offer 1: 공동구매 goal 2 / max 2 → 첫 예약 pending, 두 번째에서 confirmed 및 품절
-- offer 2: 일반 예약(즉시 확정), max 10
-- offer 3: 마감 지난 회차
insert into public.dish_offers (id, dish_id, service_date, currency, unit_price_minor, currency_exponent,
  order_deadline, pickup_start, pickup_end, min_qty, max_qty, pickup_place, status)
values
  ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', current_date + 1,
   'KRW', 18000, 0, now() + interval '1 day', now() + interval '1 day 2 hours', now() + interval '1 day 4 hours',
   2, 2, 'Exit 2', 'open'),
  ('e0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000b', current_date + 2,
   'KRW', 12000, 0, now() + interval '1 day', now() + interval '1 day 3 hours', now() + interval '1 day 5 hours',
   null, 10, 'Exit 2', 'open'),
  ('e0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000b', current_date + 3,
   'KRW', 9000, 0, now() - interval '1 hour', now() + interval '1 day', now() + interval '1 day 2 hours',
   null, 5, 'Exit 2', 'open')
on conflict (id) do nothing;

-- 영상: 승인 1개 + 미승인 1개 (A 가게)
insert into public.dish_videos (seller_id, dish_id, storage_path, duration_seconds, moderation_status)
select '50000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a',
       'videos/a/ok.mp4', 15, 'approved'
where not exists (select 1 from public.dish_videos where storage_path = 'videos/a/ok.mp4');
insert into public.dish_videos (seller_id, dish_id, storage_path, duration_seconds, moderation_status)
select '50000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a',
       'videos/a/pending.mp4', 20, 'pending'
where not exists (select 1 from public.dish_videos where storage_path = 'videos/a/pending.mp4');

-- =============================================================================
-- 1) 익명: 예약 테이블 접근 불가 / 공개 뷰만 가능
-- =============================================================================
begin;
set local role anon;
select count(*) as c from public.banchan_preorders;  \echo (위에서 permission denied 가 나야 정상)
rollback;

begin;
set local role anon;
insert into public.banchan_preorders (offer_id, user_id, qty, reservation_code,
  unit_price_minor_snapshot, currency_snapshot, contact_method, contact_value)
values ('e0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'HACK',
  1, 'KRW', 'phone', '000');
\echo '>>> EXPECTED: permission denied 가 나야 정상: 클라이언트 직접 INSERT 금지)'
select _probe_deny() as recorded;
rollback;

-- =============================================================================
-- 2) 공개 조회: 승인 가게 1곳만, 미승인 가게/메뉴 비노출
-- =============================================================================
begin;
set local role anon;
select
  (select count(*) from public.sellers)                    as sellers_visible,
  (select count(*) from public.dishes)                      as dishes_visible,
  (select count(*) from public.dish_offers)                 as offers_visible;
rollback;

-- =============================================================================
-- 3) 예약 생성: a 는 offer1(공동구매) 1건 → pending
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select order_status, qty, total_minor, currency, reservation_code
from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000a', 1, 'phone', '010-1111-2222');
rollback;

-- 영속 버전 (이후 검사가 참조): a → offer1 1건
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select count(*) as created from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000a', 1, 'phone', '010-1111-2222');
select order_status as a_status from public.banchan_preorders where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- =============================================================================
-- 4) 같은 회차 중복 예약 차단 (재고 여유가 아니라 중복 규칙으로)
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select * from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000a', 1, 'phone', '010-1111-2222');
\echo '>>> EXPECTED: ALREADY_RESERVED 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

-- =============================================================================
-- 5) 공동구매: 두 번째 예약에서 목표 달성 → confirmed, 이후 품절
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select order_status as c_status from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000a', 1, 'phone', '010-3333-4444');
select order_status as a_status_after_goal from public.banchan_preorders
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select reserved_qty, max_qty from public.dish_offer_public where id = 'e0000000-0000-0000-0000-00000000000a';
rollback;

-- =============================================================================
-- 6) 재고 초과 / 마감 이후
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select * from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000a', 1, 'phone', '010-4444-5555');
\echo '>>> EXPECTED: SOLD_OUT 이 나야 정상: goal 2/max 2 회차가 이미 a 로 1건 채워짐 + c 는 rollback 됨 → 이 요청은 성공한다)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select * from public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000c', 1, 'phone', '010-4444-5555');
\echo '>>> EXPECTED: DEADLINE_PASSED 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

-- =============================================================================
-- 7) 가게/사용자 격리
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select
  (select count(*) from public.banchan_preorders)             as b_sees_orders,
  (select count(*) from public.sellers)                        as b_sees_sellers,
  (select count(*) from public.dish_offers)                    as b_sees_offers;
rollback;

-- b 가 a 의 예약을 취소 시도 → 존재 자체를 숨긴다
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.banchan_cancel_preorder((select id from public.banchan_preorders where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
\echo '>>> EXPECTED: PREORDER_NOT_FOUND 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

-- =============================================================================
-- 8) 관리자 승격 / 자기 승인 차단
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.banchan_admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
\echo '>>> EXPECTED: permission denied 가 나야 정상: 관리자 승격 불가)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update public.sellers set approval_status = 'approved' where id = '50000000-0000-0000-0000-00000000000b'
  returning approval_status;
\echo '>>> EXPECTED: approval_status is managed by the operator 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

-- 운영자(service_role)는 승인할 수 있다
begin;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.sellers set approval_status = 'approved', approved_at = now()
 where id = '50000000-0000-0000-0000-00000000000b' returning name, approval_status;
rollback;

-- =============================================================================
-- 9) 영상: 승인 상태 자기 변경 차단, 남의 가게 메뉴 차단, 형식/길이 검증
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update public.dish_videos set moderation_status = 'approved' where storage_path = 'videos/a/pending.mp4';
\echo '>>> EXPECTED: moderation_status is managed by the operator 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.dish_videos (seller_id, dish_id, storage_path, duration_seconds)
values ('50000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000c', 'videos/a/x.mp4', 10);
\echo '>>> EXPECTED: does not belong to seller / row-level security 가 나야 정상: 남의 가게 메뉴)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.dish_videos (seller_id, dish_id, storage_path, duration_seconds)
values ('50000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 'videos/a/long.mp4', 45);
\echo '>>> EXPECTED: duration_seconds check 위반이 나야 정상)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.dish_videos (seller_id, dish_id, storage_path, duration_seconds, moderation_status)
values ('50000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 'videos/a/y.mp4', 10, 'approved');
\echo '>>> EXPECTED: row-level security policy 위반이 나야 정상: 셀프 승인)'
select _probe_deny() as recorded;
rollback;

-- 익명이 보는 영상 수 = 승인 1개
begin;
set local role anon;
select count(*) as anon_videos from public.dish_videos;
rollback;

-- =============================================================================
-- 10) 가격 스냅샷 불변
-- =============================================================================
update public.dish_offers set unit_price_minor = 99000 where id = 'e0000000-0000-0000-0000-00000000000a';
select unit_price_minor_snapshot as frozen, unit_price_minor as current
from public.banchan_preorders, public.dish_offers
where public.banchan_preorders.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and public.dish_offers.id = 'e0000000-0000-0000-0000-00000000000a';

-- =============================================================================
-- 11) 수령/결제: 다른 가게 불가, 자기 가게 가능
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select * from public.banchan_mark_collected((select id from public.banchan_preorders where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
\echo '>>> EXPECTED: PREORDER_NOT_FOUND 가 나야 정상)'
select _probe_deny() as recorded;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select * from public.banchan_mark_collected((select id from public.banchan_preorders where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
\echo '>>> EXPECTED: collected/paid 가 나와야 정상)'
select _probe_deny() as recorded;
rollback;

-- =============================================================================
-- 12) 정의 검증: security definer 함수의 search_path 고정 + anon 실행 불가
-- =============================================================================
select p.proname,
       p.prosecdef as security_definer,
       array_to_string(p.proconfig, ',') as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('banchan_create_preorder','banchan_cancel_preorder','banchan_mark_collected',
                    'banchan_mark_no_show','is_seller_member')
order by p.proname;

begin;
set local role anon;
select public.banchan_create_preorder('e0000000-0000-0000-0000-00000000000b', 1, 'phone', '010-0000-0000');
\echo '>>> EXPECTED: permission denied for function 이 나야 정상: anon 은 예약 불가)'
select _probe_deny() as recorded;
rollback;

select 'done' as status;
