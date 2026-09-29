-- FASE G — `cards_full` expone el id de la imagen resuelta.
--
-- Para reportar una imagen hace falta su `card_images.id`, y la vista devolvia
-- la ruta, el bucket, el origen y el autor pero no el id. Sin el, la app tendria
-- que buscar la fila por (card_id, storage_path) en una consulta aparte solo
-- para poder enviar un reporte.
--
-- Aditiva, como las dos veces anteriores: las 32 columnas quedan en el mismo
-- orden y tipo, `primary_image_id` va al final. security_invoker explicito para
-- no perder SR-1.

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
  -- FASE E: imagen resuelta segun la regla de display.
  img.storage_path   as primary_image_path,
  img.bucket_id      as primary_image_bucket,
  img.source_type    as primary_image_source,
  img.contributed_by as primary_image_contributed_by,
  -- BUG-5: datos de ordenamiento que antes se pedian aparte.
  c.country,
  c.draw_type,
  cc.sort_order as category_sort_order,
  -- FASE G: para poder reportar la imagen que se esta viendo.
  img.id as primary_image_id
from cards c
  join albums a on a.id = c.album_id
  left join album_versions av on av.id = c.version_id
  join card_categories cc on cc.id = c.category_id
  left join lateral (
    select ci.id, ci.storage_path, ci.bucket_id, ci.source_type, ci.contributed_by
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
