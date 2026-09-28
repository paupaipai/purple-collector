-- SR-4 — Policy de DELETE para admins en el bucket `photocards`.
--
-- `storage.objects` tenia para `photocards` policies de SELECT (publica),
-- INSERT y UPDATE (ambas de admin), pero NINGUNA de DELETE. Consecuencia
-- practica: retirar una imagen --por un reporte de copyright, por contenido
-- incorrecto, por un takedown-- era imposible desde la app o como admin
-- autenticado. Habia que entrar con service_role.
--
-- Eso importa mas ahora: V2 abre reportes sobre imagenes (tabla image_reports,
-- fase posterior), y el procedimiento de copyright que pide la tarea 37 del
-- roadmap necesita que retirar contenido sea una operacion normal del
-- mantenedor, no una intervencion manual con la llave maestra.
--
-- Los buckets community ya nacieron con su DELETE de admin en
-- 20260928150106_create_community_buckets.sql. Esta migration deja `photocards`
-- a la par.
--
-- Se usa public.is_admin() y no la forma inline
-- `exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin)`
-- que usan las policies hermanas de este bucket. Es una inconsistencia
-- deliberada: is_admin() es SECURITY DEFINER, asi que no depende de que la RLS
-- de user_profiles deje leer la fila. La forma inline funciona hoy --se
-- verifico despues de SR-2, que cerro la lectura publica de user_profiles: el
-- EXISTS sigue dando true porque solo necesita la propia fila del admin-- pero
-- depende de eso para seguir funcionando. is_admin() no.
--
-- Unificar las policies hermanas a is_admin() seria parte de SR-7.
--
-- Esto NO borra nada: solo habilita la capacidad. Los 4612 objetos siguen
-- intactos, y los 33 huerfanos tampoco se tocan.
--
-- Reversible con:
--   drop policy if exists "admin delete photocards" on storage.objects;

drop policy if exists "admin delete photocards" on storage.objects;
create policy "admin delete photocards"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photocards' and public.is_admin());
