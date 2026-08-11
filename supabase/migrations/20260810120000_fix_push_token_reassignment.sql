-- Fix push token reassignment across accounts.
--
-- push_tokens.token is unique per device (not per user) so that a device
-- passing between accounts reassigns its existing row instead of piling up
-- duplicates. The client used a plain upsert(onConflict: 'token') for this,
-- but every RLS policy on push_tokens is scoped to auth.uid() = user_id —
-- including the row's *current* owner, not just the caller. So when device
-- previously registered to user A is used to log in as user B, B's upsert
-- tries to update a row RLS says B can't see, and Postgres rejects it.
--
-- Widening the table's RLS policies to let any authenticated user see/update
-- any row would fix the upsert but exposes every user's push token to every
-- other authenticated user via the anon key. Instead, route registration
-- through a SECURITY DEFINER function: it runs with the table owner's
-- privileges (bypassing RLS) but hard-codes user_id = auth.uid() itself, so
-- the caller can never write a token to any user but themselves.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.register_push_token(text, text) to authenticated;
