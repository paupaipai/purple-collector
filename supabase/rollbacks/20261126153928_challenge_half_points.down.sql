-- NO APLICAR: el 2026-11-26 la usuaria decidio MANTENER las reglas v2 en produccion.
-- Se guarda solo como reversa documentada de 20261126153928_challenge_half_points
-- (antes estaba en migrations/ como 20261126170000 y un db push la habria aplicado).
--
-- Revierte 20261126153928_challenge_half_points y 20261126153442_my_image_reports.
--
-- Se aplicaron desde k-collect por error: la usuaria queria esos cambios en el
-- mantenedor (otro repo). Pidio revertir todo el 2026-11-26. Vuelve el puntaje
-- v1 (1 punto = frente + reverso de la misma persona) con las definiciones
-- exactas que habia en produccion antes del cambio, y se quitan las RPC de
-- reportes.
--
-- Seguro de aplicar: el concurso sigue 'active' y challenge_results /
-- challenge_awards estan vacias (verificado antes de escribir esto).

-- ---------------------------------------------------------------------------
-- 1. RPC de reportes
-- ---------------------------------------------------------------------------
drop function if exists public.my_image_reports();
drop function if exists public.my_reported_images();

-- ---------------------------------------------------------------------------
-- 2. Puntaje v1
-- ---------------------------------------------------------------------------
drop function if exists public.challenge_admin_standings(bigint);
drop function if exists public.challenge_leaderboard(bigint, integer, integer);
drop function if exists public.challenge_my_stats(bigint);
drop function if exists public.challenge_standings(bigint);

alter table public.challenge_results
  alter column points type integer using points::integer;

create function public.challenge_standings(p_challenge_id bigint)
returns table (rank integer, user_id uuid, username text, points integer, reached_at timestamptz, tied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select user_id, count(*)::int as points, max(submitted_at) as reached_at
    from public.challenge_card_winners(p_challenge_id) group by user_id
  )
  select (row_number() over (order by w.points desc, w.reached_at, w.user_id))::int,
         w.user_id, p.username, w.points, w.reached_at,
         count(*) over (partition by w.points) > 1
  from w left join public.user_profiles p on p.id = w.user_id
  order by 1;
$$;

revoke execute on function public.challenge_standings(bigint) from public;
revoke execute on function public.challenge_standings(bigint) from anon, authenticated;

