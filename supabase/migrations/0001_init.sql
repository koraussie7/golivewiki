-- golive.wiki × Supabase 초기 스키마
-- 역할 확장, 긱 태스크, 라이드, 실시간 피드, RLS

-- 역할 확장 프로필 (auth.users 1:1)
create type user_role as enum ('poster','worker','driver','admin');

create table profiles (
  id uuid primary key references auth.users,
  role user_role not null default 'poster',
  display_name text,
  phone text,
  driver_share numeric default 0.82,
  rating numeric default 5.0,
  rides_count int default 0,
  is_online boolean default false,
  last_location geography(point,4326)
);

-- 기존 긱 마켓플레이스 태스크
create table tasks (
  id uuid default gen_random_uuid() primary key,
  poster_id uuid references profiles(id),
  category text not null,
  title text,
  description text,
  budget_krw int,
  timing text,
  location geography(point,4326),
  region text,
  status text default 'open',
  created_at timestamptz default now()
);

create table offers (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  worker_id uuid references profiles(id),
  price_krw int,
  message text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- RideFlow 미러 (라이드 뷰)
create table rides (
  id uuid primary key,
  rider_id uuid,
  driver_id uuid,
  pickup geography(point,4326),
  dest geography(point,4326),
  fare_estimate_krw int,
  fare_final_krw int,
  driver_share_pct numeric default 82,
  status text default 'searching',
  requested_at timestamptz default now()
);

-- 실시간 피드 (inDrive "Right now at inDrive" 대응)
create table activity_events (
  id bigserial primary key,
  kind text,
  payload jsonb,
  region text,
  created_at timestamptz default now()
);

-- 지리 인덱스 (반경 3km 필터)
create index idx_tasks_loc on tasks using gist (location);
create index idx_drivers_loc on profiles using gist (last_location)
  where role='driver' and is_online;
create index idx_rides_pickup on rides using gist (pickup);

-- 반경 검색 RPC (RideFlow /api/drivers/nearby와 동일 역할)
create or replace function nearby_drivers(lat float8, lng float8, radius_m float8 default 3000)
returns table(id uuid, display_name text, rating numeric, dist_m float8) language sql as $$
  select p.id, p.display_name, p.rating,
         st_distance(p.last_location, st_point(lng, lat)::geography) as dist_m
  from profiles p
  where p.role='driver' and p.is_online
    and st_dwithin(p.last_location, st_point(lng, lat)::geography, radius_m)
  order by dist_m;
$$;

-- RLS (Row Level Security)
alter table tasks enable row level security;
create policy "public read tasks" on tasks for select using (true);
create policy "insert own tasks" on tasks for insert with check (auth.uid() = poster_id);

alter table offers enable row level security;
create policy "public read offers" on offers for select using (true);
create policy "insert own offers" on offers for insert with check (auth.uid() = worker_id);

alter table rides enable row level security;
create policy "public read rides" on rides for select using (true);
create policy "insert own rides" on rides for insert with check (auth.uid() = rider_id);

alter table activity_events enable row level security;
create policy "public read events" on activity_events for select using (true);
create policy "insert own events" on activity_events for insert with check (auth.uid() = (payload->>'user_id')::uuid);