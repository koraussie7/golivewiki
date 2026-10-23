-- GoLive SmartGlass task API schema (apply once per environment).
create extension if not exists pgcrypto;

create table if not exists smartglass_tasks (
  id uuid primary key default gen_random_uuid(),
  requester_id text not null,
  worker_id text,
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null default '',
  category text not null,
  budget integer not null check (budget >= 0),
  currency text not null default 'KRW',
  status text not null default 'open'
    check (status in ('open','accepted','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists smartglass_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references smartglass_tasks(id) on delete cascade,
  actor_id text not null,
  type text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists smartglass_consents (
  task_id uuid primary key references smartglass_tasks(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists smartglass_video_sessions (
  session_id uuid primary key default gen_random_uuid(),
  task_id uuid not null references smartglass_tasks(id) on delete cascade,
  playback_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists smartglass_tasks_status_category_idx on smartglass_tasks (status, category);
create index if not exists smartglass_tasks_worker_idx on smartglass_tasks (worker_id);
create index if not exists smartglass_task_events_task_idx on smartglass_task_events (task_id, created_at desc);
create index if not exists smartglass_video_sessions_live_idx on smartglass_video_sessions (task_id, expires_at desc);
