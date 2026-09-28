-- PILOTO ARIRANG — registro de 6 imagenes legacy en `card_images`.
--
-- EJECUTADO el 2026-09-28 tras aprobacion explicita.
--
-- Vive FUERA de supabase/migrations/ a proposito: no es un cambio de schema y
-- no debe correr como parte de `supabase db push`.
--
-- Objetivo: validar la arquitectura de card_images con 6 cards reales antes de
-- migrar las 4503. Registra las imagenes que YA existen como
-- source_type='legacy', status='approved', is_primary=true.
--
-- Garantias:
--   * NO modifica cards.image_path
--   * NO modifica cards ni user_cards en absoluto
--   * NO toca Storage
--   * idempotente: correrlo N veces deja exactamente 6 filas
--   * NO asume ids: resuelve las cards por `code` (estable y legible) y
--     ABORTA si alguna no existe o no tiene imagen
--   * atomico: un unico bloque DO. Cualquier guarda o verificacion que falle
--     aborta la transaccion completa y no deja nada escrito.
--
-- Las 6 cards estan documentadas en docs/PURPLE_COLLECTOR_V2_MIGRATION.md §5.
-- Ids observados el 2026-09-27 y revalidados el 2026-09-28 — informativos, no
-- usados por el script: 796, 1437, 1444, 1445, 1557, 1565.

do $$
declare
  -- Los 6 codes del piloto:
  --   1437 solo con version_id · 1444 y 1445 is_group (paths vecinos)
  --   796 rarity Rare sin version · 1565 country JAPAN · 1557 otro miembro/set
  v_codes text[] := array[
    'ARIRANG-WV-RM-GROUP',
    'ARIRANG-WV-GROUP-GROUP',
    'ARIRANG-WV-GROUP-GROUP-2',
    'ARIRANG-RM-MUSIC-KOREA-LUCKY-DRAW',
    'ARIRANG-RM-WEVERSE-JAPAN-POBS',
    'ARIRANG-JUNGKOOK-WEVERSE-GLOBAL-POBS-SELFIE-A'
  ];
  v_expected int := array_length(v_codes, 1);
  v_found    int;
  v_missing  text;
  v_rows     int;
  v_inserted int;
begin
  -- -------------------------------------------------------------------------
  -- Guardas: abortar antes de escribir si los datos no son los esperados
  -- -------------------------------------------------------------------------

  -- G1. Las 6 cards existen, y solo una por code.
  select count(*) into v_found
  from public.cards c
  where c.code = any(v_codes);

  if v_found <> v_expected then
    select string_agg(x.code, ', ') into v_missing
    from unnest(v_codes) as x(code)
    where not exists (select 1 from public.cards c where c.code = x.code);

    raise exception
      'PILOTO ABORTADO: se esperaban % cards y se encontraron %. Sin resolver: %',
      v_expected, v_found, coalesce(v_missing, '(codes duplicados en cards)');
  end if;

  -- G2. Todas pertenecen al album ARIRANG.
  if exists (
    select 1
    from public.cards c
    join public.albums a on a.id = c.album_id
    where c.code = any(v_codes) and a.name <> 'ARIRANG'
  ) then
    raise exception 'PILOTO ABORTADO: alguna card del piloto no pertenece al album ARIRANG';
  end if;

  -- G3. Todas tienen imagen. Sin image_path no hay nada que registrar.
  if exists (
    select 1 from public.cards c
    where c.code = any(v_codes) and c.image_path is null
  ) then
    raise exception 'PILOTO ABORTADO: alguna card del piloto no tiene image_path';
  end if;

  -- G4. El objeto existe realmente en el bucket `photocards`.
  if exists (
    select 1 from public.cards c
    where c.code = any(v_codes)
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'photocards' and o.name = c.image_path
      )
  ) then
    raise exception 'PILOTO ABORTADO: alguna image_path del piloto no tiene objeto en photocards';
  end if;

  -- -------------------------------------------------------------------------
  -- Registro (idempotente)
  -- -------------------------------------------------------------------------

  insert into public.card_images
    (card_id, bucket_id, storage_path, source_type, status, is_primary)
  select c.id, 'photocards', c.image_path, 'legacy', 'approved', true
  from public.cards c
  where c.code = any(v_codes)
  on conflict (bucket_id, storage_path) do nothing;

  get diagnostics v_inserted = row_count;

  -- -------------------------------------------------------------------------
  -- Verificacion en la misma transaccion
  -- -------------------------------------------------------------------------

  -- V1. Exactamente 6 filas legacy/approved/primary para las cards del piloto.
  select count(*) into v_rows
  from public.card_images ci
  join public.cards c on c.id = ci.card_id
  where c.code = any(v_codes)
    and ci.source_type = 'legacy'
    and ci.status = 'approved'
    and ci.is_primary;

  if v_rows <> v_expected then
    raise exception 'VERIFICACION FALLIDA: se esperaban % filas de piloto, hay %',
      v_expected, v_rows;
  end if;

  -- V2. El storage_path registrado coincide EXACTAMENTE con cards.image_path:
  -- ninguna ruta fue transformada.
  if exists (
    select 1
    from public.card_images ci
    join public.cards c on c.id = ci.card_id
    where c.code = any(v_codes) and ci.storage_path <> c.image_path
  ) then
    raise exception 'VERIFICACION FALLIDA: algun storage_path no coincide con cards.image_path';
  end if;

  -- V3. cards.image_path sigue poblada en las 6 (no se vacio nada).
  select count(*) into v_rows
  from public.cards c
  where c.code = any(v_codes) and c.image_path is not null;

  if v_rows <> v_expected then
    raise exception 'VERIFICACION FALLIDA: cards.image_path fue alterada (% de % pobladas)',
      v_rows, v_expected;
  end if;

  -- V4. El piloto no toco nada mas del catalogo.
  select count(*) into v_rows from public.card_images;
  if v_rows <> v_expected then
    raise exception 'VERIFICACION FALLIDA: card_images tiene % filas, se esperaban solo las % del piloto',
      v_rows, v_expected;
  end if;

  raise notice 'PILOTO OK: % filas insertadas en esta corrida, % filas de piloto en total, cards.image_path intacta.',
    v_inserted, v_expected;
end $$;


-- ---------------------------------------------------------------------------
-- Consultas de inspeccion (solo lectura, correr aparte)
-- ---------------------------------------------------------------------------
--
-- select ci.id, c.code, ci.source_type, ci.status, ci.is_primary,
--        ci.bucket_id, (ci.storage_path = c.image_path) as path_coincide
-- from card_images ci join cards c on c.id = ci.card_id order by c.id;
--
-- select count(*) from card_images;                        -- esperado: 6
-- select count(*) from cards where image_path is not null;  -- esperado: 4503
--
-- Rollback del piloto:
-- delete from card_images
-- where source_type = 'legacy' and card_id in (
--   select id from cards where code = any(array[
--     'ARIRANG-WV-RM-GROUP','ARIRANG-WV-GROUP-GROUP','ARIRANG-WV-GROUP-GROUP-2',
--     'ARIRANG-RM-MUSIC-KOREA-LUCKY-DRAW','ARIRANG-RM-WEVERSE-JAPAN-POBS',
--     'ARIRANG-JUNGKOOK-WEVERSE-GLOBAL-POBS-SELFIE-A']));
