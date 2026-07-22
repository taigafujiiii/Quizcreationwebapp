-- R09: Company PIN hardening (DESIGN.md S3 / S6).
--
-- (B) partial UNIQUE index on companies.pin  → structurally prevents duplicate
--     PINs, so /public/verify-pin's `.eq('pin', pin).maybeSingle()` can never
--     receive more than one row (the maybeSingle multi-hit login failure in S3).
-- (C) public_action_logs table  → app-side rate-limit ledger for the two
--     UNAUTHENTICATED public endpoints /public/verify-pin and
--     /public/register-request. invite_logs is NOT reused: its
--     `inviter_id NOT NULL` / `invitee_role CHECK` constraints do not fit
--     anonymous traffic (REVIEW_NOTES B9).
--
-- ===========================================================================
-- ⚠️ PRE-APPLY REQUIREMENT (手順A / REVIEW_NOTES B12) — READ BEFORE `db push` ⚠️
-- ===========================================================================
-- The partial UNIQUE index (B) FAILS to build if duplicate non-NULL PINs
-- already exist. Before applying this migration to ANY database (検証 AND 本番),
-- run the duplicate-check query below in the Supabase SQL Editor:
--
--     select pin, count(*) as n
--     from public.companies
--     where pin is not null
--     group by pin
--     having count(*) > 1
--     order by n desc;
--
--   • 0 rows  → safe to apply this migration.
--   • ≥1 row  → DO NOT change or NULL any PIN yourself. Report the duplicate
--               companies to the owner and wait for instructions on which PIN
--               to change. PINs gate company login (operational data), so this
--               is an owner decision. Follow the "backup-before-overwrite" rule:
--               record the current PIN values before any change. Apply this
--               migration only AFTER the duplicates have been resolved.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- B. PIN partial UNIQUE index (NULL allowed; every non-NULL PIN must be unique).
-- ---------------------------------------------------------------------------
create unique index if not exists companies_pin_unique
  on public.companies (pin)
  where pin is not null;

-- ---------------------------------------------------------------------------
-- C. public_action_logs: rate-limit ledger for public (unauthenticated) endpoints.
--    RLS is enabled with NO policies on purpose → PostgREST / authenticated
--    clients get zero access; only the service role (used by the Edge Function)
--    bypasses RLS and can read/write. The window-count + graceful-skip pattern
--    mirrors invite_logs (20260208000000_invite_logs.sql).
-- ---------------------------------------------------------------------------
create table if not exists public.public_action_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,          -- 'verify_pin' | 'register_request'
  ip text not null default '',
  email text,                    -- register_request only
  status text not null,          -- 'attempt' | 'blocked_rate_limit' | 'failed' | 'ok'
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists public_action_logs_action_ip_created_idx
  on public.public_action_logs (action, ip, created_at desc);
create index if not exists public_action_logs_action_email_created_idx
  on public.public_action_logs (action, email, created_at desc);

alter table public.public_action_logs enable row level security;
