-- R08: Make is_active effective (DESIGN.md S2 / S4).
-- Deactivation (profiles.is_active=false) must actually revoke privileges.
--   A. RLS helper functions is_admin() / allowed_unit_ids() must require is_active=true.
--   B. profiles UPDATE WITH CHECK must freeze is_active / company_id / email
--      (in addition to the existing role / allowed_unit_ids freeze) so a user
--      cannot self-reactivate or spoof their company/email. Only username stays editable.
--
-- DDL only: this migration recreates functions and one policy. It must not UPDATE any existing rows.
-- Signatures, language, `security definer` and `set search_path = public` are preserved from
-- 20260210002000_fix_rls_stack_depth.sql (security definer breaks RLS recursion / stack-depth).

-- ---------------------------------------------------------------------------
-- A. RLS helper functions: add is_active=true requirement.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text;
  active boolean;
begin
  select role, is_active into r, active
  from public.profiles
  where id = auth.uid();

  return coalesce(active, false) and r = 'admin';
end;
$$;

create or replace function public.allowed_unit_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select allowed_unit_ids from public.profiles
      where id = auth.uid() and is_active = true),
    '{}'::uuid[]
  );
$$;

-- Ensure authenticated users can call helper functions used in policies.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.allowed_unit_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- B. profiles UPDATE WITH CHECK: freeze is_active / company_id / email
--    alongside the existing role / allowed_unit_ids freeze (S4).
-- ---------------------------------------------------------------------------

drop policy if exists "Profiles are updatable by owner or admin" on public.profiles;
create policy "Profiles are updatable by owner or admin" on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (
  public.is_admin()
  or (
    auth.uid() = id
    and role             = (select p.role             from public.profiles p where p.id = auth.uid())
    and allowed_unit_ids = (select p.allowed_unit_ids from public.profiles p where p.id = auth.uid())
    and is_active        = (select p.is_active        from public.profiles p where p.id = auth.uid())
    and company_id       is not distinct from (select p.company_id from public.profiles p where p.id = auth.uid())
    and email            = (select p.email            from public.profiles p where p.id = auth.uid())
  )
);
-- company_id is nullable (added in 20260211000000_companies.sql), so `is not distinct from`
-- is required: `=` would evaluate to UNKNOWN when both sides are NULL and reject the update.
-- Regression guard: a self-update that only changes username still satisfies every
-- frozen-column equality (each equals its own current DB value), so it passes WITH CHECK.
