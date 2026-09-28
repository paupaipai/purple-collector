-- SR-7 — Limpia policies duplicadas y unifica el gate de admin.
--
-- Dos cosas, ambas de aseo, ninguna cambia quien puede hacer que.
--
-- 1. user_profiles tenia SEIS policies para tres operaciones, acumuladas en
--    distintas epocas y con tres convenciones de nombre distintas:
--
--      INSERT  "Own profile insert"        public   check auth.uid() = id
--      INSERT  "Users upsert own profile"  public   check auth.uid() = id   <- igual
--      SELECT  "Users read own profile"    public   using auth.uid() = id
--      SELECT  "users can read own profile" authenticated  using id = auth.uid()  <- igual
--      UPDATE  "Own profile update"        public   using auth.uid() = id
--      UPDATE  "Users update own profile"  public   using auth.uid() = id   <- igual
--
--    Pares exactamente equivalentes. Se reemplazan por tres policies con un
--    nombre consistente, y se pasan de `public` a `authenticated`: para `anon`
--    auth.uid() es null, asi que `null = id` nunca es true y esas policies ya
--    no le daban acceso a nada. El cambio de rol es estrictamente mas
--    restrictivo y de comportamiento identico.
--
--    En el UPDATE se agrega WITH CHECK explicito. Antes era null, que Postgres
--    resuelve usando la expresion de USING, asi que tampoco cambia nada --
--    solo deja de depender de ese comportamiento implicito.
--
--    No hay policy de DELETE y no se agrega: borrar una cuenta lo hace la edge
--    function delete-account con service_role, que salta RLS.
--
--    El trigger handle_new_user sigue insertando sin problema: es SECURITY
--    DEFINER y corre como dueno de la tabla.
--
-- 2. Las policies de admin de `photocards` usaban la forma inline
--    `exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin = true)`
--    mientras el resto del proyecto usa public.is_admin(). Se unifican a
--    is_admin(), que es SECURITY DEFINER y por lo tanto no depende de que la
--    RLS de user_profiles deje leer la fila. La policy de DELETE que agrego
--    SR-4 ya venia asi; esto pone a las otras dos a la par.
--
--    Esto importa mas de lo que parece: la forma inline funciona hoy porque el
--    admin puede leer su propia fila, pero es un acoplamiento silencioso entre
--    las policies de Storage y la RLS de user_profiles. SR-2 ya estuvo a un
--    paso de romperlo.
--
-- Reversible: recrear las seis policies de user_profiles con sus nombres
-- originales, y volver las dos de photocards a la forma inline.

-- ---------------------------------------------------------------------------
-- 1. user_profiles: seis policies -> tres
-- ---------------------------------------------------------------------------

drop policy if exists "Own profile insert"          on public.user_profiles;
drop policy if exists "Users upsert own profile"    on public.user_profiles;
drop policy if exists "Users read own profile"      on public.user_profiles;
drop policy if exists "users can read own profile"  on public.user_profiles;
drop policy if exists "Own profile update"          on public.user_profiles;
drop policy if exists "Users update own profile"    on public.user_profiles;

create policy "user_profiles select own"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "user_profiles insert own"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "user_profiles update own"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. photocards: unificar el gate de admin a is_admin()
-- ---------------------------------------------------------------------------

drop policy if exists "admin upload photocards" on storage.objects;
create policy "admin upload photocards"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photocards' and public.is_admin());

drop policy if exists "admin update photocards" on storage.objects;
create policy "admin update photocards"
  on storage.objects for update
  to authenticated
  using      (bucket_id = 'photocards' and public.is_admin())
  with check (bucket_id = 'photocards' and public.is_admin());
