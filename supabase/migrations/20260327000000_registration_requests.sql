-- Add allowed_unit_ids to companies for company-level unit assignment
alter table public.companies
  add column if not exists allowed_unit_ids uuid[] not null default '{}';

-- Registration requests table for self-registration workflow
create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  last_name text not null,
  first_name text not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text not null default '',
  invited_user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz
);

create index if not exists registration_requests_status_idx on public.registration_requests (status);
create index if not exists registration_requests_company_id_idx on public.registration_requests (company_id);
create index if not exists registration_requests_email_idx on public.registration_requests (email);
create index if not exists registration_requests_created_at_idx on public.registration_requests (created_at);

alter table public.registration_requests enable row level security;

-- Only admins can access registration requests (inserts handled by service role in edge functions)
create policy "admins can manage registration requests"
  on public.registration_requests
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
