-- Community Challenge (Fase 1): modelo de datos, auditoria, puntuacion y RPC.
--
-- Principio: el puntaje NO se acumula, se DERIVA. No hay contador que sumar o
-- restar: los puntos salen siempre del estado real de card_images (+ la lista
-- de cards elegibles + las anulaciones). Asi:
--   - aprobar dos veces no puede sumar dos veces (idempotencia),
--   - un retiro o una anulacion descuentan solos, y el punto pasa al siguiente
--     aporte valido de esa card si lo hay,
--   - reenviar la misma card no suma: una card elegible = como mucho 1 punto.
-- Al finalizar, el ranking se congela en challenge_results.
--
-- Solo AGREGA objetos: no cambia tablas, vistas ni funciones existentes, ni la
-- edge function de moderacion.
--
-- `kind` deja preparado el segundo concurso (cartas que no estan en el
-- catalogo, via card_submissions); su puntuacion se implementara aparte.

-- ---------------------------------------------------------------------------
-- 1. Concursos
-- ---------------------------------------------------------------------------

create table public.challenges (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  kind          text not null default 'catalog_images'
                check (kind in ('catalog_images', 'new_cards')),
  title         text not null,
  status        text not null default 'draft'
                check (status in ('draft', 'active', 'reviewing', 'finished')),
  starts_at     timestamptz,
  -- Null = sin fecha fija: el concurso del catalogo cierra cuando se completa,
  -- a mano desde el panel de admin.
  ends_at       timestamptz,
  closed_at     timestamptz,
  finalized_at  timestamptz,
  rules_version text not null default '1',
  -- Premio por puesto. Los meses empiezan a correr cuando exista Premium.
  prizes        jsonb not null default
                '[{"place":1,"months":12},{"place":2,"months":6},{"place":3,"months":3}]',
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint challenges_started_has_start
    check (status = 'draft' or starts_at is not null),
  constraint challenges_closed_has_close
    check (status not in ('reviewing', 'finished') or closed_at is not null),
  constraint challenges_finished_has_final
    check (status <> 'finished' or finalized_at is not null),
  constraint challenges_dates_order
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Un solo concurso en curso a la vez (recibiendo aportes o en revision).
create unique index challenges_one_running
  on public.challenges ((true)) where status in ('active', 'reviewing');

comment on table public.challenges is
  'Concursos de la comunidad. Estados: draft -> active -> reviewing -> finished.';

-- ---------------------------------------------------------------------------
-- 2. Catalogo elegible (foto fija al activar)
-- ---------------------------------------------------------------------------

-- Sin FK a cards a proposito: es una foto del catalogo en el momento de activar
-- y no debe cambiar si despues se edita o borra una card.
create table public.challenge_eligible_cards (
  challenge_id bigint  not null references public.challenges(id) on delete restrict,
  card_id      integer not null,
  primary key (challenge_id, card_id)
);

-- ---------------------------------------------------------------------------
-- 3. Auditoria de card_images
-- ---------------------------------------------------------------------------

-- Hasta ahora aprobar/rechazar sobrescribia status y reviewed_at sin dejar
-- rastro. Este historial sirve para todas las imagenes, no solo el concurso.
create table public.card_image_events (
  id            bigint generated always as identity primary key,
  card_image_id bigint      not null,
  card_id       integer     not null,
  side          text,
  source_type   public.image_source_type,
  contributed_by uuid,
  event         text        not null check (event in ('baseline', 'insert', 'update')),
  old_status    public.image_status,
  new_status    public.image_status,
  old_is_primary boolean,
  new_is_primary boolean,
  taken_down_at timestamptz,
  reason        text,
  actor         uuid,
  created_at    timestamptz not null default now()
);

create index card_image_events_image_idx on public.card_image_events (card_image_id, created_at);

create or replace function public.card_images_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.card_image_events
      (card_image_id, card_id, side, source_type, contributed_by, event,
       new_status, new_is_primary, taken_down_at, actor)
    values
      (new.id, new.card_id, new.side, new.source_type, new.contributed_by, 'insert',
       new.status, new.is_primary, new.taken_down_at,
       coalesce(auth.uid(), new.contributed_by));
  elsif new.status is distinct from old.status
     or new.is_primary is distinct from old.is_primary
     or new.taken_down_at is distinct from old.taken_down_at then
    insert into public.card_image_events
      (card_image_id, card_id, side, source_type, contributed_by, event,
       old_status, new_status, old_is_primary, new_is_primary, taken_down_at,
       reason, actor)
    values
      (new.id, new.card_id, new.side, new.source_type, new.contributed_by, 'update',
       old.status, new.status, old.is_primary, new.is_primary, new.taken_down_at,
       new.rejection_reason,
       -- La moderacion corre con service_role (auth.uid() = null): quien actua
       -- es reviewed_by, que la edge function siempre rellena.
       coalesce(auth.uid(), new.reviewed_by));
  end if;
  return new;
end;
$$;

create trigger card_images_log_event_trg
  after insert or update on public.card_images
  for each row execute function public.card_images_log_event();

revoke execute on function public.card_images_log_event() from public;

-- Linea base: el estado de cada imagen comunitaria al empezar a auditar.
insert into public.card_image_events
  (card_image_id, card_id, side, source_type, contributed_by, event,
   new_status, new_is_primary, taken_down_at, actor, created_at)
select id, card_id, side, source_type, contributed_by, 'baseline',
       status, is_primary, taken_down_at, reviewed_by, now()
from public.card_images
where source_type = 'community';

-- ---------------------------------------------------------------------------
-- 4. Anulaciones de puntos
-- ---------------------------------------------------------------------------

-- Anular un punto sin retirar la imagen (p. ej. se descubre que la foto no era
-- de quien la subio). Nunca se borra: se restaura marcando restored_*.
create table public.challenge_point_voids (
  id             bigint generated always as identity primary key,
  challenge_id   bigint  not null references public.challenges(id) on delete restrict,
  card_id        integer not null,
  user_id        uuid    not null,
  reason         text    not null check (length(trim(reason)) > 0),
  voided_by      uuid    not null,
  voided_at      timestamptz not null default now(),
  restored_by    uuid,
  restored_at    timestamptz,
  restore_reason text,
  constraint challenge_point_voids_restore_complete
    check ((restored_at is null) = (restored_by is null))
);

create unique index challenge_point_voids_one_active
  on public.challenge_point_voids (challenge_id, card_id, user_id)
  where restored_at is null;

-- ---------------------------------------------------------------------------
-- 5. Resultados y premios
-- ---------------------------------------------------------------------------

create table public.challenge_results (
  challenge_id bigint  not null references public.challenges(id) on delete restrict,
  position     integer not null,
  user_id      uuid    not null,
  username     text,
  points       integer not null,
  reached_at   timestamptz not null,
  primary key (challenge_id, position),
  unique (challenge_id, user_id)
);

create table public.challenge_awards (
  id             bigint generated always as identity primary key,
  challenge_id   bigint  not null references public.challenges(id) on delete restrict,
  user_id        uuid    not null,
  position       integer not null,
  premium_months integer not null check (premium_months > 0),
  awarded_at     timestamptz not null default now(),
  status         text not null default 'pending_activation'
                 check (status in ('pending_activation', 'active', 'expired', 'revoked')),
  -- Ambas quedan vacias hasta que se lance Premium: el premio no corre antes.
  activates_at   timestamptz,
  expires_at     timestamptz,
  unique (challenge_id, position),
  constraint challenge_awards_active_has_dates
    check (status <> 'active' or (activates_at is not null and expires_at is not null))
);

-- ---------------------------------------------------------------------------
-- 6. Indice para la puntuacion
-- ---------------------------------------------------------------------------

create index card_images_community_approved_idx
  on public.card_images (card_id, side, contributed_by, created_at)
  where source_type = 'community' and status = 'approved' and taken_down_at is null;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.challenges               enable row level security;
alter table public.challenge_eligible_cards enable row level security;
alter table public.card_image_events        enable row level security;
alter table public.challenge_point_voids    enable row level security;
alter table public.challenge_results        enable row level security;
alter table public.challenge_awards         enable row level security;

-- Los datos del concurso (nombre, estado, fechas, premios) son publicos para
-- quien tiene sesion; los borradores solo los ve la admin.
create policy "challenges read" on public.challenges
  for select to authenticated using (status <> 'draft' or public.is_admin());

-- El resto solo lo lee la admin directamente. Las usuarias leen ranking y
-- estadisticas por las RPC de abajo, que no exponen ids ni correos.
create policy "challenge_eligible_cards admin read" on public.challenge_eligible_cards
  for select to authenticated using (public.is_admin());
create policy "card_image_events admin read" on public.card_image_events
  for select to authenticated using (public.is_admin());
create policy "challenge_point_voids admin read" on public.challenge_point_voids
  for select to authenticated using (public.is_admin());
create policy "challenge_results admin read" on public.challenge_results
  for select to authenticated using (public.is_admin());
create policy "challenge_awards admin read" on public.challenge_awards
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- Ninguna politica de escritura: todo cambio pasa por las RPC de admin, que
-- validan el estado. Asi no se puede alterar el historial por accidente desde
-- el dashboard de la app.

-- ---------------------------------------------------------------------------
-- 8. Puntuacion (funciones internas)
-- ---------------------------------------------------------------------------

-- Ventana de envio: desde starts_at hasta el primero de ends_at / closed_at.
create or replace function public.challenge_window_end(c public.challenges)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select least(coalesce(c.ends_at, 'infinity'), coalesce(c.closed_at, 'infinity'));
$$;

-- Una fila por card elegible que tiene punto: quien lo gana y cuando.
--
-- Regla: gana el PRIMER aporte completo (frente + reverso de la MISMA persona,
-- ambos aprobados, sin retirar, enviados dentro del plazo, sin anulacion
-- vigente). "Primero" = fecha de envio del aporte completo, o sea el
-- created_at mas tardio de sus dos lados. Empate exacto -> id mas bajo.
create or replace function public.challenge_card_winners(p_challenge_id bigint)
returns table (
  card_id        integer,
  user_id        uuid,
  submitted_at   timestamptz,
  front_image_id bigint,
  back_image_id  bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with ch as (
    select c.id, c.starts_at, public.challenge_window_end(c) as window_end
    from public.challenges c
    where c.id = p_challenge_id and c.status <> 'draft'
  ),
  -- Primer lado aprobado de cada persona, por card y lado.
  sides as (
    select distinct on (ci.card_id, ci.contributed_by, ci.side)
           ci.card_id, ci.contributed_by, ci.side, ci.id, ci.created_at
    from ch
    join public.challenge_eligible_cards e on e.challenge_id = ch.id
    join public.card_images ci on ci.card_id = e.card_id
    where ci.source_type = 'community'
      and ci.status = 'approved'
      and ci.taken_down_at is null
      and ci.created_at >= ch.starts_at
      and ci.created_at <  ch.window_end
    order by ci.card_id, ci.contributed_by, ci.side, ci.created_at, ci.id
  ),
  pairs as (
    select f.card_id, f.contributed_by as user_id,
           greatest(f.created_at, b.created_at) as submitted_at,
           f.id as front_image_id, b.id as back_image_id
    from sides f
    join sides b
      on b.card_id = f.card_id and b.contributed_by = f.contributed_by and b.side = 'back'
    where f.side = 'front'
      and not exists (
        select 1 from public.challenge_point_voids v
        where v.challenge_id = p_challenge_id
          and v.card_id = f.card_id
          and v.user_id = f.contributed_by
          and v.restored_at is null
      )
  )
  select distinct on (p.card_id)
         p.card_id, p.user_id, p.submitted_at, p.front_image_id, p.back_image_id
  from pairs p
  order by p.card_id, p.submitted_at, greatest(p.front_image_id, p.back_image_id);
$$;

-- Clasificacion en vivo. Desempate: con los mismos puntos, gana quien llego
-- antes a ese puntaje = la fecha de envio de su ultima card puntuada.
create or replace function public.challenge_standings(p_challenge_id bigint)
returns table (
  rank       integer,
  user_id    uuid,
  username   text,
  points     integer,
  reached_at timestamptz,
  tied       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select user_id, count(*)::int as points, max(submitted_at) as reached_at
    from public.challenge_card_winners(p_challenge_id)
    group by user_id
  )
  select (row_number() over (order by w.points desc, w.reached_at, w.user_id))::int,
         w.user_id, p.username, w.points, w.reached_at,
         count(*) over (partition by w.points) > 1
  from w
  left join public.user_profiles p on p.id = w.user_id
  order by 1;
$$;

revoke execute on function public.challenge_window_end(public.challenges) from public;
revoke execute on function public.challenge_card_winners(bigint) from public, anon, authenticated;
revoke execute on function public.challenge_standings(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC para usuarias
-- ---------------------------------------------------------------------------

-- El concurso a mostrar: el que esta en curso, o el ultimo terminado.
create or replace function public.challenge_current()
returns table (
  id             bigint,
  slug           text,
  kind           text,
  title          text,
  status         text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  closed_at      timestamptz,
  finalized_at   timestamptz,
  rules_version  text,
  prizes         jsonb,
  eligible_count integer,
  completed_count integer
)
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
              else (select count(*)::int from public.challenge_card_winners(c.id))
         end
  from public.challenges c
  where c.status <> 'draft'
  order by (c.status in ('active', 'reviewing')) desc, c.finalized_at desc nulls last, c.id desc
  limit 1;
$$;

-- Ranking paginado. Terminado el concurso se lee el congelado.
create or replace function public.challenge_leaderboard(
  p_challenge_id bigint,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  rank     integer,
  username text,
  points   integer,
  is_me    boolean,
  total    integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select c.status into v_status from public.challenges c where c.id = p_challenge_id;
  if v_status is null or v_status = 'draft' then return; end if;

  p_limit  := least(greatest(coalesce(p_limit, 50), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  if v_status = 'finished' then
    return query
      select r.position, coalesce(p.username, r.username), r.points,
             r.user_id = auth.uid(), (count(*) over ())::int
      from public.challenge_results r
      left join public.user_profiles p on p.id = r.user_id
      where r.challenge_id = p_challenge_id
      order by r.position
      limit p_limit offset p_offset;
  else
    return query
      select s.rank, s.username, s.points,
             s.user_id = auth.uid(), (count(*) over ())::int
      from public.challenge_standings(p_challenge_id) s
      order by s.rank
      limit p_limit offset p_offset;
  end if;
end;
$$;

-- "Mi participacion": todo calculado aqui, nada en el cliente.
create or replace function public.challenge_my_stats(p_challenge_id bigint)
returns table (
  points           integer,
  rank             integer,
  pending_cards    integer,
  incomplete_cards integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.challenges;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into c from public.challenges where id = p_challenge_id and status <> 'draft';
  if not found then return; end if;

  return query
  with mine as (
    select ci.card_id, ci.side, ci.status
    from public.challenge_eligible_cards e
    join public.card_images ci on ci.card_id = e.card_id
    where e.challenge_id = c.id
      and ci.source_type = 'community'
      and ci.contributed_by = v_uid
      and ci.taken_down_at is null
      and ci.status <> 'rejected'
      and ci.created_at >= c.starts_at
      and ci.created_at <  public.challenge_window_end(c)
  ),
  per_card as (
    select card_id,
           bool_or(side = 'front') as has_front,
           bool_or(side = 'back')  as has_back,
           bool_or(status = 'pending') as has_pending
    from mine group by card_id
  ),
  me as (
    select s.points, s.rank
    from public.challenge_standings(c.id) s
    where s.user_id = v_uid
  )
  select coalesce((select me.points from me), 0),
         (select me.rank from me),
         (select count(*)::int from per_card where has_pending),
         (select count(*)::int from per_card where not (has_front and has_back));
end;
$$;

revoke execute on function public.challenge_current() from public, anon;
revoke execute on function public.challenge_leaderboard(bigint, integer, integer) from public, anon;
revoke execute on function public.challenge_my_stats(bigint) from public, anon;
grant execute on function public.challenge_current() to authenticated;
grant execute on function public.challenge_leaderboard(bigint, integer, integer) to authenticated;
grant execute on function public.challenge_my_stats(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC de administracion
-- ---------------------------------------------------------------------------

create or replace function public.challenge_assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.challenge_admin_create(p_slug text, p_title text, p_kind text default 'catalog_images')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  perform public.challenge_assert_admin();
  insert into public.challenges (slug, title, kind, created_by)
  values (p_slug, p_title, p_kind, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Fecha de cierre opcional (null = sin fecha). Solo antes de cerrar.
create or replace function public.challenge_admin_set_end(p_challenge_id bigint, p_ends_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  update public.challenges
  set ends_at = p_ends_at, updated_at = now()
  where id = p_challenge_id and status in ('draft', 'active');
  if not found then raise exception 'challenge not found or already closed'; end if;
end;
$$;

-- Activar: foto del catalogo elegible + estado, en la misma transaccion.
-- Elegible = toda card visible en este momento.
create or replace function public.challenge_admin_activate(p_challenge_id bigint, p_starts_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  perform public.challenge_assert_admin();
  update public.challenges
  set status = 'active', starts_at = coalesce(p_starts_at, now()), updated_at = now()
  where id = p_challenge_id and status = 'draft';
  if not found then raise exception 'challenge not found or not in draft'; end if;

  insert into public.challenge_eligible_cards (challenge_id, card_id)
  select p_challenge_id, c.id from public.cards c where c.is_visible;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cerrar la carga (tambien anticipadamente). Los aportes enviados hasta este
-- momento se siguen revisando y cuentan.
create or replace function public.challenge_admin_close(p_challenge_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  update public.challenges
  set status = 'reviewing', closed_at = now(), updated_at = now()
  where id = p_challenge_id and status = 'active';
  if not found then raise exception 'challenge not found or not active'; end if;
end;
$$;

-- Deshacer un cierre por error. No aplica a un concurso ya finalizado.
create or replace function public.challenge_admin_reopen(p_challenge_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  update public.challenges
  set status = 'active', closed_at = null, updated_at = now()
  where id = p_challenge_id and status = 'reviewing';
  if not found then raise exception 'challenge not found or not in review'; end if;
end;
$$;

create or replace function public.challenge_admin_void_point(
  p_challenge_id bigint, p_card_id integer, p_user_id uuid, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  perform public.challenge_assert_admin();
  if not exists (select 1 from public.challenges where id = p_challenge_id and status in ('active', 'reviewing')) then
    raise exception 'challenge not running';
  end if;
  insert into public.challenge_point_voids (challenge_id, card_id, user_id, reason, voided_by)
  values (p_challenge_id, p_card_id, p_user_id, trim(p_reason), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.challenge_admin_restore_point(p_void_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  update public.challenge_point_voids v
  set restored_by = auth.uid(), restored_at = now(), restore_reason = trim(p_reason)
  where v.id = p_void_id and v.restored_at is null
    and exists (select 1 from public.challenges c where c.id = v.challenge_id and c.status in ('active', 'reviewing'));
  if not found then raise exception 'void not found, already restored, or challenge finished'; end if;
end;
$$;

-- Resumen para el panel: aportes del periodo por estado y progreso.
create or replace function public.challenge_admin_overview(p_challenge_id bigint)
returns table (
  eligible_cards  integer,
  completed_cards integer,
  approved_images integer,
  pending_images  integer,
  rejected_images integer,
  participants    integer,
  active_voids    integer
)
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
    from public.challenge_eligible_cards e
    join public.card_images ci on ci.card_id = e.card_id
    where e.challenge_id = c.id
      and ci.source_type = 'community'
      and ci.created_at >= coalesce(c.starts_at, 'infinity')
      and ci.created_at <  public.challenge_window_end(c)
  )
  select (select count(*)::int from public.challenge_eligible_cards where challenge_id = c.id),
         (select count(*)::int from public.challenge_card_winners(c.id)),
         (select count(*)::int from imgs where status = 'approved' and taken_down_at is null),
         (select count(*)::int from imgs where status = 'pending'),
         (select count(*)::int from imgs where status = 'rejected'),
         (select count(distinct contributed_by)::int from imgs),
         (select count(*)::int from public.challenge_point_voids where challenge_id = c.id and restored_at is null);
end;
$$;

-- Clasificacion completa con ids y empates, solo admin.
create or replace function public.challenge_admin_standings(p_challenge_id bigint)
returns table (rank integer, user_id uuid, username text, points integer, reached_at timestamptz, tied boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.challenge_assert_admin();
  return query select * from public.challenge_standings(p_challenge_id);
end;
$$;

-- Aportes del periodo, filtrables por usuaria y estado. Marca cuales puntuan.
create or replace function public.challenge_admin_contributions(
  p_challenge_id bigint, p_user_id uuid default null, p_status public.image_status default null,
  p_limit integer default 100, p_offset integer default 0)
returns table (
  card_image_id bigint, card_id integer, side text, status public.image_status,
  contributed_by uuid, username text, created_at timestamptz, reviewed_at timestamptz,
  rejection_reason text, taken_down_at timestamptz, scores boolean)
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
  from public.challenge_eligible_cards e
  join public.card_images ci on ci.card_id = e.card_id
  where e.challenge_id = c.id
    and ci.source_type = 'community'
    and ci.created_at >= coalesce(c.starts_at, 'infinity')
    and ci.created_at <  public.challenge_window_end(c)
    and (p_user_id is null or ci.contributed_by = p_user_id)
    and (p_status is null or ci.status = p_status)
  order by ci.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Finalizar: exige que no quede nada pendiente del periodo, congela el ranking
-- y registra los premios. Irreversible a proposito.
create or replace function public.challenge_admin_finalize(p_challenge_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_pending integer;
  v_rows integer;
begin
  perform public.challenge_assert_admin();
  select * into c from public.challenges where id = p_challenge_id for update;
  if not found or c.status <> 'reviewing' then
    raise exception 'challenge must be in reviewing to finalize';
  end if;

  select count(*) into v_pending
  from public.challenge_eligible_cards e
  join public.card_images ci on ci.card_id = e.card_id
  where e.challenge_id = c.id
    and ci.source_type = 'community'
    and ci.status = 'pending'
    and ci.created_at >= c.starts_at
    and ci.created_at <  public.challenge_window_end(c);
  if v_pending > 0 then
    raise exception 'still % pending contributions from the challenge period', v_pending;
  end if;

  insert into public.challenge_results (challenge_id, position, user_id, username, points, reached_at)
  select c.id, s.rank, s.user_id, s.username, s.points, s.reached_at
  from public.challenge_standings(c.id) s;
  get diagnostics v_rows = row_count;

  insert into public.challenge_awards (challenge_id, user_id, position, premium_months)
  select c.id, r.user_id, r.position, (p.value ->> 'months')::int
  from public.challenge_results r
  join jsonb_array_elements(c.prizes) p on (p.value ->> 'place')::int = r.position
  where r.challenge_id = c.id;

  update public.challenges
  set status = 'finished', finalized_at = now(), updated_at = now()
  where id = c.id;

  return v_rows;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'challenge_assert_admin()',
    'challenge_admin_create(text, text, text)',
    'challenge_admin_set_end(bigint, timestamptz)',
    'challenge_admin_activate(bigint, timestamptz)',
    'challenge_admin_close(bigint)',
    'challenge_admin_reopen(bigint)',
    'challenge_admin_void_point(bigint, integer, uuid, text)',
    'challenge_admin_restore_point(bigint, text)',
    'challenge_admin_overview(bigint)',
    'challenge_admin_standings(bigint)',
    'challenge_admin_contributions(bigint, uuid, public.image_status, integer, integer)',
    'challenge_admin_finalize(bigint)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Supabase da EXECUTE a anon/authenticated de forma explicita: revocarlo de
-- PUBLIC no basta (aviso del advisor tras aplicar).
revoke execute on function public.card_images_log_event() from anon, authenticated;
revoke execute on function public.challenge_window_end(public.challenges) from anon, authenticated;
