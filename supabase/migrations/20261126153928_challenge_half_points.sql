-- Community Challenge, reglas v2: 0,5 punto por lado, y el lado es de quien
-- aporto la imagen que se muestra.
--
-- ANTES (v1): 1 punto por photocard, solo si la MISMA persona tenia frente y
-- reverso aprobados; el primer par completo enviado se quedaba el punto.
--
-- AHORA (v2), decidido por la usuaria el 2026-11-26:
--   - Frente aprobado = 0,5. Reverso aprobado = 0,5. Ambos = 1.
--   - Cada lado tiene UN dueno: quien aporto la imagen PRIMARIA de ese lado
--     (la que se ve en el catalogo). Si se aprueba una foto de mejor calidad,
--     la edge function moderate-card-image la hace primaria y baja la anterior,
--     asi que los 0,5 pasan solos a quien aporto la nueva.
--
-- Por que basta con "la primaria" para cumplir los criterios:
--   - Duplicada sin puntos extra / dos aprobaciones simultaneas sin pasar de 1:
--     el indice unico card_images_one_primary_per_source (card_id, source_type,
--     side) WHERE is_primary AND approved garantiza a nivel de base UNA sola
--     community primaria por lado. Tope: 0,5 + 0,5 = 1 por photocard.
--   - El ranking se actualiza tras cada cambio: se deriva del estado de
--     card_images cada vez que se consulta; no hay contador que mantener.
--   - El ranking definitivo no cambia: al finalizar se congela en
--     challenge_results, y leaderboard / my_stats leen de ahi si el concurso
--     esta 'finished'.
--
-- Siguen valiendo: catalogo inicial (challenge_eligible_cards), ventana de envio
-- (starts_at .. challenge_window_end), retiradas no cuentan (taken_down_at), y
-- los voids de challenge_point_voids (anulan lo que esa persona tenga en esa card).
--
-- challenge_card_winners (v1) se deja sin tocar por si el mantenedor la usa,
-- pero ya no interviene en ningun calculo.

-- ---------------------------------------------------------------------------
-- 1. Puntos con decimales
-- ---------------------------------------------------------------------------
alter table public.challenge_results
  alter column points type numeric(7,1) using points::numeric(7,1);

