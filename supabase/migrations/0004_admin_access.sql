-- Safe admin-role check for browser UX guards.
-- The client may ask whether the CURRENT authenticated user is an admin,
-- but cannot choose a user id or mutate its own role through this function.
-- Admin APIs must still enforce authorization server-side.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;

revoke all on function public.is_current_user_admin() from public;
revoke all on function public.is_current_user_admin() from anon;
grant execute on function public.is_current_user_admin() to authenticated;
