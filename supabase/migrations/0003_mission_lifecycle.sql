-- GoLive Drone Control — mission lifecycle RPCs (apply after 0002_drone_control.sql).
--
-- Why this migration exists
--   1) The browser-side accept call (src/features/drone/api/drone-api.ts) updated only
--      `status = 'accepted'`, but the RLS policy `drone_missions_accept_operator`
--      (0002_drone_control.sql) requires `operator_id = auth.uid()`, so accepting failed.
--   2) `request_drone_camera_command` refuses to run unless the mission is `active`
--      (0002_drone_control.sql), yet nothing ever moved a mission from `accepted` to `active`.
--   Both transitions are moved into SECURITY DEFINER functions so identity is taken from the
--   session, never from the request body, and so each transition is a single atomic UPDATE.
--
-- The 0002 RLS policies stay in place for reads. Direct UPDATE from `authenticated` is revoked
-- so a client cannot skip these checks.
-- ---------------------------------------------------------------------------
-- accepted <- requested : an operator claims a mission with one of their vehicles
-- ---------------------------------------------------------------------------
create or replace function public.accept_drone_mission(p_mission_id uuid, p_vehicle_id uuid) returns public.drone_missions language plpgsql security definer
set search_path = '' as $$
declare v_user_id uuid := auth.uid();
v_mission public.drone_missions %rowtype;
begin if v_user_id is null then raise exception 'authentication required' using errcode = '28000';
end if;
-- A caller may only claim with a vehicle they own. Never trust a vehicle id from the client
-- without this ownership check.
if not exists (
  select 1
  from public.drone_vehicles v
  where v.id = p_vehicle_id
    and v.owner_id = v_user_id
) then raise exception 'vehicle is not owned by the caller' using errcode = '42501';
end if;
-- Atomic claim: the WHERE clause makes two concurrent callers race safely; only one
-- UPDATE can match `status = 'requested'`.
update public.drone_missions
set status = 'accepted',
  operator_id = v_user_id,
  vehicle_id = p_vehicle_id,
  updated_at = now()
where id = p_mission_id
  and status = 'requested'
returning * into v_mission;
if not found then raise exception 'mission not found or already taken' using errcode = '55000';
end if;
insert into public.drone_audit_logs(mission_id, actor_id, event_type, details)
values (
    p_mission_id,
    v_user_id,
    'mission.accepted',
    jsonb_build_object('vehicleId', p_vehicle_id)
  );
return v_mission;
end;
$$;
-- ---------------------------------------------------------------------------
-- active <- accepted : the assigned operator has connected the field agent
-- ---------------------------------------------------------------------------
create or replace function public.start_drone_mission(p_mission_id uuid) returns public.drone_missions language plpgsql security definer
set search_path = '' as $$
declare v_user_id uuid := auth.uid();
v_mission public.drone_missions %rowtype;
begin if v_user_id is null then raise exception 'authentication required' using errcode = '28000';
end if;
update public.drone_missions
set status = 'active',
  updated_at = now()
where id = p_mission_id
  and operator_id = v_user_id
  and status = 'accepted'
returning * into v_mission;
if not found then raise exception 'only the assigned operator may start an accepted mission' using errcode = '42501';
end if;
insert into public.drone_audit_logs(mission_id, actor_id, event_type, details)
values (
    p_mission_id,
    v_user_id,
    'mission.active',
    jsonb_build_object('at', now())
  );
return v_mission;
end;
$$;
-- ---------------------------------------------------------------------------
-- Grants: RPC-only mutation for these two transitions
-- ---------------------------------------------------------------------------
revoke all on function public.accept_drone_mission(uuid, uuid)
from public,
  anon;
revoke all on function public.start_drone_mission(uuid)
from public,
  anon;
grant execute on function public.accept_drone_mission(uuid, uuid) to authenticated;
grant execute on function public.start_drone_mission(uuid) to authenticated;
-- Clients can no longer update missions directly; 0002's accept policy is now unreachable from
-- the browser because the table-level UPDATE grant is removed. Reads keep their RLS policies.
--
-- ROLLBACK NOTE: reverting this file must restore the grant, otherwise the old browser path
-- (which had the operator_id bug) silently comes back:
--   grant update on public.drone_missions to authenticated;
revoke
update on public.drone_missions
from authenticated;
-- Realtime already publishes drone_missions (0002). Status changes now flow through Realtime
-- because both functions perform a real UPDATE on that table.