-- `cards_full` expone el handle del contributor.
--
-- Sale de card_images.contributor_handle, que el trigger mantiene al dia, asi
-- que NO hace falta joinear user_profiles: ni un definer view, ni una consulta
-- extra en el camino caliente, ni chocar con la RLS que cerro SR-2.
--
-- Aditiva: las 33 columnas quedan igual y en el mismo orden.

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
  img.storage_path   as primary_image_path,
  img.bucket_id      as primary_image_bucket,
  img.source_type    as primary_image_source,
  img.contributed_by as primary_image_contributed_by,
  c.country,
  c.draw_type,
  cc.sort_order as category_sort_order,
  img.id as primary_image_id,
  img.contributor_handle as primary_image_handle
from cards c
  join albums a on a.id = c.album_id
  left join album_versions av on av.id = c.version_id
  join card_categories cc on cc.id = c.category_id
  left join lateral (
    select ci.id, ci.storage_path, ci.bucket_id, ci.source_type,
           ci.contributed_by, ci.contributor_handle
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
