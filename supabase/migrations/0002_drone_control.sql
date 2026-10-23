-- GoLive Drone Control MVP for the existing public.profiles / Supabase Auth setup.
-- Apply to Supabase only after staging review. Browser clients may request but cannot execute commands.
create extension if not exists pgcrypto;

-- Reuses the existing public.profiles(id) -> auth.users(id) identity mapping.
create table if not exists public.drone_vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  vendor text not null check (vendor in ('mavlink', 'dji')),
  model text not null,
  capabilities jsonb not null default '[]'::jsonb check (jsonb_typeof(capabilities) = 'array'),
  status text not null default 'offline' check (status in ('offline', 'online', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.drone_missions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  operator_id uuid references public.profiles(id) on delete restrict,
  vehicle_id uuid references public.drone_vehicles(id) on delete
  set null,
    title text not null check (
      length(trim(title)) between 1 and 160
    ),
    description text not null default '',
    address text not null default '',
    latitude double precision,
    longitude double precision,
    area jsonb not null default '{}'::jsonb,
    budget_krw integer not null default 0 check (budget_krw >= 0),
    scheduled_at timestamptz,
    status text not null default 'requested' check (
      status in (
        'requested',
        'accepted',
        'active',
        'completed',
        'cancelled',
        'failed'
      )
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
      (
        latitude is null
        and longitude is null
      )
      or (
        latitude between -90 and 90
        and longitude between -180 and 180
      )
    )
);
create table if not exists public.drone_sessions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.drone_missions(id) on delete cascade,
  stream_path text not null,
  playback_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    ended_at is null
    or ended_at >= started_at
  )
);
create table if not exists public.drone_commands (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.drone_missions(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  command_type text not null check (
    command_type in (
      'camera.capture_photo',
      'camera.start_video',
      'camera.stop_video',
      'camera.zoom'
    )
  ),
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'pending_approval' check (
    status in (
      'pending_approval',
      'approved',
      'executing',
      'completed',
      'failed',
      'rejected',
      'expired',
      'unsupported'
    )
  ),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, request_id)
);
create table if not exists public.drone_approvals (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.drone_commands(id) on delete cascade,
  operator_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  decided_at timestamptz not null default now(),
  unique (command_id)
);
create table if not exists public.drone_audit_logs (
  id bigint generated always as identity primary key,
  mission_id uuid not null references public.drone_missions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
    event_type text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists drone_missions_requester_created_idx on public.drone_missions(requester_id, created_at desc);
create index if not exists drone_missions_operator_created_idx on public.drone_missions(operator_id, created_at desc);
create index if not exists drone_commands_mission_created_idx on public.drone_commands(mission_id, created_at desc);
create index if not exists drone_sessions_active_idx on public.drone_sessions(mission_id, started_at desc)
where ended_at is null;
create index if not exists drone_audit_mission_created_idx on public.drone_audit_logs(mission_id, created_at desc);
alter table public.drone_vehicles enable row level security;
alter table public.drone_missions enable row level security;
alter table public.drone_sessions enable row level security;
alter table public.drone_commands enable row level security;
alter table public.drone_approvals enable row level security;
alter table public.drone_audit_logs enable row level security;

-- Explicit grants: camera requests and decisions are RPC-only. Device/session writes belong to the trusted agent service role.
revoke all on public.drone_vehicles, public.drone_missions, public.drone_sessions, public.drone_commands, public.drone_approvals, public.drone_audit_logs from anon, authenticated;
grant select on public.drone_vehicles, public.drone_missions, public.drone_sessions, public.drone_commands, public.drone_approvals, public.drone_audit_logs to authenticated;
grant insert on public.drone_missions to authenticated;

-- Participants can read mission-scoped records. A user's unrelated missions remain invisible.
drop policy if exists drone_missions_read_participants on public.drone_missions;
create policy drone_missions_read_participants on public.drone_missions for
select to authenticated using (
    requester_id = auth.uid()
    or operator_id = auth.uid()
  );
drop policy if exists drone_missions_create_requester on public.drone_missions;
create policy drone_missions_create_requester on public.drone_missions for insert to authenticated
  with check (requester_id = auth.uid() and status = 'requested' and operator_id is null and exists (select 1 from public.profiles p where p.id = auth.uid()));

drop policy if exists drone_missions_accept_operator on public.drone_missions;
create policy drone_missions_accept_operator on public.drone_missions for update to authenticated
  using (status = 'requested' and (exists (select 1 from public.drone_vehicles v where v.id = vehicle_id and v.owner_id = auth.uid()) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')))
  with check (operator_id = auth.uid() and status = 'accepted');
drop policy if exists drone_vehicles_read_participants on public.drone_vehicles;
create policy drone_vehicles_read_participants on public.drone_vehicles for
select to authenticated using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.drone_missions m
      where m.vehicle_id = drone_vehicles.id
        and (
          m.requester_id = auth.uid()
          or m.operator_id = auth.uid()
        )
    )
  );
drop policy if exists drone_sessions_read_participants on public.drone_sessions;
create policy drone_sessions_read_participants on public.drone_sessions for
select to authenticated using (
    exists (
      select 1
      from public.drone_missions m
      where m.id = mission_id
        and (
          m.requester_id = auth.uid()
          or m.operator_id = auth.uid()
        )
    )
  );
drop policy if exists drone_commands_read_participants on public.drone_commands;
create policy drone_commands_read_participants on public.drone_commands for
select to authenticated using (
    requester_id = auth.uid()
    or exists (
      select 1
      from public.drone_missions m
      where m.id = mission_id
        and (
          m.requester_id = auth.uid()
          or m.operator_id = auth.uid()
        )
    )
  );
drop policy if exists drone_approvals_read_participants on public.drone_approvals;
create policy drone_approvals_read_participants on public.drone_approvals for
select to authenticated using (
    operator_id = auth.uid()
    or exists (
      select 1
      from public.drone_commands c
        join public.drone_missions m on m.id = c.mission_id
      where c.id = command_id
        and (
          m.requester_id = auth.uid()
          or m.operator_id = auth.uid()
        )
    )
  );
drop policy if exists drone_audit_read_participants on public.drone_audit_logs;
create policy drone_audit_read_participants on public.drone_audit_logs for
select to authenticated using (
    exists (
      select 1
      from public.drone_missions m
      where m.id = mission_id
        and (
          m.requester_id = auth.uid()
          or m.operator_id = auth.uid()
        )
    )
  );
-- Commands are created only through this RPC: requester identity, capability, status, expiry,
-- request de-duplication and audit logging are enforced server-side in one transaction.
create or replace function public.request_drone_camera_command(
    p_mission_id uuid,
    p_command_type text,
    p_parameters jsonb default '{}'::jsonb,
    p_request_id uuid default gen_random_uuid()
  ) returns public.drone_commands language plpgsql security definer
set search_path = '' as $$
declare v_user_id uuid := auth.uid();
v_mission public.drone_missions %rowtype;
v_command public.drone_commands %rowtype;
v_capabilities jsonb;
v_requester_id uuid;
begin if v_user_id is null then raise exception 'authentication required' using errcode = '28000';
end if;
if p_command_type not in (
  'camera.capture_photo',
  'camera.start_video',
  'camera.stop_video',
  'camera.zoom'
) then raise exception 'unsupported or unsafe command' using errcode = '22023';
end if;
select id into v_requester_id from public.profiles where id = v_user_id;
if v_requester_id is null then raise exception 'GoLive profile required' using errcode = '42501'; end if;
select * into v_mission from public.drone_missions where id = p_mission_id for update;
if not found or v_mission.requester_id <> v_user_id then
  raise exception 'only the authenticated mission requester may request a camera action' using errcode = '42501';
end if;
if v_mission.status <> 'active' then raise exception 'mission is not active' using errcode = '55000';
end if;
if v_mission.vehicle_id is null then raise exception 'mission has no assigned vehicle' using errcode = '55000';
end if;
select capabilities into v_capabilities
from public.drone_vehicles
where id = v_mission.vehicle_id
  and status = 'online';
if v_capabilities is null
or not (v_capabilities ? p_command_type) then raise exception 'camera capability is unsupported or vehicle is offline' using errcode = '0A000';
end if;
if p_command_type = 'camera.zoom'
and coalesce((p_parameters->>'level')::integer, 0) not between 1 and 5 then raise exception 'zoom level must be between 1 and 5' using errcode = '22023';
end if;
select * into v_command
from public.drone_commands
where requester_id = v_user_id
  and request_id = p_request_id;
if found then return v_command;
end if;
insert into public.drone_commands(
    mission_id,
    requester_id,
    request_id,
    command_type,
    parameters,
    status,
    expires_at
  )
values (
    p_mission_id,
    v_user_id,
    p_request_id,
    p_command_type,
    coalesce(p_parameters, '{}'::jsonb),
    'pending_approval',
    now() + interval '60 seconds'
  )
returning * into v_command;
insert into public.drone_audit_logs(mission_id, actor_id, event_type, details)
values (
    p_mission_id,
    v_user_id,
    'camera.command.pending',
    jsonb_build_object(
      'commandId',
      v_command.id,
      'commandType',
      p_command_type
    )
  );
return v_command;
end;
$$;
create or replace function public.decide_drone_camera_command(p_command_id uuid, p_decision text) returns public.drone_commands language plpgsql security definer
set search_path = '' as $$
declare v_user_id uuid := auth.uid();
v_command public.drone_commands %rowtype;
v_mission public.drone_missions %rowtype;
begin if v_user_id is null then raise exception 'authentication required' using errcode = '28000';
end if;
if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision' using errcode = '22023'; end if;
if not exists (select 1 from public.profiles where id = v_user_id) then raise exception 'GoLive profile required' using errcode = '42501'; end if;
select c.* into v_command
from public.drone_commands c
where c.id = p_command_id for
update;
if not found then raise exception 'command not found' using errcode = 'P0002';
end if;
select * into v_mission
from public.drone_missions
where id = v_command.mission_id;
if v_mission.operator_id is distinct from v_user_id then
  raise exception 'only the assigned field operator can decide' using errcode = '42501';
end if;
if v_command.status <> 'pending_approval'
or v_command.expires_at <= now()
or v_mission.status <> 'active' then raise exception 'command is expired or mission is not active' using errcode = '55000';
end if;
update public.drone_commands
set status = p_decision,
  updated_at = now()
where id = p_command_id
returning * into v_command;
insert into public.drone_approvals(command_id, operator_id, decision)
values (p_command_id, v_user_id, p_decision);
insert into public.drone_audit_logs(mission_id, actor_id, event_type, details)
values (
    v_command.mission_id,
    v_user_id,
    'camera.command.' || p_decision,
    jsonb_build_object('commandId', v_command.id)
  );
return v_command;
end;
$$;
revoke all on function public.request_drone_camera_command(uuid, text, jsonb, uuid)
from public,
  anon;
grant execute on function public.request_drone_camera_command(uuid, text, jsonb, uuid) to authenticated;
revoke all on function public.decide_drone_camera_command(uuid, text)
from public,
  anon;
grant execute on function public.decide_drone_camera_command(uuid, text) to authenticated;
-- Add mission-scoped tables to Supabase Realtime. Duplicate_object makes re-application safe.
do $$
begin
  alter publication supabase_realtime add table public.drone_missions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.drone_commands;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.drone_sessions;
exception when duplicate_object then null;
end $$;