-- Avatar propio de cada usuaria.
--
-- La imagen vive en Storage (bucket `avatars`), NO en la base: en
-- user_profiles.avatar_url solo se guarda la RUTA dentro del bucket
-- (`<uid>/avatar-<n>.jpg`). La app la reduce a 256x256 JPEG antes de subir
-- (~20 kB); el bucket rechaza cualquier archivo de mas de 150 kB por si un
-- cliente modificado intenta saltarse eso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 153600, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada una escribe solo en su carpeta (primer segmento = su uid). La lectura
-- es publica por ser bucket publico; no hace falta policy de SELECT para ver
-- la imagen por su URL.
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- avatar_url ya se podia escribir desde el cliente (grant de columna). Sin
-- esta regla, alguien podria poner ahi la URL de cualquier imagen externa; asi
-- solo puede apuntar a un archivo de SU carpeta en el bucket.
alter table public.user_profiles
  add constraint user_profiles_avatar_is_own_path
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/avatar-[0-9]+\.(jpg|webp)$'));

comment on column public.user_profiles.avatar_url is
  'Ruta del avatar en el bucket avatars (<uid>/avatar-<n>.jpg), o null.';
