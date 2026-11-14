-- =============================================================================
-- 0005_banchan_market.sql — 반찬/치킨 글로벌 음식 네트워크 (플랜 5장 데이터 모델)
--
-- 대상: 개발 DB / 로컬 DB. 운영 DB 적용 금지 (사용자 승인 필요).
-- 기존 테이블(profiles, tasks, rides, drone_*)은 건드리지 않고 추가만 한다.
-- 기존 banchan_rounds / banchan_items 가 있으면 0006 으로 이관한다 (이 파일은 신규).
--
-- 원칙 (플랜 6장)
--  - 금액 = 통화 최소단위 정수 + 통화 소수 자릿수. 부동소수 금지.
--  - service_date = 판매자 현지 날짜, 실제 시각 = timestamptz.
--  - 픽업 전용. 배달·온라인 결제 컬럼 없음.
--  - 주문 상태(order_status)와 현장 결제 상태(payment_status) 분리.
--  - 가격·통화·승인 상태는 서버(RPC)만 쓴다. 고객은 직접 못 바꾼다.
--  - security definer 함수는 search_path 고정 + 입력 검증 + EXECUTE 최소 부여.
-- =============================================================================

begin;

-- --- 전제: Supabase 는 auth 스키마와 auth.uid()/auth.role() 을 기본 제공한다.
-- 로컬/CI 처럼 없는 환경에서만 스텁을 만든다 (이미 있으면 아무 것도 하지 않음).
create schema if not exists auth;
do $$ begin
  create function auth.uid() returns uuid language sql stable as $f$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
exception when duplicate_function then null; end $$;
do $$ begin
  create function auth.role() returns text language sql stable as $f$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $f$;
exception when duplicate_function then null; end $$;

