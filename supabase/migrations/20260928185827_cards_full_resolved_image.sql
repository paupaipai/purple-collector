-- FASE E — `cards_full` resuelve la imagen desde `card_images`.
--
-- Implementa la regla de display documentada:
--   1. community + approved + primary
--   2. admin     + approved + primary
--   3. legacy    + approved + primary   (fallback)
--   4. sin imagen -> placeholder (todo null)
--
-- Aditiva: las 25 columnas existentes quedan en el mismo orden y con el mismo
-- tipo, y `image_path` SE CONSERVA. La Android v1 publicada sigue leyendola sin
-- notar el cambio; las 4 columnas nuevas van al final.
--
-- El LEFT JOIN LATERAL con LIMIT 1 garantiza UNA fila por card. Un join normal
-- contra card_images multiplicaria las filas en cuanto una card tenga mas de
-- una imagen, y los hooks paginan de a 1000 asumiendo una fila por card.
--
-- security_invoker se declara explicitamente para no perderlo en el replace
-- (SR-1). Es lo que hace que la RLS de card_images aplique al que consulta. El
-- filtro status = 'approved' del lateral es redundante con esa RLS a proposito:
-- un contributor autenticado SI puede ver sus propias filas pending, y sin ese
-- filtro una pending suya podria ganarle a la legacy en su propia sesion.
--
-- Reversible: volver a la definicion anterior, sin el lateral ni las 4
-- columnas nuevas.

create or replace view public.cards_full
with (security_invoker = true) as
select
  c.id,
  c.code,
  c.member,
  c.member_full_name,
  c.member_emoji,
  c.card_name,
  c.retailer,
  c.rarity,
  c.image_path,
  c.is_group,
  c.is_blurred,
  c.release_date,
  c.notes,
  a.id   as album_id,
  a.name as album_name,
  a.short_name as album_short,
  a.color as album_color,
  a.cover_image_url as album_cover,
  av.id as version_id,
  av.name as version_name,
  av.short_name as version_short,
  cc.id as category_id,
  cc.name as category_name,
  cc.short_name as category_short,
  cc.color as category_color,
  -- Columnas nuevas, al final.
  img.storage_path   as primary_image_path,
  img.bucket_id      as primary_image_bucket,
  img.source_type    as primary_image_source,
  img.contributed_by as primary_image_contributed_by
from cards c
  join albums a on a.id = c.album_id
  left join album_versions av on av.id = c.version_id
  join card_categories cc on cc.id = c.category_id
  left join lateral (
    select ci.storage_path, ci.bucket_id, ci.source_type, ci.contributed_by
    from public.card_images ci
    where ci.card_id = c.id
      and ci.status = 'approved'
      and ci.is_primary
    order by case ci.source_type
               when 'community' then 0
               when 'admin'     then 1
               else 2
             end
    limit 1
  ) img on true
where c.is_visible = true
order by a.sort_order, cc.sort_order, c.member, c.card_name;
