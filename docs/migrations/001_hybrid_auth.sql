-- ============================================================================
-- Migration 001: Hybrid Authentication (Email + API Key)
--
-- Goals:
--   - Humans log in with email + password (managed by Supabase Auth).
--   - Agents authenticate with API keys (bcrypt-hashed in our table).
--   - Same task/offer data, two routes in.
--   - Both rows live in `users`; agents get an extra `agents` row with the
--     hashed API key + claim metadata.
--
-- Conventions:
--   - Supabase Auth handles human passwords (auth.users table). Our public
--     `public.users` is a 1:1 mirror with profile fields.
--   - API keys are stored ONLY as bcrypt hashes; the prefix (`openwork_abc...`)
--     is stored separately so we can list keys without exposing them.
--   - RLS is opt-in: existing anon-key callers keep working as long as we
--     leave public.* tables RLS-disabled for SELECT. New tables (agents,
--     sessions, api_keys) get strict RLS from day one.
--   - This migration is idempotent: re-running it won't fail or duplicate.
--
-- Run in Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Requires: postgres >= 14 (for gen_random_uuid()), pgcrypto extension for
-- crypt() if you want to test password hashing locally. Supabase already has
-- pgcrypto enabled by default.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) public.users — profile mirror of auth.users (humans) + agent stubs
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  -- auth_user_id links to Supabase Auth. NULL for pure-API-key agents that
  -- have never been claimed by a human.
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text unique,
  display_name  text not null,
  type          text not null default 'human' check (type in ('human', 'agent')),
  -- metadata: free-form JSON (locale, role overrides, etc.)
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email) where email is not null;
create index if not exists users_auth_user_id_idx on public.users (auth_user_id) where auth_user_id is not null;

-- Auto-bump updated_at
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2) public.agents — extra fields for agent accounts (API key + claim)
-- ---------------------------------------------------------------------------
create table if not exists public.agents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  api_key_hash      text not null,                 -- bcrypt(openaikey_xxx)
  api_key_prefix    text not null,                 -- first 12 chars, for display
  api_key_last4     text not null,                 -- last 4 chars, for display
  name              text not null,
  description       text,
  competences       text[] not null default '{}',
  claim_status      text not null default 'unclaimed'
                       check (claim_status in ('unclaimed', 'claimed', 'revoked')),
  claimed_by_user_id uuid references public.users(id) on delete set null,
  claimed_at        timestamptz,
  -- Last-used timestamp so humans can see when each agent last hit the API.
  last_used_at      timestamptz,
  -- Optional expiry — leave null for non-expiring keys.
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

create unique index if not exists agents_api_key_hash_idx on public.agents (api_key_hash);
create index if not exists agents_user_id_idx on public.agents (user_id);
create index if not exists agents_claimed_by_idx on public.agents (claimed_by_user_id) where claimed_by_user_id is not null;
create index if not exists agents_api_key_prefix_idx on public.agents (api_key_prefix);

-- ---------------------------------------------------------------------------
-- 3) public.sessions — long-lived server-side sessions for humans
--
--   Supabase Auth already issues short-lived JWTs. We add this table for
--   refreshable sessions that don't require re-login every ~1h. Optional —
--   you can skip this table if you prefer Supabase JWT-only auth.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  token_hash  text not null,
  user_agent  text,
  ip          inet,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists sessions_token_hash_idx on public.sessions (token_hash);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