create function public.challenge_leaderboard(p_challenge_id bigint, p_limit integer default 50, p_offset integer default 0)
returns table (rank integer, username text, points integer, is_me boolean, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select c.status into v_status from public.challenges c where c.id = p_challenge_id;
  if v_status is null or v_status = 'draft' then return; end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  if v_status = 'finished' then
    return query
      select r.position, coalesce(p.username, r.username), r.points, r.user_id = auth.uid(), (count(*) over ())::int
      from public.challenge_results r left join public.user_profiles p on p.id = r.user_id
      where r.challenge_id = p_challenge_id order by r.position limit p_limit offset p_offset;
  else
    return query
      select s.rank, s.username, s.points, s.user_id = auth.uid(), (count(*) over ())::int
      from public.challenge_standings(p_challenge_id) s order by s.rank limit p_limit offset p_offset;
  end if;
end; $$;

revoke execute on function public.challenge_leaderboard(bigint, integer, integer) from public;
revoke execute on function public.challenge_leaderboard(bigint, integer, integer) from anon;
grant execute on function public.challenge_leaderboard(bigint, integer, integer) to authenticated;

create function public.challenge_my_stats(p_challenge_id bigint)
returns table (points integer, rank integer, pending_cards integer, incomplete_cards integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); c public.challenges;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into c from public.challenges where id = p_challenge_id and status <> 'draft';
  if not found then return; end if;
  return query
  with mine as (
    select ci.card_id, ci.side, ci.status
    from public.challenge_eligible_cards e
    join public.card_images ci on ci.card_id = e.card_id
    where e.challenge_id = c.id and ci.source_type = 'community' and ci.contributed_by = v_uid
      and ci.taken_down_at is null and ci.status <> 'rejected'
      and ci.created_at >= c.starts_at and ci.created_at < public.challenge_window_end(c)
  ),
  per_card as (
    select card_id, bool_or(side = 'front') as has_front, bool_or(side = 'back') as has_back,
           bool_or(status = 'pending') as has_pending
    from mine group by card_id
  ),
  me as (select s.points, s.rank from public.challenge_standings(c.id) s where s.user_id = v_uid)
  select coalesce((select me.points from me), 0), (select me.rank from me),
         (select count(*)::int from per_card where has_pending),
         (select count(*)::int from per_card where not (has_front and has_back));
end; $$;

revoke execute on function public.challenge_my_stats(bigint) from public;
revoke execute on function public.challenge_my_stats(bigint) from anon;
grant execute on function public.challenge_my_stats(bigint) to authenticated;

create function public.challenge_admin_standings(p_challenge_id bigint)
returns table (rank integer, user_id uuid, username text, points integer, reached_at timestamptz, tied boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  return query select * from public.challenge_standings(p_challenge_id);
end; $$;

revoke execute on function public.challenge_admin_standings(bigint) from public;
revoke execute on function public.challenge_admin_standings(bigint) from anon;
grant execute on function public.challenge_admin_standings(bigint) to authenticated;

create or replace function public.challenge_current()
returns table (id bigint, slug text, kind text, title text, status text, starts_at timestamptz,
               ends_at timestamptz, closed_at timestamptz, finalized_at timestamptz, rules_version text,
               prizes jsonb, eligible_count integer, completed_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.kind, c.title, c.status, c.starts_at, c.ends_at,
         c.closed_at, c.finalized_at, c.rules_version, c.prizes,
         (select count(*)::int from public.challenge_eligible_cards e where e.challenge_id = c.id),
         case when c.status = 'finished'
              then (select coalesce(sum(r.points), 0)::int from public.challenge_results r where r.challenge_id = c.id)
              else (select count(*)::int from public.challenge_card_winners(c.id)) end
  from public.challenges c
  where c.status <> 'draft'
  order by (c.status in ('active', 'reviewing')) desc, c.finalized_at desc nulls last, c.id desc
  limit 1;
$$;

create or replace function public.challenge_admin_overview(p_challenge_id bigint)
returns table (eligible_cards integer, completed_cards integer, approved_images integer, pending_images integer,
               rejected_images integer, participants integer, active_voids integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c public.challenges;
begin
  perform public.challenge_assert_admin();
  select * into c from public.challenges where id = p_challenge_id;
  if not found then raise exception 'challenge not found'; end if;
  return query
  with imgs as (
    select ci.status, ci.taken_down_at, ci.contributed_by
    from public.challenge_eligible_cards e join public.card_images ci on ci.card_id = e.card_id
    where e.challenge_id = c.id and ci.source_type = 'community'
      and ci.created_at >= coalesce(c.starts_at, 'infinity') and ci.created_at < public.challenge_window_end(c)
  )
  select (select count(*)::int from public.challenge_eligible_cards where challenge_id = c.id),
         (select count(*)::int from public.challenge_card_winners(c.id)),
         (select count(*)::int from imgs where status = 'approved' and taken_down_at is null),
         (select count(*)::int from imgs where status = 'pending'),
         (select count(*)::int from imgs where status = 'rejected'),
         (select count(distinct contributed_by)::int from imgs),
         (select count(*)::int from public.challenge_point_voids where challenge_id = c.id and restored_at is null);
end; $$;

create or replace function public.challenge_admin_contributions(
  p_challenge_id bigint, p_user_id uuid default null, p_status image_status default null,
  p_limit integer default 100, p_offset integer default 0)
returns table (card_image_id bigint, card_id integer, side text, status image_status, contributed_by uuid,
               username text, created_at timestamptz, reviewed_at timestamptz, rejection_reason text,
               taken_down_at timestamptz, scores boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c public.challenges;
begin
  perform public.challenge_assert_admin();
  select * into c from public.challenges where id = p_challenge_id;
  if not found then raise exception 'challenge not found'; end if;
  return query
  with w as (select * from public.challenge_card_winners(c.id))
  select ci.id, ci.card_id, ci.side, ci.status, ci.contributed_by, ci.contributor_handle,
         ci.created_at, ci.reviewed_at, ci.rejection_reason, ci.taken_down_at,
         exists (select 1 from w where ci.id in (w.front_image_id, w.back_image_id))
  from public.challenge_eligible_cards e join public.card_images ci on ci.card_id = e.card_id
  where e.challenge_id = c.id and ci.source_type = 'community'
    and ci.created_at >= coalesce(c.starts_at, 'infinity') and ci.created_at < public.challenge_window_end(c)
    and (p_user_id is null or ci.contributed_by = p_user_id)
    and (p_status is null or ci.status = p_status)
  order by ci.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end; $$;

drop function if exists public.challenge_side_holders(bigint);

update public.challenges set rules_version = '1', updated_at = now() where id = 3;
