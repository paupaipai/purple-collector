-- SR-8 bis — El INSERT tambien podia hacer admin a quien no tuviera perfil.
--
-- SR-8 (20260928222557) cerro el UPDATE de is_admin con privilegios de
-- columna, pero el INSERT siguio con el grant amplio de tabla. La policy
-- "user_profiles insert own" solo exige auth.uid() = id, asi que una cuenta SIN
-- fila de perfil podia crearse una con is_admin = true:
--
--   POST /rest/v1/user_profiles  { "id": "<mi_uuid>", "is_admin": true }
--
-- Normalmente no es explotable porque el trigger de alta (handle_new_user) ya
-- crea la fila y el INSERT choca con la PK. Pero hay cuentas sin perfil (se
-- encontro una el 2026-11-26), y desde ahora la app CREA el perfil cuando
-- falta (lib/username.ts), asi que el camino del INSERT pasa a ser normal.
--
-- Mismo arreglo que SR-8: se revoca el INSERT de tabla y se otorga solo sobre
-- las columnas que el cliente usa. is_admin y created_at quedan fuera.
--   - lib/BiasContext.tsx: upsert de id, biases, onboarding_completed.
--   - lib/username.ts:     insert de id, username.
--
-- Reversible con:
--   grant insert on public.user_profiles to authenticated, anon;

revoke insert on public.user_profiles from authenticated;
revoke insert on public.user_profiles from anon;

grant insert (
  id,
  display_name,
  avatar_url,
  bias,
  bias_wrecker,
  biases,
  collecting_since,
  onboarding_completed,
  username
) on public.user_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- La firma de los aportes tambien al CREAR el perfil
-- ---------------------------------------------------------------------------
-- user_profiles_sync_handle_trg solo corria en UPDATE OF username. Si el perfil
-- se crea ya con nombre (cuenta que no lo tenia), sus aportes anteriores se
-- quedaban con el @ viejo. Ahora tambien corre en INSERT.

create or replace function public.user_profiles_sync_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- En INSERT solo si trae nombre: un perfil creado sin nombre (p. ej. por el
  -- upsert de bias) no debe borrar la firma que ya tenian sus aportes.
  if (tg_op = 'INSERT' and new.username is not null)
     or (tg_op = 'UPDATE' and new.username is distinct from old.username) then
    update public.card_images
    set contributor_handle = new.username
    where contributed_by = new.id
      and contributor_handle is distinct from new.username;

    update public.card_submissions
    set contributor_handle = new.username
    where submitted_by = new.id
      and contributor_handle is distinct from new.username;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_sync_handle_trg on public.user_profiles;
create trigger user_profiles_sync_handle_trg
  after insert or update of username on public.user_profiles
  for each row execute function public.user_profiles_sync_handle();

revoke execute on function public.user_profiles_sync_handle() from public;