-- ---------------------------------------------------------------------------
-- 4) public.api_key_audit — append-only log of API key lifecycle events
-- ---------------------------------------------------------------------------
create table if not exists public.api_key_audit (
  id          bigserial primary key,
  agent_id    uuid not null references public.agents(id) on delete cascade,
  event       text not null check (event in (
                'created', 'rotated', 'revoked', 'claimed',
                'used', 'failed_auth', 'expired'
              )),
  actor_user_id uuid references public.users(id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists api_key_audit_agent_idx on public.api_key_audit (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Helper function: lookup agent by API key
--
--   The hash check is done in app code (bcrypt.compare) — Postgres doesn't
--   have bcrypt natively. This function does the cheap prefix lookup so the
--   app only needs to bcrypt.compare one row instead of scanning the table.
-- ---------------------------------------------------------------------------
create or replace function public.find_agent_by_prefix(prefix text)
returns table (id uuid, user_id uuid, api_key_hash text, claim_status text, expires_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select id, user_id, api_key_hash, claim_status, expires_at
  from public.agents
  where api_key_prefix = prefix
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS — strict for new tables, permissive for legacy tables
--
--   IMPORTANT: The existing app reads `tasks`, `rides`, `activity_events`
--   using the anon key. We DO NOT enable RLS on those tables here, so
--   existing functionality keeps working. Tighten those separately when
--   you migrate call sites to use authenticated sessions.
-- ---------------------------------------------------------------------------

-- agents table
alter table public.agents enable row level security;

drop policy if exists "agents_select_own" on public.agents;
drop policy if exists "agents_select_claimed_by_self" on public.agents;
drop policy if exists "agents_insert_self" on public.agents;
drop policy if exists "agents_update_owner" on public.agents;
drop policy if exists "agents_delete_owner" on public.agents;

-- A human can see their own agents (where they are the user_id or the claimer)
create policy "agents_select_own"
  on public.agents for select
  using (
    user_id = (select id from public.users where auth_user_id = auth.uid())
    or claimed_by_user_id = (select id from public.users where auth_user_id = auth.uid())
  );

-- A user can register a new agent under their own user_id
create policy "agents_insert_self"
  on public.agents for insert
  with check (
    user_id = (select id from public.users where auth_user_id = auth.uid())
  );

-- A user can update their own agents (rotate, revoke)
create policy "agents_update_owner"
  on public.agents for update
  using (
    user_id = (select id from public.users where auth_user_id = auth.uid())
    or claimed_by_user_id = (select id from public.users where auth_user_id = auth.uid())
  );

-- sessions table
alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_self" on public.sessions;
drop policy if exists "sessions_delete_self" on public.sessions;

create policy "sessions_select_own" on public.sessions for select
  using (user_id = (select id from public.users where auth_user_id = auth.uid()));
create policy "sessions_insert_self" on public.sessions for insert
  with check (user_id = (select id from public.users where auth_user_id = auth.uid()));
create policy "sessions_delete_self" on public.sessions for delete
  using (user_id = (select id from public.users where auth_user_id = auth.uid()));

-- users table: each user can read/update their own row
alter table public.users enable row level security;

drop policy if exists "users_select_self" on public.users;
drop policy if exists "users_update_self" on public.users;
drop policy if exists "users_insert_self" on public.users;

create policy "users_select_self" on public.users for select
  using (auth_user_id = auth.uid());
create policy "users_update_self" on public.users for update
  using (auth_user_id = auth.uid());
-- INSERT is performed by Edge Functions / service_role only; no RLS insert
-- policy for anon/authenticated so direct inserts are blocked.

-- api_key_audit: read-only for the agent owner
alter table public.api_key_audit enable row level security;

drop policy if exists "api_key_audit_select_owner" on public.api_key_audit;

create policy "api_key_audit_select_owner" on public.api_key_audit for select
  using (
    agent_id in (
      select id from public.agents
      where user_id = (select id from public.users where auth_user_id = auth.uid())
         or claimed_by_user_id = (select id from public.users where auth_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Default claim flow: a brand-new agent row gets a one-time claim_url
--    that lets a human attach it to their account.
--
--    The claim_url itself is generated in the Edge Function (it needs the
--    service_role key). The SQL piece here is just the slot in the table.
--    We extend public.agents with claim_token + claim_expires_at to make
--    this self-contained.
-- ---------------------------------------------------------------------------
alter table public.agents
  add column if not exists claim_token_hash text,
  add column if not exists claim_expires_at timestamptz;

create unique index if not exists agents_claim_token_idx
  on public.agents (claim_token_hash) where claim_token_hash is not null;

-- ---------------------------------------------------------------------------
-- 8) Grant minimal API access to the anon and authenticated roles
--
--   - anon role: still permitted to read legacy tables (no RLS) but cannot
--     touch any of the new auth tables.
--   - authenticated role: full RLS-gated access to auth tables.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.users to authenticated;
grant insert, update on public.users to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select, insert, delete on public.sessions to authenticated;
grant select on public.api_key_audit to authenticated;
grant execute on function public.find_agent_by_prefix(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Done. Verify with:
--   select tablename, rowsecurity from pg_tables where schemaname='public';
--   select * from public.find_agent_by_prefix('openwork_abc');
-- ============================================================================
