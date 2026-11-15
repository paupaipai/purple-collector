-- Frente y reverso de cada photocard.
--
-- Hasta ahora `card_images` no distinguia lados: habia una sola primaria por
-- (card, source_type). Para aportar el reverso hace falta saber de que lado es
-- cada imagen y permitir una primaria POR LADO.
--
-- Compatibilidad:
--   * Todas las filas existentes quedan como 'front' (default), asi que nada de
--     lo publicado cambia de comportamiento.
--   * `cards.image_path` NO se toca (decision D1): la Android 1.0.4 y anteriores
--     siguen leyendo el frente de ahi.
--   * La vista solo AGREGA columnas al final; los clientes viejos las ignoran.

-- ---------------------------------------------------------------------------
-- 1. El lado de cada imagen
-- ---------------------------------------------------------------------------

alter table public.card_images
  add column if not exists side text not null default 'front';

alter table public.card_images
  drop constraint if exists card_images_side_valid;
alter table public.card_images
  add constraint card_images_side_valid check (side in ('front', 'back'));

-- Una primaria aprobada por (card, fuente, LADO). Antes era por (card, fuente),
-- lo que impedia tener frente y reverso a la vez.
drop index if exists public.card_images_one_primary_per_source;
create unique index card_images_one_primary_per_source
  on public.card_images (card_id, source_type, side)
  where is_primary and status = 'approved';

-- ---------------------------------------------------------------------------
-- 2. Reverso opcional en las propuestas de card nueva
-- ---------------------------------------------------------------------------
-- Vive en el mismo bucket privado de revision que el frente. Al aprobar la
-- propuesta, moderate-card-submission publica el frente y deja el reverso como
-- un card_images 'pending' normal, que se modera aparte (por separado, como
-- cualquier otro aporte).

alter table public.card_submissions
  add column if not exists back_storage_path text,
  add column if not exists back_width integer,
  add column if not exists back_height integer,
  add column if not exists back_byte_size integer;

-- La policy de INSERT exige que el reverso sea un objeto PROPIO (primer
-- segmento = uid), igual que exige la policy de Storage al subirlo. Sin esto un
-- cliente modificado podria apuntar al objeto de otra persona.
-- (No es un CHECK: submitted_by pasa a null si se borra la cuenta, y un CHECK
-- que lo use haria fallar ese borrado.)
drop policy if exists "card_submissions submitter creates own" on public.card_submissions;
create policy "card_submissions submitter creates own"
  on public.card_submissions
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'::public.image_status
    and bucket_id = 'photocard-community-review'
    and terms_accepted_at is not null
    and terms_version is not null
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and created_card_id is null
    and (back_storage_path is null or split_part(back_storage_path, '/', 1) = auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 3. cards_full: el frente filtra por lado y se agrega el reverso al final
-- ---------------------------------------------------------------------------

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
  a.id as album_id,
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
  img.storage_path as primary_image_path,
  img.bucket_id as primary_image_bucket,
  img.source_type as primary_image_source,
  img.contributed_by as primary_image_contributed_by,
  c.country,
  c.draw_type,
  cc.sort_order as category_sort_order,
  img.id as primary_image_id,
  img.contributor_handle as primary_image_handle,
  -- Solo el FRENTE retirado deja la card "sin imagen": retirar un reverso no
  -- debe esconder el frente.
  (exists (
    select 1 from public.card_images ci2
    where ci2.card_id = c.id and ci2.taken_down_at is not null and ci2.side = 'front'
  )) as image_retired,
  back.storage_path as back_image_path,
  back.bucket_id as back_image_bucket,
  back.source_type as back_image_source,
  back.id as back_image_id,
  back.contributor_handle as back_image_handle
from public.cards c
  join public.albums a on a.id = c.album_id
  left join public.album_versions av on av.id = c.version_id
  join public.card_categories cc on cc.id = c.category_id
  left join lateral (
    select ci.id, ci.storage_path, ci.bucket_id, ci.source_type, ci.contributed_by, ci.contributor_handle
    from public.card_images ci
    where ci.card_id = c.id and ci.status = 'approved' and ci.is_primary and ci.side = 'front'
    order by case ci.source_type when 'community' then 0 when 'admin' then 1 else 2 end
    limit 1
  ) img on true
  left join lateral (
    select ci.id, ci.storage_path, ci.bucket_id, ci.source_type, ci.contributor_handle
    from public.card_images ci
    where ci.card_id = c.id and ci.status = 'approved' and ci.is_primary and ci.side = 'back'
    order by case ci.source_type when 'community' then 0 when 'admin' then 1 else 2 end
    limit 1
  ) back on true
where c.is_visible = true
order by a.sort_order, cc.sort_order, c.member, c.card_name;
