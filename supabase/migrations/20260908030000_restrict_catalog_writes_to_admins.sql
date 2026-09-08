-- Cierra la escritura publica al catalogo.
--
-- Las tablas del catalogo tenian politicas de INSERT/UPDATE abiertas al rol
-- `public` (que incluye `anon`) sin ninguna condicion. Como la clave
-- publicable viaja en el cliente -- esta en el repo y en el bundle web --
-- cualquiera con ella podia insertar o modificar cards, albums, versiones,
-- eras y categorias.
--
-- Al eliminarlas, la escritura queda cubierta por las politicas `admin_all_*`
-- que YA EXISTEN en cada una de estas tablas (ALL para authenticated con
-- is_admin()), y el service_role del dashboard salta RLS como siempre.
-- La lectura publica no se toca: la app sigue leyendo el catalogo sin sesion.

drop policy if exists "Allow insert cards"           on public.cards;
drop policy if exists "Allow update cards"           on public.cards;

drop policy if exists "Allow insert albums"          on public.albums;
drop policy if exists "Allow update albums"          on public.albums;

drop policy if exists "Allow insert album versions"  on public.album_versions;
drop policy if exists "Allow update albums versions" on public.album_versions;

drop policy if exists "Allow insert card categories" on public.card_categories;
drop policy if exists "Allow update card categories" on public.card_categories;

-- Estaba nombrada "admin can update album_eras" pero su USING era `true`, o
-- sea que no restringia a nadie. El acceso real de admin lo da
-- admin_all_album_eras.
drop policy if exists "admin can update album_eras"  on public.album_eras;
