-- Fix "stack depth limit exceeded" caused by RLS recursion.
-- Root cause: policies calling is_admin() / profiles subqueries that re-trigger RLS on profiles.

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text;
begin
  select role into r
  from public.profiles
  where id = auth.uid();

  return r = 'admin';
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
    (select allowed_unit_ids from public.profiles where id = auth.uid()),
    '{}'::uuid[]
  );
$$;

-- Ensure authenticated users can call helper functions used in policies.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.allowed_unit_ids() to authenticated;

-- Recreate policies to avoid profiles subqueries under RLS (prevents recursion/stack overflow).
drop policy if exists "Units are readable by allowed users" on public.units;
create policy "Units are readable by allowed users" on public.units
for select
using (
  public.is_admin()
  or id = any(public.allowed_unit_ids())
);

drop policy if exists "Categories are readable by allowed users" on public.categories;
create policy "Categories are readable by allowed users" on public.categories
for select
using (
  public.is_admin()
  or unit_id = any(public.allowed_unit_ids())
);

drop policy if exists "Questions are readable by allowed users" on public.questions;
create policy "Questions are readable by allowed users" on public.questions
for select
using (
  public.is_admin()
  or category_id in (
    select id from public.categories
    where unit_id = any(public.allowed_unit_ids())
  )
);

