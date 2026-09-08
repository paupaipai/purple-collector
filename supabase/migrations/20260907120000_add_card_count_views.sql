-- Conteos agregados para que la app no tenga que bajarse las 4500+ filas de
-- `cards` solo para contarlas en el cliente (eran 5 peticiones secuenciales,
-- ~3.1s, repetidas en cada focus de pantalla).
--
-- security_invoker = true: la vista se evalua con los permisos de quien
-- consulta, asi que la RLS de `cards` sigue aplicando. `cards` ya es de
-- lectura publica, de modo que esto no expone nada nuevo -- al contrario,
-- devuelve solo agregados en vez de filas.
--
-- NOTA: ya aplicada en el proyecto remoto; este archivo deja el repo a la par.

create or replace view public.album_card_counts
with (security_invoker = true) as
select album_id, count(*)::int as total
from public.cards
group by album_id;

create or replace view public.member_card_counts
with (security_invoker = true) as
select member, is_group, count(*)::int as total
from public.cards
group by member, is_group;

grant select on public.album_card_counts to anon, authenticated;
grant select on public.member_card_counts to anon, authenticated;
