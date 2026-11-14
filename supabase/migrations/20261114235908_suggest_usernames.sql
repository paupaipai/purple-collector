-- Sugerencias de nombre de usuario cuando el elegido ya esta en uso.
--
-- El indice unico `user_profiles_username_key` ya impide duplicados; lo que
-- faltaba era ofrecer alternativas en vez de solo decir "ocupado".
--
-- POR QUE UNA FUNCION SECURITY DEFINER
-- SR-2 cerro la lectura de user_profiles: cada quien solo ve su propia fila, asi
-- que el cliente no puede comprobar si un nombre esta libre. La funcion solo
-- devuelve nombres DISPONIBLES (nunca filas, ids ni otros datos del perfil), y
-- los nombres de usuario ya son publicos en el catalogo (contributor_handle).
--
-- La lista de reservados se repite aqui a proposito: es la misma que la
-- constraint `user_profiles_username_not_reserved`. Si cambia una, cambiar la
-- otra (si se olvida, lo peor que pasa es sugerir uno que al guardar falla con
-- 'reserved', no que se guarde).

create or replace function public.suggest_usernames(base text, how_many int default 3)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved constant text[] := array[
    'admin', 'administrador', 'soporte', 'support', 'purple',
    'purplecollector', 'purple_collector', 'staff', 'moderador', 'mod'
  ];
  stem text;
  cand text;
  candidates text[];
  result text[] := '{}';
  i int;
begin
  -- Solo para sesiones iniciadas: evita que se use para enumerar nombres sin cuenta.
  if auth.uid() is null then
    return result;
  end if;

  how_many := least(greatest(coalesce(how_many, 3), 1), 5);

  -- Misma limpieza que hace la app: minusculas, sin acentos ni simbolos.
  stem := lower(coalesce(base, ''));
  stem := translate(stem, 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
  stem := regexp_replace(stem, '[^a-z0-9_]', '', 'g');
  stem := trim(both '_' from stem);
  -- 15 deja sitio para un sufijo sin pasar de 20.
  stem := left(stem, 15);
  if length(stem) < 3 then
    stem := stem || 'army';
  end if;

  -- Primero las que se leen bien; despues variantes con numeros al azar, que
  -- casi siempre estan libres.
  candidates := array[
    stem || '_army',
    stem || '_' || (10 + floor(random() * 90))::int,
    'army_' || stem,
    stem || (100 + floor(random() * 900))::int,
    stem || '_pc'
  ];
  for i in 1..15 loop
    candidates := candidates || (stem || '_' || (10 + floor(random() * 9990))::int);
  end loop;

  foreach cand in array candidates loop
    cand := left(cand, 20);
    if cand ~ '^[a-z0-9_]{3,20}$'
       and not (cand = any(reserved))
       and not (cand = any(result))
       and not exists (select 1 from public.user_profiles p where p.username = cand)
    then
      result := result || cand;
      exit when array_length(result, 1) >= how_many;
    end if;
  end loop;

  return result;
end;
$$;

-- Lección de SR-9: el EXECUTE por defecto viene de PUBLIC, hay que quitarlo ahi.
revoke execute on function public.suggest_usernames(text, int) from public;
revoke execute on function public.suggest_usernames(text, int) from anon;
grant execute on function public.suggest_usernames(text, int) to authenticated;