-- ---------------------------------------------------------------------------
-- 2. Quien es dueno de cada lado
-- ---------------------------------------------------------------------------
create or replace function public.challenge_side_holders(p_challenge_id bigint)
returns table (card_id integer, side text, user_id uuid, image_id bigint, submitted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ci.card_id, ci.side, ci.contributed_by, ci.id, ci.created_at
  from public.challenges c
  join public.challenge_eligible_cards e on e.challenge_id = c.id
  join public.card_images ci on ci.card_id = e.card_id
  where c.id = p_challenge_id and c.status <> 'draft'
    and ci.source_type = 'community' and ci.status = 'approved' and ci.is_primary
    and ci.taken_down_at is null and ci.contributed_by is not null
    and ci.created_at >= c.starts_at and ci.created_at < public.challenge_window_end(c)
    and not exists (
      select 1 from public.challenge_point_voids v
      where v.challenge_id = c.id and v.card_id = ci.card_id
        and v.user_id = ci.contributed_by and v.restored_at is null
    );
$$;

revoke execute on function public.challenge_side_holders(bigint) from public;
revoke execute on function public.challenge_side_holders(bigint) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Funciones que devuelven puntos: cambian de tipo, hay que recrearlas
-- ---------------------------------------------------------------------------
drop function if exists public.challenge_admin_standings(bigint);
drop function if exists public.challenge_leaderboard(bigint, integer, integer);
drop function if exists public.challenge_my_stats(bigint);
drop function if exists public.challenge_standings(bigint);

-- Desempate: quien llego antes a su puntaje, por fecha de ENVIO del ultimo lado
-- que hoy le suma (misma idea que v1).
create function public.challenge_standings(p_challenge_id bigint)
returns table (rank integer, user_id uuid, username text, points numeric, reached_at timestamptz, tied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select h.user_id, (count(*) * 0.5)::numeric(7,1) as points, max(h.submitted_at) as reached_at
    from public.challenge_side_holders(p_challenge_id) h
    group by h.user_id
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
returns table (rank integer, username text, points numeric, is_me boolean, total integer)
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
      select r.position, coalesce(p.username, r.username), r.points::numeric, r.user_id = auth.uid(), (count(*) over ())::int
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

-- incomplete_cards: photocards donde enviaste un solo lado. Ya no es "no suma",
-- sino "te falta el otro lado para sumar el 0,5 que queda".
create function public.challenge_my_stats(p_challenge_id bigint)
returns table (points numeric, rank integer, pending_cards integer, incomplete_cards integer)
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
  -- Finalizado: el puntaje y la posicion congelados, no los en vivo.
  me as (
    select r.points::numeric as points, r.position as rank
    from public.challenge_results r
    where c.status = 'finished' and r.challenge_id = c.id and r.user_id = v_uid
    union all
    select s.points, s.rank
    from public.challenge_standings(c.id) s
    where c.status <> 'finished' and s.user_id = v_uid
  )
  select coalesce((select me.points from me limit 1), 0)::numeric,
         (select me.rank from me limit 1),
         (select count(*)::int from per_card where has_pending),
         (select count(*)::int from per_card where not (has_front and has_back));
end; $$;

revoke execute on function public.challenge_my_stats(bigint) from public;
revoke execute on function public.challenge_my_stats(bigint) from anon;
grant execute on function public.challenge_my_stats(bigint) to authenticated;

create function public.challenge_admin_standings(p_challenge_id bigint)
returns table (rank integer, user_id uuid, username text, points numeric, reached_at timestamptz, tied boolean)
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

-- ---------------------------------------------------------------------------
-- 4. Lo que contaba "cards ganadas" pasa a contar por lados
-- ---------------------------------------------------------------------------

-- completed_count: photocards con AMBOS lados con dueno (sean o no la misma
-- persona). Finalizado: los lados ganados se congelaron como puntos, y cada
-- photocard completa son 2 x 0,5 = 1, asi que la suma de puntos redondeada
-- hacia abajo es una cota fiel.
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
              then (select floor(coalesce(sum(r.points), 0))::int from public.challenge_results r where r.challenge_id = c.id)
              else (select count(*)::int from (
                      select h.card_id from public.challenge_side_holders(c.id) h
                      group by h.card_id having count(*) = 2) done) end
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
         (select count(*)::int from (
            select h.card_id from public.challenge_side_holders(c.id) h
            group by h.card_id having count(*) = 2) done),
         (select count(*)::int from imgs where status = 'approved' and taken_down_at is null),
         (select count(*)::int from imgs where status = 'pending'),
         (select count(*)::int from imgs where status = 'rejected'),
         (select count(distinct contributed_by)::int from imgs),
         (select count(*)::int from public.challenge_point_voids where challenge_id = c.id and restored_at is null);
end; $$;

-- scores: esta imagen es hoy la duena de su lado (le da 0,5 a quien la aporto).
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
  with h as (select image_id from public.challenge_side_holders(c.id))
  select ci.id, ci.card_id, ci.side, ci.status, ci.contributed_by, ci.contributor_handle,
         ci.created_at, ci.reviewed_at, ci.rejection_reason, ci.taken_down_at,
         exists (select 1 from h where h.image_id = ci.id)
  from public.challenge_eligible_cards e join public.card_images ci on ci.card_id = e.card_id
  where e.challenge_id = c.id and ci.source_type = 'community'
    and ci.created_at >= coalesce(c.starts_at, 'infinity') and ci.created_at < public.challenge_window_end(c)
    and (p_user_id is null or ci.contributed_by = p_user_id)
    and (p_status is null or ci.status = p_status)
  order by ci.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end; $$;

-- ---------------------------------------------------------------------------
-- 5. Version de las reglas
-- ---------------------------------------------------------------------------
update public.challenges set rules_version = '2', updated_at = now() where id = 3;
