-- Community Challenge v2: reemplazo por calidad, aprobacion atomica y estado
-- de cada aporte para quien lo envio.
--
-- NO cambia como se calculan los puntos: eso ya lo hace challenge_side_holders
-- (20261126153928_challenge_half_points): cada lado vale 0,5 y es de quien
-- aporto la imagen PRIMARIA, aprobada, vigente y elegible de ese lado.
--
-- Decisiones de la usuaria (2026-11-26):
--   - Se mantiene v2 en produccion.
--   - Un reemplazo NO elegible (enviado tras el cierre, o de una card fuera del
--     catalogo inicial) igual pasa a ser la imagen vigente, y quien tenia el
--     lado PIERDE los 0,5: el lado queda sin puntos para nadie. Es lo que ya
--     hace challenge_side_holders; queda documentado aqui y en las reglas.
--   - Los reemplazos hechos antes de esta migracion se dejan como estan.
--
-- Que agrega:
--   1. card_images.replaced_by / replaced_at: rastro de que imagen reemplazo a
--      cual. La fila reemplazada se conserva (historial y reconocimiento).
--   2. card_images.moderation_note: motivo de una aprobacion, reemplazo o
--      recuperacion; el trigger de eventos lo guarda en card_image_events.reason.
--   3. moderate_approve_image(): bajar la primaria anterior y subir la nueva en
--      UNA transaccion, con la fila bloqueada. Corrige el bug que dejo la card
--      2186 sin reverso: un doble clic hacia "bajar la anterior" dos veces y la
--      segunda vez bajaba la recien aprobada.
--   4. moderate_restore_image(): recuperar una imagen anterior valida cuando la
--      vigente se invalida.
--   5. challenge_my_image_states(): para "Mis aportes", que imagenes propias
--      suman hoy y por que no suma cada una de las otras.
--
-- Reversible con supabase/rollbacks/20261126221223_challenge_quality_replacement.down.sql.

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
alter table public.card_images
  add column if not exists replaced_by bigint references public.card_images(id) on delete set null,
  add column if not exists replaced_at timestamptz,
  add column if not exists moderation_note text;

create index if not exists card_images_replaced_by_idx
  on public.card_images (replaced_by) where replaced_by is not null;

-- Backfill: las aprobadas no primarias de un lado que hoy tiene primaria
-- community fueron reemplazadas por esa primaria. replaced_at = cuando se
-- aprobo la nueva (es cuando se bajo la anterior).
update public.card_images old
set replaced_by = cur.id, replaced_at = coalesce(cur.reviewed_at, now())
from public.card_images cur
where old.source_type = 'community' and old.status = 'approved' and not old.is_primary
  and old.taken_down_at is null and old.replaced_by is null
  and cur.card_id = old.card_id and cur.side = old.side and cur.source_type = 'community'
  and cur.status = 'approved' and cur.is_primary and cur.id <> old.id;

-- OJO: authenticated tiene SELECT de tabla completa en card_images, asi que
-- quien aporto VE replaced_at, replaced_by y moderation_note de SUS filas.
-- replaced_by es solo un id (la fila de la otra persona no la puede leer).
-- moderation_note no debe llevar nada interno: es un motivo para ella.

-- ---------------------------------------------------------------------------
-- 2. El trigger de eventos guarda tambien el motivo de aprobaciones
-- ---------------------------------------------------------------------------
create or replace function public.card_images_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.card_image_events
      (card_image_id, card_id, side, source_type, contributed_by, event, new_status, new_is_primary, taken_down_at, actor)
    values (new.id, new.card_id, new.side, new.source_type, new.contributed_by, 'insert',
       new.status, new.is_primary, new.taken_down_at, coalesce(auth.uid(), new.contributed_by));
  elsif new.status is distinct from old.status
     or new.is_primary is distinct from old.is_primary
     or new.taken_down_at is distinct from old.taken_down_at then
    insert into public.card_image_events
      (card_image_id, card_id, side, source_type, contributed_by, event,
       old_status, new_status, old_is_primary, new_is_primary, taken_down_at, reason, actor)
    values (new.id, new.card_id, new.side, new.source_type, new.contributed_by, 'update',
       old.status, new.status, old.is_primary, new.is_primary, new.taken_down_at,
       coalesce(new.rejection_reason, new.moderation_note), coalesce(auth.uid(), new.reviewed_by));
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. Aprobar: nuevo aporte o reemplazo por calidad
-- ---------------------------------------------------------------------------
-- La llama la edge function moderate-card-image con service_role, DESPUES de
-- copiar el archivo al bucket publico. auth.uid() es null ahi, por eso el
-- admin llega en p_actor (la edge function ya verifico is_admin).
--
-- p_mode:
--   'new'     el lado no tiene imagen community vigente. Si ya tiene, error
--             side_has_image: no se puede quitar los puntos a nadie por accidente.
--   'replace' el lado tiene imagen vigente y la nueva es claramente mejor. Si
--             el lado esta vacio, error side_empty.
--   'auto'    para el mantenedor viejo que no manda modo: reemplaza si hay
--             vigente. Mismo resultado que antes, pero atomico.
--
-- Errores (la edge function los traduce a 409): already_moderated,
-- side_has_image, side_empty, not_found, not_community.
create or replace function public.moderate_approve_image(
  p_image_id bigint, p_mode text, p_bucket text, p_path text, p_actor uuid, p_note text default null)
