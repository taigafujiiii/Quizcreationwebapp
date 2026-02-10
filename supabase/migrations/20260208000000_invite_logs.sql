create table if not exists public.invite_logs (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null,
  invitee_email text not null,
  invitee_role text not null check (invitee_role in ('user', 'admin')),
  status text not null,
  error text,
  invitee_user_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invite_logs_created_at_idx on public.invite_logs (created_at desc);
create index if not exists invite_logs_inviter_created_at_idx on public.invite_logs (inviter_id, created_at desc);
create index if not exists invite_logs_invitee_email_created_at_idx on public.invite_logs (invitee_email, created_at desc);

alter table public.invite_logs enable row level security;