-- --- enum -------------------------------------------------------------------
do $$ begin
  create type banchan_approval_status as enum ('pending', 'approved', 'suspended', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_dish_status as enum ('draft', 'active', 'hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_offer_status as enum ('draft', 'open', 'confirmed', 'cancelled', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_order_status as enum ('pending', 'confirmed', 'collected', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_payment_status as enum ('unpaid', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_video_status as enum ('pending', 'approved', 'rejected', 'hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_seller_role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type banchan_contact_method as enum ('phone', 'email');
exception when duplicate_object then null; end $$;

-- --- cities -----------------------------------------------------------------
create table if not exists public.cities (
  id           uuid primary key default gen_random_uuid(),
  country_code char(2) not null,                 -- ISO 3166-1 alpha-2
  name         text not null,
  timezone     text not null,                    -- IANA, e.g. Asia/Seoul
  latitude     double precision not null check (latitude between -90 and 90),
  longitude    double precision not null check (longitude between -180 and 180),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint cities_country_code_upper check (country_code = upper(country_code))
);
create unique index if not exists cities_country_name_key
  on public.cities (country_code, lower(name));

-- --- sellers ----------------------------------------------------------------
create table if not exists public.sellers (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references auth.users (id) on delete restrict,
  city_id          uuid not null references public.cities (id) on delete restrict,
  name             text not null check (length(btrim(name)) between 1 and 80),
  public_address   text not null check (length(btrim(public_address)) between 1 and 200),
  latitude         double precision not null check (latitude between -90 and 90),
  longitude        double precision not null check (longitude between -180 and 180),
  approval_status  banchan_approval_status not null default 'pending',
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists sellers_city_approved_idx
  on public.sellers (city_id) where approval_status = 'approved';
create index if not exists sellers_owner_idx on public.sellers (owner_user_id);

-- --- membership / admin -----------------------------------------------------
create table if not exists public.seller_members (
  seller_id uuid not null references public.sellers (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      banchan_seller_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (seller_id, user_id)
);
create index if not exists seller_members_user_idx on public.seller_members (user_id);

-- 관리자는 기존 profiles.role='admin' 을 재사용한다 (0004 is_current_user_admin).
-- 관리자 승격은 여기서 불가: 이 테이블은 service_role 만 쓴다.
create table if not exists public.banchan_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- --- dishes -----------------------------------------------------------------
create table if not exists public.dishes (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.sellers (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 80),
  description   text check (description is null or length(description) <= 1000),
  category      text not null check (category in ('banchan', 'chicken', 'dessert', 'other')),
  allergens     text[] not null default '{}',
  photo_path    text,                            -- 비공개 버킷 경로. 공개 URL 저장 금지
  status        banchan_dish_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dishes_seller_idx on public.dishes (seller_id);
create index if not exists dishes_category_idx on public.dishes (category) where status = 'active';

-- --- daily offers (판매자가 날짜별로 등록) -----------------------------------
create table if not exists public.dish_offers (
  id                   uuid primary key default gen_random_uuid(),
  dish_id              uuid not null references public.dishes (id) on delete cascade,
  service_date         date not null,             -- 판매자 현지 날짜
  currency             char(3) not null,
  unit_price_minor     bigint not null check (unit_price_minor > 0),
  currency_exponent    smallint not null default 0 check (currency_exponent between 0 and 4),
  order_deadline       timestamptz not null,
  pickup_start         timestamptz not null,
  pickup_end           timestamptz not null,
  min_qty              int check (min_qty is null or min_qty > 0),   -- null = 일반 예약(즉시 확정)
  max_qty              int not null check (max_qty > 0),
  pickup_place         text not null check (length(btrim(pickup_place)) between 1 and 200),
  cancel_notice_hours  int not null default 2 check (cancel_notice_hours >= 0),
  status               banchan_offer_status not null default 'draft',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint dish_offers_currency_upper check (currency = upper(currency)),
  constraint dish_offers_window check (pickup_start < pickup_end),
  constraint dish_offers_deadline_before_pickup check (order_deadline <= pickup_start),
  constraint dish_offers_min_le_max check (min_qty is null or min_qty <= max_qty)
);
-- 같은 메뉴의 같은 날짜 회차는 하나만
create unique index if not exists dish_offers_dish_date_key
  on public.dish_offers (dish_id, service_date);
create index if not exists dish_offers_open_idx
  on public.dish_offers (service_date, order_deadline) where status = 'open';



-- --- videos -----------------------------------------------------------------
create table if not exists public.dish_videos (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references public.sellers (id) on delete cascade,
  dish_id           uuid not null references public.dishes (id) on delete cascade,
  storage_path      text not null,               -- 비공개 버킷, 승인 전 외부 노출 금지
  poster_path       text,
  caption           text check (caption is null or length(caption) <= 300),
  duration_seconds  smallint not null check (duration_seconds between 1 and 30),
  moderation_status banchan_video_status not null default 'pending',
  created_at        timestamptz not null default now(),
  constraint dish_videos_path_prefix check (storage_path like 'videos/%')
);
-- 판매자가 본인 가게 메뉴에만 영상을 붙였는지 DB 차원에서 보증
create or replace function public.dish_video_matches_seller()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.dishes d
    where d.id = new.dish_id and d.seller_id = new.seller_id
  ) then
    raise exception 'dish % does not belong to seller %', new.dish_id, new.seller_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists dish_videos_seller_check on public.dish_videos;
create trigger dish_videos_seller_check
  before insert or update of dish_id, seller_id on public.dish_videos
  for each row execute function public.dish_video_matches_seller();

create index if not exists dish_videos_feed_idx
  on public.dish_videos (created_at desc) where moderation_status = 'approved';

-- --- preorders --------------------------------------------------------------
create table if not exists public.banchan_preorders (
  id                      uuid primary key default gen_random_uuid(),
  offer_id                uuid not null references public.dish_offers (id) on delete restrict,
  user_id                 uuid not null references auth.users (id) on delete restrict,
  qty                     int not null check (qty > 0),
  reservation_code        text not null unique,
  order_status            banchan_order_status not null default 'pending',
  payment_status          banchan_payment_status not null default 'unpaid',
  -- 가격 스냅샷: 예약 시점 값. 이후 메뉴 가격이 바뀌어도 예약 금액은 불변
  unit_price_minor_snapshot bigint not null check (unit_price_minor_snapshot > 0),
  currency_snapshot       char(3) not null,
  currency_exponent_snapshot smallint not null default 0,
  contact_method          banchan_contact_method not null,
  contact_value           text not null check (length(btrim(contact_value)) between 3 and 120),
  created_at              timestamptz not null default now(),
  cancelled_at            timestamptz,
  collected_at            timestamptz,
  constraint banchan_preorders_currency_upper check (currency_snapshot = upper(currency_snapshot)),
  constraint banchan_preorders_cancel_consistency
    check ((order_status = 'cancelled') = (cancelled_at is not null)),
  constraint banchan_preorders_collect_consistency
    check ((order_status = 'collected') = (collected_at is not null))
);
create index if not exists banchan_preorders_user_idx on public.banchan_preorders (user_id, created_at desc);
create index if not exists banchan_preorders_offer_active_idx
  on public.banchan_preorders (offer_id)
  where order_status in ('pending', 'confirmed', 'collected');
-- 동일 메뉴 회차 중복 활성 예약 금지 (수량 변경은 cancel + re-book)
create unique index if not exists banchan_preorders_one_active_per_offer
  on public.banchan_preorders (offer_id, user_id)
  where order_status in ('pending', 'confirmed', 'collected');

-- 진행 수량은 개인정보 없는 집계 뷰 (플랜 6장: 집계만 반환)
-- RLS: 뷰는 소유자 권한으로 실행되므로 공개 조건을 뷰 정의에 직접 넣는다.
drop view if exists public.dish_offer_public;
create or replace view public.dish_offer_public as
select
  o.id,
  o.dish_id,
  d.seller_id,
  s.city_id,                          -- 도시 필터용 (고객 연락처 같은 민감값 아님)
  s.name          as seller_name,
  d.name          as dish_name,
  d.category,
  d.allergens,
  o.service_date,
  o.currency,
  o.unit_price_minor,
  o.currency_exponent,
  o.order_deadline,
  o.pickup_start,
  o.pickup_end,
  o.min_qty,
  o.max_qty,
  o.pickup_place,
  o.cancel_notice_hours,
  o.status,
  coalesce(sum(p.qty) filter (where p.order_status in ('pending', 'confirmed', 'collected')), 0)::int as reserved_qty
from public.dish_offers o
join public.dishes d on d.id = o.dish_id
join public.sellers s on s.id = d.seller_id
left join public.banchan_preorders p on p.offer_id = o.id
where d.status = 'active'
  and s.approval_status = 'approved'
  and o.status in ('open', 'confirmed', 'closed')
group by o.id, d.seller_id, s.city_id, s.name, d.name, d.category, d.allergens;

-- --- reports ----------------------------------------------------------------
create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  video_id         uuid not null references public.dish_videos (id) on delete cascade,
  reason           text not null check (length(btrim(reason)) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now()
);
-- 같은 사람이 같은 영상을 반복 신고해도 1건 (남용 방지)
create unique index if not exists content_reports_one_per_user_video
  on public.content_reports (reporter_user_id, video_id);

-- --- helper: 현재 사용자가 해당 seller 의 구성원인가 ------------------------
create or replace function public.is_seller_member(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seller_members m
    where m.seller_id = p_seller_id and m.user_id = auth.uid()
  );
$$;

-- 기존 0004의 관리자 판정 재사용 (없는 환경이면 아래 정의가 대체)
create or replace function public.is_banchan_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.banchan_admins a where a.user_id = auth.uid());
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.cities             enable row level security;
alter table public.sellers            enable row level security;
alter table public.seller_members     enable row level security;
alter table public.banchan_admins     enable row level security;
alter table public.dishes             enable row level security;
alter table public.dish_offers        enable row level security;
alter table public.dish_videos        enable row level security;
alter table public.banchan_preorders  enable row level security;
alter table public.content_reports    enable row level security;

-- cities: 공개 읽기. 쓰기 없음 (운영자/service_role 만)
drop policy if exists cities_public_read on public.cities;
create policy cities_public_read on public.cities
  for select to anon, authenticated using (is_active);

-- sellers: 승인된 가게의 공개 필드만. 고객 연락처 컬럼 자체가 없다.
drop policy if exists sellers_public_read on public.sellers;
create policy sellers_public_read on public.sellers
  for select to anon, authenticated using (approval_status = 'approved');

drop policy if exists sellers_owner_read on public.sellers;
create policy sellers_owner_read on public.sellers
  for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists sellers_owner_update on public.sellers;
create policy sellers_owner_update on public.sellers
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    -- 승인 상태는 본인이 못 바꾼다 (트리거로도 차단)
    and approval_status = (select s.approval_status from public.sellers s where s.id = sellers.id)
  );

-- seller_members: 본인 소속만
drop policy if exists seller_members_self_read on public.seller_members;
create policy seller_members_self_read on public.seller_members
  for select to authenticated using (user_id = auth.uid());

-- banchan_admins: 읽기조차 제한 (정책 없음 = 거부). 서버/service_role 만 조회.
-- 일반 사용자의 관리자 승격 차단: insert/update/delete 정책 미부여.

-- dishes: 공개 = active + 승인 가게. 판매자는 자기 가게 전체.
drop policy if exists dishes_public_read on public.dishes;
create policy dishes_public_read on public.dishes
  for select to anon, authenticated
  using (
    status = 'active'
    and exists (
      select 1 from public.sellers s
      where s.id = dishes.seller_id and s.approval_status = 'approved'
    )
  );

drop policy if exists dishes_seller_read on public.dishes;
create policy dishes_seller_read on public.dishes
  for select to authenticated using (public.is_seller_member(seller_id));

drop policy if exists dishes_seller_write on public.dishes;
create policy dishes_seller_write on public.dishes
  for insert to authenticated with check (public.is_seller_member(seller_id));

drop policy if exists dishes_seller_update on public.dishes;
create policy dishes_seller_update on public.dishes
  for update to authenticated
  using (public.is_seller_member(seller_id))
  with check (public.is_seller_member(seller_id));

-- dish_offers: 고객은 open/confirmed/closed 이고 가게·메뉴가 공개인 것만.
drop policy if exists dish_offers_public_read on public.dish_offers;
create policy dish_offers_public_read on public.dish_offers
  for select to anon, authenticated
  using (
    status in ('open', 'confirmed', 'closed')
    and exists (
      select 1 from public.dishes d
      join public.sellers s on s.id = d.seller_id
      where d.id = dish_offers.dish_id
        and d.status = 'active'
        and s.approval_status = 'approved'
    )
  );

drop policy if exists dish_offers_seller_read on public.dish_offers;
create policy dish_offers_seller_read on public.dish_offers
  for select to authenticated
  using (exists (
    select 1 from public.dishes d
    where d.id = dish_offers.dish_id and public.is_seller_member(d.seller_id)
  ));

drop policy if exists dish_offers_seller_write on public.dish_offers;
create policy dish_offers_seller_write on public.dish_offers
  for insert to authenticated
  with check (exists (
    select 1 from public.dishes d
    where d.id = dish_offers.dish_id and public.is_seller_member(d.seller_id)
  ));

drop policy if exists dish_offers_seller_update on public.dish_offers;
create policy dish_offers_seller_update on public.dish_offers
  for update to authenticated
  using (exists (
    select 1 from public.dishes d
    where d.id = dish_offers.dish_id and public.is_seller_member(d.seller_id)
  ))
  with check (exists (
    select 1 from public.dishes d
    where d.id = dish_offers.dish_id and public.is_seller_member(d.seller_id)
  ));

-- dish_videos: 승인된 영상만 공개. 판매자는 자기 가게 전부.
drop policy if exists dish_videos_public_read on public.dish_videos;
create policy dish_videos_public_read on public.dish_videos
  for select to anon, authenticated
  using (
    moderation_status = 'approved'
    and exists (
      select 1 from public.sellers s
      where s.id = dish_videos.seller_id and s.approval_status = 'approved'
    )
  );

drop policy if exists dish_videos_seller_read on public.dish_videos;
create policy dish_videos_seller_read on public.dish_videos
  for select to authenticated using (public.is_seller_member(seller_id));

drop policy if exists dish_videos_seller_insert on public.dish_videos;
create policy dish_videos_seller_insert on public.dish_videos
  for insert to authenticated
  with check (
    public.is_seller_member(seller_id)
    -- 판매자는 스스로 승인할 수 없다: pending/rejected 는 등록만, approved/hidden 은 운영자만
    and moderation_status = 'pending'
  );
-- 같은 이유로 판매자가 카메라/썸네일 경로를 임의 승인 영상으로 바꾸지 못하게 update 도 제한
drop policy if exists dish_videos_seller_update on public.dish_videos;
create policy dish_videos_seller_update on public.dish_videos
  for update to authenticated
  using (public.is_seller_member(seller_id) and moderation_status = 'pending')
  with check (public.is_seller_member(seller_id) and moderation_status = 'pending');

-- banchan_preorders: 본인 것만 조회. 생성·상태 변경은 RPC 전용(정책 미부여).
drop policy if exists banchan_preorders_self_read on public.banchan_preorders;
create policy banchan_preorders_self_read on public.banchan_preorders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists banchan_preorders_seller_read on public.banchan_preorders;
create policy banchan_preorders_seller_read on public.banchan_preorders
  for select to authenticated
  using (exists (
    select 1 from public.dish_offers o
    join public.dishes d on d.id = o.dish_id
    where o.id = banchan_preorders.offer_id
      and public.is_seller_member(d.seller_id)
  ));

-- content_reports: 본인이 작성한 것만 조회. 관리자는 전체.
drop policy if exists content_reports_self_read on public.content_reports;
create policy content_reports_self_read on public.content_reports
  for select to authenticated using (reporter_user_id = auth.uid() or public.is_banchan_admin());

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert to authenticated with check (reporter_user_id = auth.uid());

-- --- 권한 -------------------------------------------------------------------
revoke all on public.cities, public.sellers, public.dishes, public.dish_offers,
              public.dish_videos, public.seller_members, public.banchan_admins,
              public.banchan_preorders, public.content_reports from anon, authenticated;

grant select on public.cities, public.sellers, public.dishes, public.dish_offers,
                 public.dish_videos to anon, authenticated;
grant select on public.seller_members, public.banchan_preorders, public.content_reports to authenticated;

-- 판매자 쓰기: 테이블 grant + RLS 정책이 함께 있어야 통과
grant insert, update on public.sellers        to authenticated;
grant insert, update on public.dishes         to authenticated;
grant insert, update on public.dish_offers    to authenticated;
grant insert, update  on public.dish_videos   to authenticated;
grant insert          on public.content_reports to authenticated;

-- 주문 상태·결제 상태·가격 스냅샷은 고객이 직접 못 쓴다: update grant 없음.
grant select on public.dish_offer_public to anon, authenticated;

-- --- seller self-approval 차단 트리거 --------------------------------------
create or replace function public.sellers_block_self_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- current_user 를 쓰면 안 된다: 테이블 소유자(postgres/gig_admin)로 실행되면 항상
  -- 통과해 판매자가 스스로 승인할 수 있다. 신뢰할 수 있는 신호는 JWT role 이다.
  if new.approval_status is distinct from old.approval_status
     and coalesce(auth.role(), 'anon') <> 'service_role'
     and not public.is_banchan_admin() then
    raise exception 'approval_status is managed by the operator'
      using errcode = 'insufficient_privilege';
  end if;
  -- approved_at 도 같은 규칙
  if coalesce(auth.role(), 'anon') <> 'service_role'
     and not public.is_banchan_admin() then
    new.approved_at := old.approved_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists sellers_block_self_approval on public.sellers;
create trigger sellers_block_self_approval
  before update on public.sellers
  for each row execute function public.sellers_block_self_approval();

-- 영상 승인 상태 변경도 운영자/service_role 전용 (RLS 는 insert 만 막는다)
create or replace function public.dish_videos_block_self_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.moderation_status is distinct from old.moderation_status
     and coalesce(auth.role(), 'anon') <> 'service_role'
     and not public.is_banchan_admin() then
    raise exception 'moderation_status is managed by the operator'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists dish_videos_block_self_approval on public.dish_videos;
create trigger dish_videos_block_self_approval
  before update on public.dish_videos
  for each row execute function public.dish_videos_block_self_approval();

drop trigger if exists dishes_touch on public.dishes;
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger dishes_touch before update on public.dishes
  for each row execute function public.touch_updated_at();
drop trigger if exists dish_offers_touch on public.dish_offers;
create trigger dish_offers_touch before update on public.dish_offers
  for each row execute function public.touch_updated_at();

commit;
