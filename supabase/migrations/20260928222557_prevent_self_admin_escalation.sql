-- SR-8 — Impide que un usuario se haga admin a si mismo.
--
-- HALLAZGO NUEVO, encontrado al verificar SR-7. Severidad alta y ya estaba
-- vivo en produccion: NO lo introdujo SR-7, las policies originales tenian
-- exactamente el mismo predicado.
--
-- El problema: la RLS de Postgres filtra FILAS, no COLUMNAS. La policy de
-- UPDATE de user_profiles autoriza a cada usuario a modificar su propia fila...
-- entera. Incluida la columna is_admin.
--
-- Explotacion, con solo la clave publicable que viaja en el bundle de la app:
--
--   PATCH /rest/v1/user_profiles?id=eq.<mi_uuid>
--   { "is_admin": true }
--
-- Verificado en la base antes de arreglarlo, con un usuario normal real:
--
--   is_admin antes                            f
--   update is_admin = true sobre su fila      1 fila
--   public.is_admin() despues                 t
--   update sobre public.cards                 1 fila
--
-- O sea: cualquiera con una cuenta pasaba a poder escribir las 4503 cards, los
-- albums, las eras, las categorias, moderar card_images y -- desde SR-4 --
-- borrar objetos del bucket photocards.
--
-- El arreglo: privilegios a nivel de COLUMNA, que es la herramienta correcta
-- cuando el problema es "esta fila si, esta columna no". Se revoca el UPDATE
-- amplio y se vuelve a otorgar solo sobre las columnas que el usuario tiene
-- por que cambiar. is_admin y created_at quedan fuera.
--
-- `id` SI se incluye, porque el upsert de lib/BiasContext.tsx lo trae en el
-- INSERT y PostgREST lo puede incluir en el DO UPDATE. Es inofensivo: el WITH
-- CHECK de la policy (auth.uid() = id) rechaza cualquier intento de apuntar la
-- fila a otra persona.
--
-- A `anon` se le revoca el UPDATE sin devolverselo: nunca tiene por que
-- escribir un perfil, y desde SR-7 tampoco hay policy que se lo permita.
--
-- Cambiar is_admin queda como operacion de service_role: el dashboard de
-- Supabase, que es como se otorgo el unico admin que existe.
--
-- Reversible con:
--   grant update on public.user_profiles to authenticated, anon;

revoke update on public.user_profiles from authenticated;
revoke update on public.user_profiles from anon;

grant update (
  id,
  display_name,
  avatar_url,
  bias,
  bias_wrecker,
  biases,
  collecting_since,
  onboarding_completed
) on public.user_profiles to authenticated;
