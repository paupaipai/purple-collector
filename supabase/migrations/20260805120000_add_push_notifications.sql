-- Push notifications support.
--
-- push_tokens: one row per device Expo push token, written by the k-collect
-- client itself. token is globally unique (not per-user) so that a device
-- passing between accounts (logout/login, reinstall) reassigns its existing
-- row via upsert instead of accumulating duplicates. RLS restricts writes to
-- the owning user; there is deliberately no select policy — only the
-- send-notification edge function (service_role, bypasses RLS) ever reads
-- the full token list.
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table push_tokens enable row level security;

create policy "Users can insert their own push tokens"
  on push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- Admin flag checked by send-notification before it will broadcast anything.
-- Set manually after this migration runs: no user starts as admin.
alter table user_profiles
  add column if not exists is_admin boolean not null default false;

-- Auditing: one row per broadcast, written only by send-notification
-- (service_role). No client insert/update/delete policy on purpose.
create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  data jsonb,
  sent_by uuid references auth.users(id),
  recipients_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table notifications_log enable row level security;

create policy "Admins can view notification log"
  on notifications_log for select
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );
