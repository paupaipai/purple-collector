-- Reversa de 20261126221223_challenge_quality_replacement.sql.
-- Vive fuera de migrations/ a proposito (el CLI tomaria cualquier <version>_*.sql); se corre a mano.
-- Antes de correrla, volver a desplegar moderate-card-image en la version que
-- no llama a moderate_approve_image, o las aprobaciones fallaran.
-- No toca los puntos: no cambia is_primary ni status de ninguna fila.

drop function if exists public.challenge_my_image_states(bigint);
drop function if exists public.moderate_restore_image(bigint, text);
drop function if exists public.moderate_approve_image(bigint, text, text, text, uuid, text);

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
       new.rejection_reason, coalesce(auth.uid(), new.reviewed_by));
  end if;
  return new;
end; $$;

drop index if exists public.card_images_replaced_by_idx;
alter table public.card_images
  drop column if exists moderation_note,
  drop column if exists replaced_at,
  drop column if exists replaced_by;
