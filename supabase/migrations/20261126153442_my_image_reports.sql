-- "Mis reportes": quien reporta una imagen puede ver en que quedo, y quien
-- la aporto ve que esta reportada.
--
-- image_reports ya deja leer lo propio ("image_reports reporter reads own"),
-- pero eso no alcanza para mostrar DE QUE CARD era: si la imagen se retira, la
-- fila de card_images pasa a 'rejected' y la policy "public read approved" deja
-- de devolverla. Justo el caso que mas interesa a quien reporto.
--
-- Por eso una funcion SECURITY DEFINER que devuelve solo lo minimo para pintar
-- la lista, filtrada SIEMPRE por auth.uid():
--   - NO devuelve resolution_note: es la nota interna de quien modero.
--   - NO devuelve quien aporto la imagen ni quien la reviso.

create or replace function public.my_image_reports()
returns table (
  id bigint,
  status text,
  reason text,
  created_at timestamptz,
  resolved_at timestamptz,
  card_id integer,
  card_name text,
  member text,
  album_id integer,
  album_name text,
  side text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.status::text, r.reason::text, r.created_at, r.resolved_at,
         c.id, c.card_name, c.member, a.id, a.name, ci.side
  from public.image_reports r
  left join public.card_images ci on ci.id = r.card_image_id
  left join public.cards c on c.id = ci.card_id
  left join public.albums a on a.id = c.album_id
  where r.reported_by = auth.uid()
  order by r.created_at desc;
$$;

revoke execute on function public.my_image_reports() from public;
revoke execute on function public.my_image_reports() from anon;
grant execute on function public.my_image_reports() to authenticated;

-- ---------------------------------------------------------------------------
-- El otro lado: quien APORTO una imagen ve que esta reportada.
-- ---------------------------------------------------------------------------
-- Hoy solo se enteraba si se retiraba (le aparecia rechazada). Mientras el
-- reporte esta abierto no veia nada, y la RLS de image_reports no le deja leer
-- reportes ajenos. Esta funcion devuelve SOLO los ids de sus propias imagenes
-- con un reporte abierto: ni quien reporto, ni el motivo, ni el detalle.

create or replace function public.my_reported_images()
returns table (card_image_id bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct r.card_image_id
  from public.image_reports r
  join public.card_images ci on ci.id = r.card_image_id
  where ci.contributed_by = auth.uid()
    and r.status = 'open';
$$;

revoke execute on function public.my_reported_images() from public;
revoke execute on function public.my_reported_images() from anon;
grant execute on function public.my_reported_images() to authenticated;
