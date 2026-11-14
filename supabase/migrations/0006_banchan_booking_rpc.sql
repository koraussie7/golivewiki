-- =============================================================================
-- 0006_banchan_booking_rpc.sql — 예약 생성/취소/수령 RPC (플랜 6장 동시성)
--
-- 왜 RPC 인가
--  - 가격·통화·상태를 고객이 보내면 안 된다. 서버가 offer 를 읽어 스냅샷을 남긴다.
--  - 마지막 재고 동시 예약을 막으려면 offer 행을 잠그고(sum FOR UPDATE) 다시 계산해야 한다.
--  - 클라이언트에 INSERT 권한을 주면 위 두 규칙을 우회할 수 있다 → INSERT 는 service_role 전용.
--
-- 공통 규칙
--  - security definer + search_path 고정 + 인자 검증 + EXECUTE 는 authenticated 만.
--  - 마감 판단은 서버 시각(now()) 기준. 클라이언트 시각을 받지 않는다.
--  - 오류는 errcode/message 로 구분해 UI 가 정확한 실패를 보여주게 한다.
-- =============================================================================

begin;

-- --- 예약 번호 생성 ---------------------------------------------------------
-- 사람이 전화/채팅으로 읽을 수 있는 12자. 헷갈리는 0/O/1/I 제외.
create or replace function public.banchan_new_reservation_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..12 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    if i in (4, 8) then code := code || '-'; end if;
  end loop;
  return code;
end;
$$;
revoke all on function public.banchan_new_reservation_code() from public, anon, authenticated;

-- --- 남은 수량 / 목표 상태 계산 (잠금 후 호출 전용) -------------------------
create or replace function public.banchan_offer_usage(p_offer_id uuid)
returns table (reserved_qty int, max_qty int, min_qty int)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(p.qty) filter (where p.order_status in ('pending', 'confirmed', 'collected')), 0)::int,
    o.max_qty,
    o.min_qty
  from public.dish_offers o
  left join public.banchan_preorders p on p.offer_id = o.id
  where o.id = p_offer_id
  group by o.max_qty, o.min_qty;
$$;

