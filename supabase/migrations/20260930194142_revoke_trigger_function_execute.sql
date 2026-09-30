-- Los tres trigger functions seguian con EXECUTE para anon y authenticated.
--
-- LA LECCION DE SR-9, CORREGIDA
--
-- SR-9 concluyo "hay que quitarle EXECUTE a public, no a anon", porque el
-- privilegio venia del grant implicito a PUBLIC (`=X/postgres` en la ACL). Eso
-- era cierto PARA ESAS FUNCIONES, pero como regla general esta incompleta: en
-- una funcion creada DESPUES, Supabase tiene `alter default privileges` que
-- concede EXECUTE a anon, authenticated y service_role de forma EXPLICITA. La
-- ACL real de las tres era:
--
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- `revoke ... from public` no toca nada de eso: no hay entrada de PUBLIC que
-- quitar. Hay que revocar de cada grantee. Las migrations de contributor_handle
-- y create_card_submissions revocaban solo de public, asi que las tres funciones
-- se quedaron con el EXECUTE que esas migrations creian haber cerrado, y el
-- advisor las reporta (0028 y 0029).
--
-- POR QUE ES WARN Y NO ERROR
--
-- Las tres devuelven `trigger`, y PostgREST no publica funciones que devuelvan
-- ese tipo: /rest/v1/rpc/<nombre> da 404. Asi que no habia una via real de
-- llamarlas desde la API. Se cierra igual porque la intencion de esas
-- migrations era cerrarlo, porque el advisor lo cuenta como hallazgo, y porque
-- depender de un detalle de PostgREST para que un SECURITY DEFINER no sea
-- llamable es apoyarse en la pieza equivocada.

revoke execute on function public.card_images_fill_handle() from anon, authenticated;
revoke execute on function public.user_profiles_sync_handle() from anon, authenticated;
revoke execute on function public.card_submissions_derive_taxonomy() from anon, authenticated;
