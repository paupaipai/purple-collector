-- BUG-5 — `cards_full` expone country, draw_type y category_sort_order.
--
-- La vista no los exponia, asi que hooks/useCards.ts tenia que recomponerlos en
-- cliente con DOS consultas extra por cada apertura de album:
--
--   supabase.from('cards').select('id, country, draw_type').eq('album_id', ...)
--   supabase.from('card_categories').select('id, sort_order')
--
-- y despues armaba tres diccionarios (countryMap, drawTypeMap,
-- categoryOrderMap) para pegarlos fila por fila. Todo eso para datos que la
-- vista ya tiene a mano: country y draw_type estan en `cards`, que es la tabla
-- base, y sort_order esta en `card_categories`, que ya viene joineada para
-- category_name y category_color.
--
-- Los tres se usan para ORDENAR la grilla del album (DRAW_TYPE_ORDER,
-- COUNTRY_ORDER y el agrupado por categoria), o sea que no son opcionales: sin
-- ellos el orden se cae al default.
--
-- Aditiva otra vez: las 29 columnas anteriores quedan en el mismo orden y tipo,
-- las tres nuevas van al final. La Android v1 publicada no nota el cambio.
--
-- security_invoker = true se declara explicitamente para no perderlo en el
-- replace (SR-1), igual que en FASE E.
--
-- Esto es una optimizacion de rendimiento, no una correccion: el resultado en
-- pantalla es el mismo. Lo que cambia es que la pantalla mas usada de la app
-- pasa de 4 consultas a 2.
--
-- Reversible: volver a la definicion de FASE E, sin las tres columnas finales.

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
  cc.sort_order as category_sort_order
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