-- =============================================================================
-- 예약 생성
-- =============================================================================
create or replace function public.banchan_create_preorder(
  p_offer_id       uuid,
  p_qty            int,
  p_contact_method public.banchan_contact_method,
  p_contact_value  text
)
returns table (
  preorder_id      uuid,
  reservation_code text,
  order_status     public.banchan_order_status,
  qty              int,
  total_minor      bigint,
  currency         char(3),
  currency_exponent smallint,
  pickup_start     timestamptz,
  pickup_end       timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_offer    public.dish_offers%rowtype;
  v_dish     public.dishes%rowtype;
  v_seller   public.sellers%rowtype;
  v_reserved int;
  v_qty      int;
  v_status   public.banchan_order_status;
  v_code     text;
  v_id       uuid;
begin
  -- 1) 인증
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- 2) 입력 검증
  if p_qty is null or p_qty < 1 then
    raise exception 'INVALID_QTY: qty must be a positive integer' using errcode = '22023';
  end if;
  if p_contact_value is null or length(btrim(p_contact_value)) < 3 or length(btrim(p_contact_value)) > 120 then
    raise exception 'INVALID_CONTACT: contact must be 3-120 chars' using errcode = '22023';
  end if;

  -- 3) offer 행 잠금 (동시 예약 직렬화). 잠금 순서: offer -> (필요시) dish/seller 읽기
  select * into v_offer
  from public.dish_offers o
  where o.id = p_offer_id
  for update;

  if not found then
    raise exception 'OFFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 4) 공개 조건 (승인 가게 + active 메뉴)
  select * into v_dish from public.dishes d where d.id = v_offer.dish_id;
  select * into v_seller from public.sellers s where s.id = v_dish.seller_id;
  if v_dish.status is distinct from 'active'
     or v_seller.approval_status is distinct from 'approved' then
    raise exception 'OFFER_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- 5) 상태·마감 (서버 시각)
  if v_offer.status is distinct from 'open' then
    raise exception 'OFFER_CLOSED: status is %', v_offer.status using errcode = 'P0001';
  end if;
  if now() >= v_offer.order_deadline then
    raise exception 'DEADLINE_PASSED' using errcode = 'P0001';
  end if;

  -- 6) 수량: 잠금 상태에서 다시 집계
  select u.reserved_qty into v_reserved
  from public.banchan_offer_usage(v_offer.id) u;

  v_qty := p_qty;
  if v_reserved + v_qty > v_offer.max_qty then
    raise exception 'SOLD_OUT: requested % but only % left', v_qty, (v_offer.max_qty - v_reserved)
      using errcode = 'P0001';
  end if;

  -- 7) 중복 활성 예약 차단 (부분 유니크 인덱스와 같은 규칙을 먼저 명확히 알려준다)
  if exists (
    select 1 from public.banchan_preorders p
    where p.offer_id = v_offer.id
      and p.user_id = v_uid
      and p.order_status in ('pending', 'confirmed', 'collected')
  ) then
    raise exception 'ALREADY_RESERVED' using errcode = '23505';
  end if;

  -- 8) 공동구매면 목표 달성 여부에 따라 confirmed 로 승격할 수 있다.
  if v_offer.min_qty is null then
    v_status := 'confirmed';                       -- 일반 예약: 즉시 확정
  elsif v_reserved + v_qty >= v_offer.min_qty then
    v_status := 'confirmed';                       -- 이번 예약으로 목표 달성
  else
    v_status := 'pending';                         -- 목표 미달 대기
  end if;

  -- 9) 예약 번호 (충돌 시 재시도)
  for i in 1..5 loop
    v_code := public.banchan_new_reservation_code();
    exit when not exists (select 1 from public.banchan_preorders p where p.reservation_code = v_code);
    v_code := null;
  end loop;
  if v_code is null then
    raise exception 'CODE_GENERATION_FAILED' using errcode = 'P0001';
  end if;

  -- 10) 생성. 가격·통화는 서버가 offer 에서 복사(스냅샷).
  insert into public.banchan_preorders (
    offer_id, user_id, qty, reservation_code,
    order_status, payment_status,
    unit_price_minor_snapshot, currency_snapshot, currency_exponent_snapshot,
    contact_method, contact_value
  ) values (
    v_offer.id, v_uid, v_qty, v_code,
    v_status, 'unpaid',
    v_offer.unit_price_minor, v_offer.currency, v_offer.currency_exponent,
    p_contact_method, btrim(p_contact_value)
  )
  returning id into v_id;

  -- 11) 공동구매 목표를 이번에 채웠다면 같은 회차의 대기 주문도 확정
  if v_offer.min_qty is not null and v_status = 'confirmed' then
    update public.banchan_preorders p
       set order_status = 'confirmed'
     where p.offer_id = v_offer.id
       and p.order_status = 'pending';
  end if;

  return query
  select p.id, p.reservation_code, p.order_status, p.qty,
         p.unit_price_minor_snapshot * p.qty,
         p.currency_snapshot, p.currency_exponent_snapshot,
         v_offer.pickup_start, v_offer.pickup_end
  from public.banchan_preorders p
  where p.id = v_id;
end;
$$;

