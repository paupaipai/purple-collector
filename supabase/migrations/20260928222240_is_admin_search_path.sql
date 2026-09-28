-- SR-5 — Fija el search_path de is_admin().
--
-- El advisor marcaba tres funciones con search_path mutable. SR-6 borro dos
-- (set_card_status y get_collection_stats, muertas), asi que aqui queda solo
-- is_admin -- que es justamente la mas sensible de las tres, porque es
-- SECURITY DEFINER y la usan las policies de admin de casi todo el proyecto.
--
-- El riesgo de un SECURITY DEFINER sin search_path fijo: la funcion resuelve
-- los nombres sin cualificar usando el search_path de QUIEN LA LLAMA. Si
-- alguien logra poner un esquema propio delante en su search_path y crear ahi
-- una tabla `user_profiles` con su id marcado como admin, la funcion la leeria
-- en vez de la real y devolveria true. En este proyecto eso requiere permiso
-- de CREATE en algun esquema del search_path, que anon/authenticated no
-- tienen, asi que no era explotable hoy -- pero es exactamente la clase de
-- supuesto que no conviene dejar apoyado en un permiso ajeno.
--
-- El arreglo va mas alla de callar el aviso: `set search_path = ''` obliga a
-- que TODO nombre este cualificado, y por eso el cuerpo pasa de
-- `user_profiles` a `public.user_profiles`. `auth.uid()` ya venia cualificado.
--
-- Se usa CREATE OR REPLACE y no DROP + CREATE: conserva el oid, asi que las
-- policies que dependen de la funcion siguen apuntando a ella sin necesidad de
-- recrearlas. La firma, el tipo de retorno, STABLE y SECURITY DEFINER se
-- mantienen identicos.
--
-- Policies que dependen de is_admin() y que deben seguir funcionando:
--   admin_all_albums, admin_all_album_eras, admin_all_album_versions,
--   admin_all_card_categories, admin_all_cards, admin_all_card_sets,
--   admin_all_collection_types, "card_images admin all",
--   "admin delete photocards", "community delete admin",
--   "community update admin", "community review read own or admin",
--   "community review delete own or admin", "community review update admin"
--
-- Reversible con la definicion anterior:
--   create or replace function public.is_admin() returns boolean
--   language sql stable security definer as $$
--     select exists (select 1 from user_profiles
--                    where id = auth.uid() and is_admin = true);
--   $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_admin = true
  );
$$;
