-- FASE B.1 — Solo infraestructura: tabla `card_images`.
--
-- APLICADA el 2026-09-28 tras aprobacion explicita. Ver
-- docs/PURPLE_COLLECTOR_V2_MIGRATION.md.
--
-- Que hace:
--   crea los enums, la tabla, indices, constraints, RLS y policies que
--   sostienen el catalogo comunitario (attribution + moderacion).
--
-- Que NO hace, a proposito:
--   * no toca `cards.image_path` — la Android v1 ya publicada la lee, y
--     seguira siendo la unica fuente de imagen para esos clientes;
--   * no toca `user_cards` ni ningun id existente;
--   * no modifica la vista `cards_full` (eso es FASE E);
--   * no hace el backfill de las 4503 legacy (eso es un script aparte,
--     posterior al piloto ARIRANG);
--   * no crea ni mueve objetos de Storage, ni crea buckets.
--
-- Reversible con:
--   drop table if exists public.card_images;
--   drop type if exists image_status;
--   drop type if exists image_source_type;


-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------

-- `source_type` y `status` son conceptos SEPARADOS y ortogonales: de donde
-- viene la imagen vs en que punto del flujo de moderacion esta. Las
-- combinaciones validas son legacy+approved, community+pending,
-- community+approved, community+rejected (y admin+approved si se usa).
-- Deliberadamente NO existe un estado `legacy_hidden`: ocultar legacy es una
-- decision de presentacion, no un estado de la imagen.
do $$ begin
  create type public.image_source_type as enum ('legacy', 'community', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.image_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2. Tabla
-- ---------------------------------------------------------------------------

create table if not exists public.card_images (
  id                bigint generated always as identity primary key,

  -- `cards.id` es integer/serial (NO uuid). El tipo se copia tal cual: migrar
  -- ids romperia las 7400 filas de user_cards.
  card_id           integer not null
                      references public.cards(id) on delete cascade,

  -- Ruta dentro de `bucket_id`. Para legacy es exactamente el valor que hoy
  -- vive en cards.image_path, sin transformar.
  --
  -- `bucket_id` es texto SIN FK a storage.buckets, a proposito: asi esta
  -- migration no depende de que los buckets community existan todavia, y la
  -- CHECK de abajo es la que impide escribir un bucket que no corresponda.
  bucket_id         text    not null,
  storage_path      text    not null,

  source_type       public.image_source_type not null,
  status            public.image_status      not null,

  -- Imagen preferida para su propio source_type. La prioridad entre
  -- source_types (community > legacy) se resuelve en la lectura, NO aqui:
  -- asi una legacy aprobada sigue existiendo como fallback y reaparece sola
  -- si la community se retira. Ver "Regla de display" en el doc.
  is_primary        boolean not null default false,

  -- Attribution y moderacion.
  contributed_by    uuid    references auth.users(id) on delete set null,
  reviewed_by       uuid    references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,

  -- Aceptacion de derechos/terminos en el momento del envio.
  terms_accepted_at timestamptz,
  terms_version     text,

  -- Metadatos del archivo, poblados por el flujo de upload (FASE D).
  width             int,
  height            int,
  byte_size         int,

  -- Para community, `created_at` ES el momento de envio.
  created_at        timestamptz not null default now(),

  -- Un objeto de Storage se registra una sola vez. Esto es tambien lo que
  -- hace idempotentes el piloto y el backfill posterior
  -- (`on conflict (bucket_id, storage_path) do nothing`).
  constraint card_images_unique_object unique (bucket_id, storage_path),

  -- Cada source_type vive en su propio bucket. No se mezcla UGC con el bucket
  -- `photocards` de la v1. No se ata el bucket al `status` porque la
  -- aprobacion mueve el objeto DESPUES de cambiar el estado, y una CHECK asi
  -- rompería ese paso intermedio.
  constraint card_images_bucket_matches_source check (
    case source_type
      when 'legacy'    then bucket_id = 'photocards'
      when 'community' then bucket_id in ('photocard-community',
                                          'photocard-community-review')
      else true
    end
  ),

  -- Las legacy son, por definicion, contenido ya publicado en la v1.
  constraint card_images_legacy_is_approved check (
    source_type <> 'legacy' or status = 'approved'
  ),

  -- Una imagen aportada siempre tiene autor y aceptacion de terminos.
  constraint card_images_community_has_author check (
    source_type <> 'community' or contributed_by is not null
  ),
  constraint card_images_community_has_terms check (
    source_type <> 'community'
      or (terms_accepted_at is not null and terms_version is not null)
  ),

  -- Una community resuelta deja rastro de quien la resolvio y cuando.
  constraint card_images_community_reviewed_has_reviewer check (
    source_type <> 'community'
      or status = 'pending'
      or (reviewed_by is not null and reviewed_at is not null)
  ),

  -- Un rechazo sin motivo no se le puede mostrar al contributor.
  constraint card_images_rejected_has_reason check (
    status <> 'rejected' or rejection_reason is not null
  ),

  -- Invariante duro: una imagen pending o rejected NUNCA puede ser primaria,
  -- o sea nunca puede convertirse en la imagen publica de una card. Esto no
  -- depende de ningun filtro del frontend.
  constraint card_images_primary_is_approved check (
    not is_primary or status = 'approved'
  )
);


-- ---------------------------------------------------------------------------
-- 3. Indices
-- ---------------------------------------------------------------------------

-- Camino caliente: resolver la(s) imagen(es) de un conjunto de cards.
create index if not exists card_images_card_id_idx
  on public.card_images (card_id);

-- Una sola primaria aprobada POR source_type. Permite coexistir
-- legacy+approved+primary (fallback) y community+approved+primary (preferida).
create unique index if not exists card_images_one_primary_per_source
  on public.card_images (card_id, source_type)
  where is_primary and status = 'approved';

-- Bandeja de moderacion.
create index if not exists card_images_pending_idx
  on public.card_images (created_at)
  where status = 'pending';

-- "Mis contribuciones" y acciones sobre un contributor.
create index if not exists card_images_contributed_by_idx
  on public.card_images (contributed_by)
  where contributed_by is not null;


-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

alter table public.card_images enable row level security;

-- Lectura publica: SOLO aprobadas. Sin sesion, una pending o rejected no
-- existe. (`public` incluye a `anon`, igual que las policies de `cards`.)
drop policy if exists "card_images public read approved" on public.card_images;
create policy "card_images public read approved"
  on public.card_images for select
  to public
  using (status = 'approved');

-- El contributor ve sus propias imagenes en cualquier estado — necesario para
-- "tu imagen en revision" y para mostrarle el motivo de rechazo.
drop policy if exists "card_images contributor reads own" on public.card_images;
create policy "card_images contributor reads own"
  on public.card_images for select
  to authenticated
  using (contributed_by = auth.uid());

-- Envio de una aportacion. El WITH CHECK fija los campos que el cliente NO
-- puede elegir: no puede autoaprobarse, no puede marcarse primaria, no puede
-- atribuirse a otra persona, no puede escribir en el bucket publico y no
-- puede omitir la aceptacion de terminos.
drop policy if exists "card_images contributor submits own" on public.card_images;
create policy "card_images contributor submits own"
  on public.card_images for insert
  to authenticated
  with check (
    source_type = 'community'
    and status = 'pending'
    and contributed_by = auth.uid()
    and is_primary = false
    and bucket_id = 'photocard-community-review'
    and terms_accepted_at is not null
    and terms_version is not null
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
  );

-- Retirar un envio propio mientras siga pendiente. Una vez resuelto ya no le
-- pertenece: la traza de moderacion tiene que sobrevivir.
-- OJO (FASE D): borrar la fila no borra el objeto de Storage. La limpieza del
-- objeto va en el mismo flujo de "retirar envio", no aqui.
drop policy if exists "card_images contributor deletes own pending" on public.card_images;
create policy "card_images contributor deletes own pending"
  on public.card_images for delete
  to authenticated
  using (contributed_by = auth.uid() and status = 'pending');

-- Moderacion. `is_admin()` ya existe y es el mismo gate que usan las policies
-- `admin_all_*` del resto del catalogo.
drop policy if exists "card_images admin all" on public.card_images;
create policy "card_images admin all"
  on public.card_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------

-- Los grants abren la tabla en PostgREST; la RLS de arriba es la que decide
-- que filas se ven. `anon` solo lee.
grant select                         on public.card_images to anon;
grant select, insert, update, delete on public.card_images to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Documentacion en el catalogo
-- ---------------------------------------------------------------------------

comment on table public.card_images is
  'Imagenes de una card. source_type = procedencia (legacy/community/admin); '
  'status = estado de moderacion (pending/approved/rejected). Sustituye '
  'conceptualmente a cards.image_path, que se conserva intacta por '
  'compatibilidad con la Android v1 publicada.';

comment on column public.card_images.is_primary is
  'Imagen preferida dentro de su source_type. La prioridad community > legacy '
  'se resuelve en la lectura, no aqui.';

comment on column public.card_images.created_at is
  'Para source_type = community, es el momento del envio.';