-- =============================================================================
-- 예약 취소 (고객 본인, 마감 전)
-- =============================================================================
create or replace function public.banchan_cancel_preorder(p_preorder_id uuid)
returns table (preorder_id uuid, order_status public.banchan_order_status, refund_note text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_order   public.banchan_preorders%rowtype;
  v_offer   public.dish_offers%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_order from public.banchan_preorders p where p.id = p_preorder_id for update;
  if not found then
    raise exception 'PREORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.user_id <> v_uid then
    -- 남의 예약은 존재 여부도 알려주지 않는다
    raise exception 'PREORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.order_status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED' using errcode = 'P0001';
  end if;
  if v_order.order_status = 'collected' then
    raise exception 'ALREADY_COLLECTED' using errcode = 'P0001';
  end if;

  -- offer 잠금 순서 통일: offer -> preorder (create 는 offer 만 잠근다)
  select * into v_offer from public.dish_offers o where o.id = v_order.offer_id for update;

  -- 취소 정책: 픽업 시작 N시간 전까지만 (서버 시각)
  if now() > (v_offer.pickup_start - make_interval(hours => v_offer.cancel_notice_hours)) then
    raise exception 'CANCEL_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  update public.banchan_preorders p
     set order_status = 'cancelled',
         cancelled_at = now()
   where p.id = v_order.id;

  -- 수량은 집계로 계산되므로 별도 복원 불필요(reserved_qty 뷰가 cancel 을 제외).
  -- 다만 공동구매가 목표 미달로 되돌아가면 남은 대기 주문을 pending 으로 내린다.
  if v_offer.min_qty is not null and v_offer.status = 'confirmed' then
    if (select u.reserved_qty from public.banchan_offer_usage(v_offer.id) u) < v_offer.min_qty then
      update public.banchan_preorders p
         set order_status = 'pending'
       where p.offer_id = v_offer.id and p.order_status = 'confirmed';
    end if;
  end if;

  return query select v_order.id, 'cancelled'::public.banchan_order_status,
    '온라인 결제가 없으므로 환불 처리 없음. 매장에 알려 주세요.'::text;
end;
$$;

-- =============================================================================
-- 판매자: 수령 + 현장 결제 기록
-- =============================================================================
create or replace function public.banchan_mark_collected(p_preorder_id uuid)
returns table (preorder_id uuid, order_status public.banchan_order_status, payment_status public.banchan_payment_status)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.banchan_preorders%rowtype;
  v_seller uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_order
  from public.banchan_preorders p
  where p.id = p_preorder_id
  for update;

  if not found then
    raise exception 'PREORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select d.seller_id into v_seller
  from public.dish_offers o
  join public.dishes d on d.id = o.dish_id
  where o.id = v_order.offer_id;

  if not public.is_seller_member(v_seller) then
    raise exception 'PREORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.order_status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATE: cannot collect a % order', v_order.order_status using errcode = 'P0001';
  end if;

  -- 수령과 결제를 한 트랜잭션으로 기록하되 컬럼은 분리 유지
  update public.banchan_preorders p
     set order_status = 'collected',
         collected_at = now(),
         payment_status = 'paid'
   where p.id = v_order.id;

  return query select v_order.id, 'collected'::public.banchan_order_status, 'paid'::public.banchan_payment_status;
end;
$$;

-- =============================================================================
-- 판매자: 노쇼 기록 (수령 없이 마감)
-- =============================================================================
create or replace function public.banchan_mark_no_show(p_preorder_id uuid)
returns table (preorder_id uuid, order_status public.banchan_order_status)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.banchan_preorders%rowtype;
  v_seller uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_order
  from public.banchan_preorders p
  where p.id = p_preorder_id
  for update;

  select d.seller_id into v_seller
  from public.dish_offers o
  join public.dishes d on d.id = o.dish_id
  where o.id = v_order.offer_id;

  if v_order.id is null or v_seller is null or not public.is_seller_member(v_seller) then
    raise exception 'PREORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.order_status <> 'confirmed' then
    raise exception 'INVALID_STATE: only confirmed orders can be no-show' using errcode = 'P0001';
  end if;

  update public.banchan_preorders p set order_status = 'no_show' where p.id = v_order.id;
  return query select v_order.id, 'no_show'::public.banchan_order_status;
end;
$$;

-- =============================================================================
-- 실행 권한: authenticated 만. INSERT/UPDATE 는 클라이언트에 주지 않는다.
-- =============================================================================
revoke all on function public.banchan_create_preorder(uuid, int, public.banchan_contact_method, text) from public, anon;
revoke all on function public.banchan_cancel_preorder(uuid) from public, anon;
revoke all on function public.banchan_mark_collected(uuid) from public, anon;
revoke all on function public.banchan_mark_no_show(uuid) from public, anon;

grant execute on function public.banchan_create_preorder(uuid, int, public.banchan_contact_method, text) to authenticated;
grant execute on function public.banchan_cancel_preorder(uuid) to authenticated;
grant execute on function public.banchan_mark_collected(uuid) to authenticated;
grant execute on function public.banchan_mark_no_show(uuid) to authenticated;

-- 클라이언트가 직접 테이블에 주문을 넣지 못하게 명시적으로 회수
revoke insert, update, delete on public.banchan_preorders from anon, authenticated;

commit;
