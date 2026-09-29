-- FASE G — `image_reports`: reportes de usuarios sobre una imagen.
--
-- Cierra la ultima pieza de FASE G y cubre la tarea 37 del roadmap (canal y
-- procedimiento de copyright). Un reporte puede apuntar a CUALQUIER fila de
-- card_images, no solo a las community: reportar una legacy por copyright es
-- justamente el caso que mas importa, porque las 4503 son de terceros.
--
-- OJO, limitacion conocida y documentada aparte: retirar de verdad una imagen
-- LEGACY no se resuelve borrando su fila de card_images, porque
-- getCardImageUrl() cae de vuelta a cards.image_path y la Android v1 publicada
-- lee esa columna directamente. Ver la nota sobre takedown en
-- docs/PURPLE_COLLECTOR_V2_MIGRATION.md.

do $$ begin
  create type public.report_reason as enum (
    'wrong_card',     -- la imagen no corresponde a esa card
    'duplicate',      -- ya existe la misma imagen
    'copyright',      -- reclamo de derechos
    'inappropriate',  -- contenido inapropiado
    'low_quality',    -- calidad o encuadre malos
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum (
    'open',
    'resolved_kept',     -- revisado, la imagen se queda
    'resolved_removed',  -- revisado, la imagen se retiro
    'dismissed'          -- reporte improcedente
  );
exception when duplicate_object then null; end $$;

create table if not exists public.image_reports (
  id            bigint generated always as identity primary key,

  card_image_id bigint not null
                  references public.card_images(id) on delete cascade,

  -- on delete set null: si la persona borra su cuenta el reporte sobrevive. Un
  -- reclamo de copyright no puede desaparecer porque quien lo hizo se fue.
  reported_by   uuid references auth.users(id) on delete set null,

  reason        public.report_reason not null,
  detail        text,

  status        public.report_status not null default 'open',
  resolved_by   uuid references auth.users(id) on delete set null,
  resolved_at   timestamptz,
  resolution_note text,

  created_at    timestamptz not null default now(),

  -- Una persona reporta una imagen una sola vez. Evita que un mismo usuario
  -- infle la cola. Varios NULL conviven, asi que borrar la cuenta del autor no
  -- rompe la restriccion.
  constraint image_reports_one_per_user unique (card_image_id, reported_by),

  -- Un reporte resuelto deja rastro de quien y cuando.
  constraint image_reports_resolved_has_reviewer check (
    status = 'open' or (resolved_by is not null and resolved_at is not null)
  )
);

-- Bandeja de reportes: la consulta caliente es "los abiertos, mas antiguo
-- primero".
create index if not exists image_reports_open_idx
  on public.image_reports (created_at)
  where status = 'open';

-- Cuantos reportes tiene una imagen, y "ya reporte esto".
create index if not exists image_reports_card_image_idx
  on public.image_reports (card_image_id);
create index if not exists image_reports_reported_by_idx
  on public.image_reports (reported_by)
  where reported_by is not null;

alter table public.image_reports enable row level security;

-- NO hay policy de lectura publica, a diferencia de card_images: un reporte es
-- entre quien lo hace y el mantenedor. Que fuera publico lo convertiria en una
-- senal social.
drop policy if exists "image_reports reporter reads own" on public.image_reports;
create policy "image_reports reporter reads own"
  on public.image_reports for select
  to authenticated
  using (reported_by = auth.uid());

-- El WITH CHECK fija lo que el cliente no puede elegir: no puede abrir un
-- reporte en nombre de otro ni darlo por resuelto.
drop policy if exists "image_reports reporter creates own" on public.image_reports;
create policy "image_reports reporter creates own"
  on public.image_reports for insert
  to authenticated
  with check (
    reported_by = auth.uid()
    and status = 'open'
    and resolved_by is null
    and resolved_at is null
    and resolution_note is null
  );

-- Sin UPDATE ni DELETE para el autor: un reporte enviado no se edita ni se
-- retira. Si fuera improcedente, el mantenedor lo marca 'dismissed'.

drop policy if exists "image_reports admin all" on public.image_reports;
create policy "image_reports admin all"
  on public.image_reports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- CORRECCION: este comentario decia originalmente que "anon no recibe ningun
-- grant". Era FALSO -- los `alter default privileges` de Supabase se lo dan al
-- crear la tabla. Se revoca en la migration siguiente
-- (20260929150416_revoke_anon_image_reports.sql). La RLS ya lo bloqueaba de
-- todos modos, porque las tres policies son `to authenticated`.
--
-- El UPDATE/DELETE de authenticated existe solo para que la policy de admin
-- pueda actuar; a un usuario normal la RLS no le deja ninguna fila.
grant select, insert, update, delete on public.image_reports to authenticated;

comment on table public.image_reports is
  'Reportes de usuarios sobre una imagen de card_images. Puede apuntar a una '
  'legacy (reclamo de copyright) o a una community. Sin lectura publica.';
