create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  username text,
  allowed_unit_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text not null default '',
  is_active boolean not null default true,
  is_assignment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_unit_id on public.categories(unit_id);
create index if not exists idx_questions_category_id on public.questions(category_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_update_user()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.handle_update_user();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;

create policy "Profiles are readable by owner or admin" on public.profiles
for select
using (auth.uid() = id or public.is_admin());

create policy "Profiles are updatable by owner or admin" on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (
  public.is_admin()
  or (
    auth.uid() = id
    and role = (select role from public.profiles p where p.id = auth.uid())
    and allowed_unit_ids = (select allowed_unit_ids from public.profiles p where p.id = auth.uid())
  )
);

create policy "Units are readable by allowed users" on public.units
for select
using (
  public.is_admin()
  or id = any(
    coalesce(
      (select allowed_unit_ids from public.profiles where id = auth.uid()),
      '{}'::uuid[]
    )
  )
);

create policy "Units are manageable by admin" on public.units
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Categories are readable by allowed users" on public.categories
for select
using (
  public.is_admin()
  or unit_id = any(
    coalesce(
      (select allowed_unit_ids from public.profiles where id = auth.uid()),
      '{}'::uuid[]
    )
  )
);

create policy "Categories are manageable by admin" on public.categories
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Questions are readable by allowed users" on public.questions
for select
using (
  public.is_admin()
  or category_id in (
    select id from public.categories
    where unit_id = any(
      coalesce(
        (select allowed_unit_ids from public.profiles where id = auth.uid()),
        '{}'::uuid[]
      )
    )
  )
);

create policy "Questions are manageable by admin" on public.questions
for all
using (public.is_admin())
with check (public.is_admin());
