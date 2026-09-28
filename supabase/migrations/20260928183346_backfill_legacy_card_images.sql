-- FASE B.3 — Backfill de las imagenes legacy a `card_images`.
--
-- APLICADA el 2026-09-28. Registra cada cards.image_path como una fila
-- legacy/approved/primary. 4497 filas insertadas (las otras 6 ya venian del
-- piloto ARIRANG), 4503 en total.
--
-- NO modifica cards.image_path: la Android v1 publicada la sigue leyendo y
-- seguira siendo su unica fuente de imagen. NO toca user_cards, ni ids, ni
-- cards_full, ni Storage.
--
-- Idempotente: on conflict (bucket_id, storage_path) do nothing.
--
-- Atomico: un unico bloque DO. Cualquier guarda o verificacion que falle
-- aborta la transaccion completa sin dejar nada escrito.
--
-- Reversible con:
--   delete from public.card_images where source_type = 'legacy';

do $$
declare
  v_esperado   int;
  v_antes      int;
  v_insertadas int;
  v_total      int;
  v_rows       int;
  v_uc_antes   int;
begin
  select count(*) into v_esperado from public.cards where image_path is not null;
  select count(*) into v_antes    from public.card_images;
  select count(*) into v_uc_antes from public.user_cards;

  -- -------------------------------------------------------------------------
  -- Guardas
  -- -------------------------------------------------------------------------

  -- G1. Ninguna image_path sin objeto real en el bucket. Registrar una ruta
  -- que no existe crearia una imagen "aprobada" que no se puede servir.
  select count(*) into v_rows
  from public.cards c
  where c.image_path is not null
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'photocards' and o.name = c.image_path
    );
  if v_rows > 0 then
    raise exception 'BACKFILL ABORTADO: % image_path sin objeto en el bucket photocards', v_rows;
  end if;

  -- G2. Ninguna image_path compartida por mas de una card. Si existiera, el
  -- unique (bucket_id, storage_path) haria que una card se quedara sin fila.
  select count(*) into v_rows
  from (select image_path from public.cards
        where image_path is not null group by image_path having count(*) > 1) d;
  if v_rows > 0 then
    raise exception 'BACKFILL ABORTADO: % image_path compartidas por varias cards', v_rows;
  end if;

  -- G3. Lo ya registrado como legacy es coherente con su card.
  select count(*) into v_rows
  from public.card_images ci
  join public.cards c on c.id = ci.card_id
  where ci.source_type = 'legacy' and ci.storage_path <> c.image_path;
  if v_rows > 0 then
    raise exception 'BACKFILL ABORTADO: % filas legacy previas con storage_path incoherente', v_rows;
  end if;

  -- -------------------------------------------------------------------------
  -- Backfill
  -- -------------------------------------------------------------------------

  insert into public.card_images
    (card_id, bucket_id, storage_path, source_type, status, is_primary)
  select c.id, 'photocards', c.image_path, 'legacy', 'approved', true
  from public.cards c
  where c.image_path is not null
  on conflict (bucket_id, storage_path) do nothing;

  get diagnostics v_insertadas = row_count;

  -- -------------------------------------------------------------------------
  -- Verificacion
  -- -------------------------------------------------------------------------

  -- V1. Total = una fila por card con imagen.
  select count(*) into v_total from public.card_images;
  if v_total <> v_esperado then
    raise exception 'VERIFICACION FALLIDA: card_images tiene % filas, se esperaban %',
      v_total, v_esperado;
  end if;

  -- V2. Ninguna card con imagen quedo sin su fila primaria.
  select count(*) into v_rows
  from public.cards c
  where c.image_path is not null
    and not exists (
      select 1 from public.card_images ci
      where ci.card_id = c.id and ci.source_type = 'legacy'
        and ci.status = 'approved' and ci.is_primary
    );
  if v_rows > 0 then
    raise exception 'VERIFICACION FALLIDA: % cards con imagen sin fila legacy primaria', v_rows;
  end if;

  -- V3. Ninguna ruta fue transformada.
  select count(*) into v_rows
  from public.card_images ci
  join public.cards c on c.id = ci.card_id
  where ci.storage_path <> c.image_path;
  if v_rows > 0 then
    raise exception 'VERIFICACION FALLIDA: % storage_path no coinciden con cards.image_path', v_rows;
  end if;

  -- V4. Todas son legacy/approved/primary y sin autor.
  select count(*) into v_rows
  from public.card_images
  where source_type <> 'legacy' or status <> 'approved'
     or not is_primary or contributed_by is not null;
  if v_rows > 0 then
    raise exception 'VERIFICACION FALLIDA: % filas no son legacy/approved/primary sin autor', v_rows;
  end if;

  -- V5. cards.image_path intacta.
  select count(*) into v_rows from public.cards where image_path is not null;
  if v_rows <> v_esperado then
    raise exception 'VERIFICACION FALLIDA: cards.image_path cambio (% vs %)', v_rows, v_esperado;
  end if;

  -- V6. user_cards intacta.
  select count(*) into v_rows from public.user_cards;
  if v_rows <> v_uc_antes then
    raise exception 'VERIFICACION FALLIDA: user_cards cambio (% vs %)', v_rows, v_uc_antes;
  end if;

  raise notice 'BACKFILL OK: % filas antes, % insertadas, % en total',
    v_antes, v_insertadas, v_total;
end $$;
