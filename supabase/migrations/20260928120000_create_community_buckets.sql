-- FASE C.1 — Buckets de UGC y sus policies.
--
-- Decision D3 + "usa los 3 buckets" (2026-09-28). Los tres buckets son:
--
--   photocards                  public   YA EXISTE. Legacy. NO SE TOCA: es lo
--                                        que lee la Android v1 publicada.
--   photocard-community         public   Solo imagenes APROBADAS.
--   photocard-community-review  PRIVADO  pending y rejected.
--
-- Por que tres y no dos: un bucket de Supabase con public = true sirve todos
-- sus objetos por /object/public SIN evaluar RLS. Un unico bucket publico de
-- UGC haria accesibles las pending; un unico bucket privado obligaria a URLs
-- firmadas con expiracion para todo, rompiendo el cache en disco de
-- expo-image. Separando por estado, una pending nunca tiene URL publica y las
-- aprobadas conservan el patron actual de getPublicUrl.
--
-- Al aprobar, el objeto se MUEVE de ...-review a photocard-community y se
-- actualiza card_images.bucket_id / storage_path. Por eso card_images.bucket_id
-- existe como columna y por eso su CHECK no esta atada al status.
--
-- Convencion de ruta en ...-review:  <auth.uid()>/<uuid>.<ext>
-- La propiedad es derivable del path, sin join.

-- ---------------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photocard-community',        'photocard-community',        true,  5242880,
    array['image/jpeg','image/png','image/webp']),
  ('photocard-community-review', 'photocard-community-review', false, 5242880,
    array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. Policies de photocard-community-review (privado)
-- ---------------------------------------------------------------------------

-- Leer: solo el autor y los admins. No hay policy para `public`: el bucket es
-- privado, asi que una pending no tiene URL publica posible.
drop policy if exists "community review read own or admin" on storage.objects;
create policy "community review read own or admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photocard-community-review'
    and ( (storage.foldername(name))[1] = auth.uid()::text or public.is_admin() )
  );

-- Subir: solo dentro de la carpeta propia. El limite de tamano y la whitelist
-- de MIME los impone el bucket, no la policy.
drop policy if exists "community review insert own" on storage.objects;
create policy "community review insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photocard-community-review'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: retirar un envio propio, o limpieza por moderacion.
drop policy if exists "community review delete own or admin" on storage.objects;
create policy "community review delete own or admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photocard-community-review'
    and ( (storage.foldername(name))[1] = auth.uid()::text or public.is_admin() )
  );

-- UPDATE solo admin: reemplazar el binario de un envio ya revisado permitiria
-- un bait-and-switch (subir algo inocuo, aprobarlo, y cambiar el archivo).
drop policy if exists "community review update admin" on storage.objects;
create policy "community review update admin"
  on storage.objects for update to authenticated
  using      (bucket_id = 'photocard-community-review' and public.is_admin())
  with check (bucket_id = 'photocard-community-review' and public.is_admin());


-- ---------------------------------------------------------------------------
-- 3. Policies de photocard-community (publico, solo aprobadas)
-- ---------------------------------------------------------------------------

-- Lectura publica, igual que photocards.
drop policy if exists "community public read" on storage.objects;
create policy "community public read"
  on storage.objects for select to public
  using (bucket_id = 'photocard-community');

-- NINGUNA policy de INSERT para authenticated ni anon: los objetos entran aqui
-- solo por el movimiento que hace la aprobacion (service_role, salta RLS). Un
-- usuario no puede escribir nunca en el bucket publico.

-- Takedown.
drop policy if exists "community delete admin" on storage.objects;
create policy "community delete admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photocard-community' and public.is_admin());

drop policy if exists "community update admin" on storage.objects;
create policy "community update admin"
  on storage.objects for update to authenticated
  using      (bucket_id = 'photocard-community' and public.is_admin())
  with check (bucket_id = 'photocard-community' and public.is_admin());
