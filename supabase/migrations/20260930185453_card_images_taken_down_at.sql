-- `taken_down_at`: marca explicita de imagen retirada.
--
-- La app necesita distinguir "esta card nunca tuvo imagen" de "la imagen se
-- retiro", porque se muestran distinto. No hay forma fiable de deducirlo del
-- estado que ya existe:
--
--   * `is_primary = false` no sirve: una aportacion RECHAZADA tambien lo tiene
--     (hay una en la base ahora mismo), y eso no es un retiro;
--   * `status` tampoco: una legacy retirada sigue en 'approved' porque la
--     constraint card_images_legacy_is_approved no deja marcarla de otro modo.
--
-- Asi que se marca explicitamente. De paso da la fecha del retiro, que antes no
-- quedaba en ningun lado -- reviewed_at se reusaba para eso y se confundia con
-- la revision de una aportacion.

alter table public.card_images
  add column if not exists taken_down_at timestamptz;

comment on column public.card_images.taken_down_at is
  'Cuando se retiro la imagen del catalogo. Null si nunca se retiro. Distingue '
  'un retiro de una aportacion rechazada, que tambien queda sin is_primary.';

-- Bandeja de retiros y la consulta de la vista.
create index if not exists card_images_taken_down_idx
  on public.card_images (card_id)
  where taken_down_at is not null;

-- Backfill: los unicos retiros que existen son las legacy sin is_primary. El
-- backfill original las creo TODAS con is_primary = true, asi que perder esa
-- marca solo puede venir de un takedown. Se usa reviewed_at, que es lo que la
-- edge function grabo en su momento.
update public.card_images
set taken_down_at = coalesce(reviewed_at, now())
where source_type = 'legacy'
  and not is_primary
  and taken_down_at is null;
