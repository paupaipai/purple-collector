-- INSERT ... ON CONFLICT DO UPDATE (used by the client's upsert when
-- registering a push token) needs to be able to see the conflicting row
-- under RLS to resolve the conflict at all — without a SELECT policy,
-- Postgres rejects the statement outright with "new row violates row-level
-- security policy", even when no conflicting row actually exists yet.
-- Scoped to the caller's own rows only, same as the other policies.
create policy "Users can view their own push tokens"
  on push_tokens for select
  to authenticated
  using (auth.uid() = user_id);
