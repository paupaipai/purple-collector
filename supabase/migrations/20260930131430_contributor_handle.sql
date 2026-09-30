-- Attribution: handle público del contributor (tarea 32 del roadmap).
--
-- Para mostrar "Aportada por @usuaria" hace falta un identificador público. Se
-- descartó `display_name`: lo puebla el trigger handle_new_user desde el
-- proveedor OAuth, así que suele ser el NOMBRE REAL de la persona. Publicarlo en
-- el catálogo es un problema de privacidad, no sólo de duplicados (es nullable y
-- no único).
--
-- POR QUÉ SE DESNORMALIZA EL HANDLE EN card_images
--
-- SR-2 cerró la lectura de user_profiles: cada quien sólo ve su propia fila. Y
-- la RLS de Postgres filtra FILAS, no COLUMNAS, así que no hay forma de decir
-- "de mi fila todo, de las demás sólo el handle" con una sola tabla:
--
--   * una policy permisiva `using (username is not null)` dejaría ver la fila
--     ENTERA de quien tenga handle, incluidos display_name y is_admin;
--   * los grants por columna no ayudan, porque el grant de tabla que ya tiene
--     `authenticated` los hace redundantes;
--   * una vista SECURITY DEFINER funcionaría, pero reabre exactamente el ERROR
--     del advisor que cerró SR-1, y mete un join de user_profiles en el camino
--     caliente de cards_full (4503 filas).
--
-- Así que el handle se copia a card_images cuando se crea la aportación, y un
-- trigger lo mantiene al día si la persona lo cambia. La vista lo lee sin tocar
-- user_profiles, sin definer y sin join extra.

-- ---------------------------------------------------------------------------
-- 1. El handle
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists username text;

-- Minúsculas, sin espacios ni acentos: un handle tiene que ser escribible y
-- comparable sin ambigüedad. El rango 3-20 evita handles de una letra y los
-- kilométricos que no caben en la pastilla de la grilla.
alter table public.user_profiles
  drop constraint if exists user_profiles_username_format;
alter table public.user_profiles
  add constraint user_profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- Nadie puede hacerse pasar por la app ni por soporte.
alter table public.user_profiles
  drop constraint if exists user_profiles_username_not_reserved;
alter table public.user_profiles
  add constraint user_profiles_username_not_reserved
  check (username is null or username not in (
    'admin', 'administrador', 'soporte', 'support', 'purple',
    'purplecollector', 'purple_collector', 'staff', 'moderador', 'mod'
  ));

-- Único. Como la constraint de formato ya obliga a minúsculas, un índice simple
-- basta: no hacen falta variantes por mayúsculas.
create unique index if not exists user_profiles_username_key
  on public.user_profiles (username)
  where username is not null;

-- SR-8 dejó el UPDATE limitado por columna. El handle es del usuario, así que se
-- suma a la lista; `is_admin` y `created_at` siguen fuera.
grant update (username) on public.user_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La copia en card_images
-- ---------------------------------------------------------------------------

alter table public.card_images
  add column if not exists contributor_handle text;

comment on column public.card_images.contributor_handle is
  'Copia del user_profiles.username de contributed_by. Se rellena y se mantiene '
  'por trigger: la RLS impide que la vista lea el perfil de otra persona.';

-- Lo rellena el trigger, NO el cliente: así nadie puede atribuirse un handle que
-- no es suyo, ni siquiera con un cliente modificado.
create or replace function public.card_images_fill_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contributed_by is null then
    new.contributor_handle := null;
  else
    select p.username into new.contributor_handle
    from public.user_profiles p
    where p.id = new.contributed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists card_images_fill_handle_trg on public.card_images;
create trigger card_images_fill_handle_trg
  before insert or update of contributed_by on public.card_images
  for each row execute function public.card_images_fill_handle();

-- Si alguien cambia su handle, las aportaciones que ya hizo pasan a mostrar el
-- nuevo. Mostrar el viejo seria congelar la atribucion en el momento del aporte,
-- que es justo lo que la gente no espera de un handle.
create or replace function public.user_profiles_sync_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    update public.card_images
    set contributor_handle = new.username
    where contributed_by = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_sync_handle_trg on public.user_profiles;
create trigger user_profiles_sync_handle_trg
  after update of username on public.user_profiles
  for each row execute function public.user_profiles_sync_handle();

-- Las funciones son SECURITY DEFINER porque tienen que leer y escribir filas que
-- la RLS del llamante no alcanza. No se exponen por PostgREST: devuelven
-- `trigger`, tipo que no publica, y ademas se les revoca EXECUTE (leccion de
-- SR-9: hay que quitarselo a PUBLIC, no a anon).
revoke execute on function public.card_images_fill_handle() from public;
revoke execute on function public.user_profiles_sync_handle() from public;

-- ---------------------------------------------------------------------------
-- 3. Backfill de lo que ya existe
-- ---------------------------------------------------------------------------

update public.card_images ci
set contributor_handle = p.username
from public.user_profiles p
where p.id = ci.contributed_by
  and ci.contributed_by is not null
  and ci.contributor_handle is distinct from p.username;