returns table (approved_id bigint, replaced_id bigint, replaced_user uuid, replaced_was_scoring boolean, mode text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.card_images;
  prev public.card_images;
  v_mode text := coalesce(p_mode, 'auto');
  v_now timestamptz := now();
  v_was_scoring boolean := false;
begin
  if v_mode not in ('new', 'replace', 'auto') then raise exception 'bad_mode'; end if;

  -- Bloquear la fila: una segunda llamada concurrente espera aqui y luego ve
  -- status = 'approved', asi que sale con already_moderated sin tocar nada.
  select * into r from public.card_images where id = p_image_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.source_type <> 'community' then raise exception 'not_community'; end if;
  if r.status <> 'pending' then raise exception 'already_moderated'; end if;

  -- La vigente del mismo lado, tambien bloqueada: dos reemplazos simultaneos
  -- del mismo lado se serializan aqui.
  select * into prev from public.card_images
  where card_id = r.card_id and side = r.side and source_type = 'community'
    and status = 'approved' and is_primary
  for update;

  if v_mode = 'new' and prev.id is not null then raise exception 'side_has_image'; end if;
  if v_mode = 'replace' and prev.id is null then raise exception 'side_empty'; end if;

  if prev.id is not null then
    -- Para el aviso: solo se le dice "perdiste 0,5" si de verdad los tenia.
    select exists (
      select 1 from public.challenges c, public.challenge_side_holders(c.id) h
      where c.status in ('active', 'reviewing') and h.image_id = prev.id
    ) into v_was_scoring;
    update public.card_images
    set is_primary = false, replaced_by = r.id, replaced_at = v_now,
        moderation_note = coalesce(nullif(trim(p_note), ''), 'Reemplazada por una imagen de mejor calidad')
    where id = prev.id;
  end if;

  -- Si dos aprobaciones 'new' del mismo lado corren a la vez, ninguna ve
  -- primaria y la segunda choca con card_images_one_primary_per_source: la
  -- transaccion entera se deshace y el tope de 0,5 por lado se mantiene.
  update public.card_images
  set status = 'approved', bucket_id = p_bucket, storage_path = p_path, is_primary = true,
      reviewed_by = p_actor, reviewed_at = v_now, rejection_reason = null,
      moderation_note = nullif(trim(p_note), '')
  where id = r.id;

  return query select r.id, prev.id, prev.contributed_by, v_was_scoring,
    case when prev.id is null then 'new' else 'replace' end;
end; $$;

revoke execute on function public.moderate_approve_image(bigint, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_approve_image(bigint, text, text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Recuperar una imagen anterior valida
-- ---------------------------------------------------------------------------
-- Para despues de invalidar (takedown) la vigente: la imagen elegida vuelve a
-- ser la primaria del lado, y con eso sus 0,5 vuelven a quien la aporto si es
-- elegible. Solo si el lado quedo sin imagen vigente.
create or replace function public.moderate_restore_image(p_image_id bigint, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare r public.card_images;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  select * into r from public.card_images where id = p_image_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.source_type <> 'community' or r.status <> 'approved' or r.is_primary or r.taken_down_at is not null then
    raise exception 'not_restorable';
  end if;
  perform 1 from public.card_images
  where card_id = r.card_id and side = r.side and source_type = 'community' and status = 'approved' and is_primary
  for update;
  if found then raise exception 'side_has_image'; end if;
  update public.card_images
  set is_primary = true, replaced_by = null, replaced_at = null,
      reviewed_by = auth.uid(), moderation_note = 'Recuperada: ' || trim(p_reason)
  where id = r.id;
  return r.id;
end; $$;

revoke execute on function public.moderate_restore_image(bigint, text) from public, anon;
grant execute on function public.moderate_restore_image(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Estado de cada imagen propia en el concurso
-- ---------------------------------------------------------------------------
-- state:
--   scoring        aprobada, vigente y elegible: 0,5 puntos
--   pending        en revision
--   rejected       rechazada
--   taken_down     retirada o invalidada despues de aprobarse
--   replaced       reemplazada por una de mejor calidad (sus 0,5 pasaron a la nueva)
--   not_eligible   card fuera del catalogo inicial, o enviada fuera de plazo
--   voided         puntos anulados por un admin
-- No expone quien la reemplazo.
create or replace function public.challenge_my_image_states(p_challenge_id bigint)
returns table (card_image_id bigint, state text, points numeric, changed_at timestamptz)
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
  with h as (select image_id from public.challenge_side_holders(c.id))
  select ci.id,
    case
      when ci.id in (select image_id from h) then 'scoring'
      when ci.status = 'pending' then 'pending'
      when ci.taken_down_at is not null then 'taken_down'
      when ci.status = 'rejected' then 'rejected'
      when ci.replaced_by is not null and not ci.is_primary then 'replaced'
      when not exists (select 1 from public.challenge_eligible_cards e where e.challenge_id = c.id and e.card_id = ci.card_id)
        or ci.created_at < c.starts_at or ci.created_at >= public.challenge_window_end(c) then 'not_eligible'
      when exists (select 1 from public.challenge_point_voids v where v.challenge_id = c.id and v.card_id = ci.card_id
                   and v.user_id = v_uid and v.restored_at is null) then 'voided'
      else 'not_eligible'
    end,
    case when ci.id in (select image_id from h) then 0.5 else 0 end::numeric,
    -- Cuando paso lo que le quito los puntos: para marcarlo "Nuevo" en Mis aportes.
    coalesce(ci.taken_down_at, case when not ci.is_primary then ci.replaced_at end)
  from public.card_images ci
  where ci.contributed_by = v_uid and ci.source_type = 'community';
end; $$;

revoke execute on function public.challenge_my_image_states(bigint) from public, anon;
grant execute on function public.challenge_my_image_states(bigint) to authenticated;
