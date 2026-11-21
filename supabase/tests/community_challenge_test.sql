-- Pruebas del Community Challenge.
--
-- Se ejecutan DESPUES de la migracion, dentro de una transaccion que siempre se
-- deshace: el bloque termina con RAISE EXCEPTION (con el resumen si todo paso),
-- asi que no queda nada escrito. Seguro de correr contra produccion.
--
-- Necesita 4 usuarios reales (1 admin) y 9 cards visibles sin imagenes de la
-- comunidad: ajustar los ids de abajo si cambian.

create function pg_temp.img(p_card int, p_user uuid, p_side text, p_status text, p_created timestamptz)
returns bigint language plpgsql as $$
declare v bigint;
begin
  insert into public.card_images
    (card_id, bucket_id, storage_path, source_type, status, is_primary, contributed_by,
     reviewed_by, reviewed_at, rejection_reason, terms_accepted_at, terms_version, created_at, side)
  values
    (p_card,
     case when p_status = 'approved' then 'photocard-community' else 'photocard-community-review' end,
     'test/' || gen_random_uuid() || '.jpg', 'community', p_status::public.image_status, false, p_user,
     case when p_status = 'pending' then null else '71c842ca-dcaa-4faf-9ed4-3f8e0a1a89fd'::uuid end,
     case when p_status = 'pending' then null else p_created + interval '1 minute' end,
     case when p_status = 'rejected' then 'test' end,
     p_created, 'test', p_created, p_side)
  returning id into v;
  return v;
end $$;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

do $$
declare
  adm uuid := '71c842ca-dcaa-4faf-9ed4-3f8e0a1a89fd';
  a   uuid := '0d4e9158-a569-476c-b07f-d8177df10ef8';
  b   uuid := '18b64b6e-b795-4d6f-8a15-ec20124a4aa3';
  c   uuid := '700d931d-d1c8-4c75-b978-16d152feba92';
  t   timestamptz := now() - interval '10 days';
  ch  bigint;
  vid bigint;
  img_c6_front bigint;
  img_c5_front bigint;
  r   record;
  ok  text[] := '{}';
  failed boolean := false;
  n int;

  procedure_check text;
begin
  -- No-admin no puede crear
  perform pg_temp.as_user(a);
  begin
    perform public.challenge_admin_create('t', 't');
    raise exception 'FAIL: no-admin pudo crear';
  exception when insufficient_privilege then ok := ok || 'no-admin bloqueado'::text;
  end;

  perform pg_temp.as_user(adm);
  ch := public.challenge_admin_create('test-challenge', 'Test');
  n := public.challenge_admin_activate(ch, t);
  if n < 4000 then raise exception 'FAIL: elegibles %', n; end if;
  ok := ok || ('elegibles=' || n);

  -- Aislar la prueba de los aportes reales: solo quedan elegibles k1..k8.
  -- k9 (789) queda fuera: simula una card agregada despues de activar.
  delete from public.challenge_eligible_cards where challenge_id = ch and card_id not between 781 and 788;

  -- k1: A completo; B duplicado despues
  perform pg_temp.img(781, a, 'front', 'approved', t + interval '1 hour');
  perform pg_temp.img(781, a, 'back',  'approved', t + interval '2 hour');
  perform pg_temp.img(781, b, 'front', 'approved', t + interval '3 hour');
  perform pg_temp.img(781, b, 'back',  'approved', t + interval '3 hour');
  -- k2: A solo frente
  perform pg_temp.img(782, a, 'front', 'approved', t + interval '1 hour');
  -- k3: frente A, reverso B
  perform pg_temp.img(783, a, 'front', 'approved', t + interval '1 hour');
  perform pg_temp.img(783, b, 'back',  'approved', t + interval '1 hour');
  -- k4: B completo y reenvio
  perform pg_temp.img(784, b, 'front', 'approved', t + interval '4 hour');
  perform pg_temp.img(784, b, 'back',  'approved', t + interval '4 hour');
  perform pg_temp.img(784, b, 'front', 'approved', t + interval '5 hour');
  perform pg_temp.img(784, b, 'back',  'approved', t + interval '5 hour');
  -- k5: C con frente pendiente; ademas un frente rechazado
  img_c5_front := pg_temp.img(785, c, 'front', 'pending',  t + interval '6 hour');
  perform pg_temp.img(785, c, 'back',  'approved', t + interval '6 hour');
  perform pg_temp.img(785, c, 'front', 'rejected', t + interval '5 hour');
  -- k6: C completo primero, A despues
  img_c6_front := pg_temp.img(786, c, 'front', 'approved', t + interval '7 hour');
  perform pg_temp.img(786, c, 'back',  'approved', t + interval '7 hour');
  perform pg_temp.img(786, a, 'front', 'approved', t + interval '20 hour');
  perform pg_temp.img(786, a, 'back',  'approved', t + interval '20 hour');
  -- k7: A completo ANTES del inicio
  perform pg_temp.img(787, a, 'front', 'approved', t - interval '2 hour');
  perform pg_temp.img(787, a, 'back',  'approved', t - interval '2 hour');
  -- k8: B completo
  perform pg_temp.img(788, b, 'front', 'approved', t + interval '15 hour');
  perform pg_temp.img(788, b, 'back',  'approved', t + interval '15 hour');
  -- k9: A completo en card no elegible
  perform pg_temp.img(789, a, 'front', 'approved', t + interval '1 hour');
  perform pg_temp.img(789, a, 'back',  'approved', t + interval '1 hour');

  -- Antes del retiro: k6 es de C
  if (select user_id from public.challenge_card_winners(ch) where card_id = 786) <> c then
    raise exception 'FAIL: k6 deberia ser de C antes del retiro';
  end if;
  ok := ok || 'primer aporte gana'::text;

  -- Retiro del frente de C en k6 -> el punto pasa a A
  update public.card_images
  set status = 'rejected', rejection_reason = 'takedown', is_primary = false,
      taken_down_at = now(), reviewed_by = adm, reviewed_at = now()
  where id = img_c6_front;
  if (select user_id from public.challenge_card_winners(ch) where card_id = 786) <> a then
    raise exception 'FAIL: tras retiro k6 deberia pasar a A';
  end if;
  ok := ok || 'retiro reasigna'::text;

  -- Anular k8 de B y restaurar
  vid := public.challenge_admin_void_point(ch, 788, b, 'prueba');
  if exists (select 1 from public.challenge_card_winners(ch) where card_id = 788) then
    raise exception 'FAIL: anulacion no desconto';
  end if;
  begin
    perform public.challenge_admin_void_point(ch, 788, b, 'otra vez');
    raise exception 'FAIL: doble anulacion permitida';
  exception when unique_violation then null;
  end;
  perform public.challenge_admin_restore_point(vid, 'era valida');
  if not exists (select 1 from public.challenge_card_winners(ch) where card_id = 788 and user_id = b) then
    raise exception 'FAIL: restaurar no devolvio el punto';
  end if;
  ok := ok || 'anular/restaurar'::text;

  -- Puntos esperados: A = k1 + k6 = 2 ; B = k4 + k8 = 2 ; C = 0
  for r in select * from public.challenge_standings(ch) loop
    if r.user_id = a and (r.points <> 2 or r.rank <> 2 or not r.tied) then
      raise exception 'FAIL: A % pos % tied %', r.points, r.rank, r.tied; end if;
    if r.user_id = b and (r.points <> 2 or r.rank <> 1 or not r.tied) then
      raise exception 'FAIL: B % pos % tied %', r.points, r.rank, r.tied; end if;
    if r.user_id = c then raise exception 'FAIL: C no deberia puntuar'; end if;
  end loop;
  select count(*) into n from public.challenge_standings(ch);
  if n <> 2 then raise exception 'FAIL: standings % filas', n; end if;
  ok := ok || 'duplicado/solo-frente/mixto/reenvio/fuera-plazo/no-elegible = 0'::text
           || 'empate por fecha de envio'::text;

  -- Mis estadisticas de C: 1 pendiente (k5), 1 incompleta (k6 sin frente)
  perform pg_temp.as_user(c);
  select * into r from public.challenge_my_stats(ch);
  if r.points <> 0 or r.rank is not null or r.pending_cards <> 1 or r.incomplete_cards <> 1 then
    raise exception 'FAIL: my_stats C %', r;
  end if;
  perform pg_temp.as_user(b);
  select * into r from public.challenge_my_stats(ch);
  if r.points <> 2 or r.rank <> 1 then raise exception 'FAIL: my_stats B %', r; end if;
  select count(*) into n from public.challenge_leaderboard(ch, 1, 0);
  if n <> 1 then raise exception 'FAIL: paginacion'; end if;
  if not (select is_me from public.challenge_leaderboard(ch, 10, 0) where rank = 1) then
    raise exception 'FAIL: is_me';
  end if;
  ok := ok || 'mis estadisticas + ranking paginado'::text;

  -- Cierre y finalizacion
  perform pg_temp.as_user(adm);
  begin
    perform public.challenge_admin_finalize(ch);
    raise exception 'FAIL: finalizo estando active';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform public.challenge_admin_close(ch);
  begin
    perform public.challenge_admin_finalize(ch);
    raise exception 'FAIL: finalizo con pendientes';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  ok := ok || 'no finaliza con pendientes'::text;

  -- Aporte enviado tras el cierre no cuenta
  perform pg_temp.img(782, a, 'back', 'approved', now() + interval '1 minute');
  if exists (select 1 from public.challenge_card_winners(ch) where card_id = 782) then
    raise exception 'FAIL: aporte tras el cierre conto';
  end if;
  ok := ok || 'aporte tras cierre = 0'::text;

  update public.card_images
  set status = 'rejected', rejection_reason = 'test', reviewed_by = adm, reviewed_at = now()
  where id = img_c5_front;
  n := public.challenge_admin_finalize(ch);
  if n <> 2 then raise exception 'FAIL: resultados %', n; end if;
  if (select string_agg(position || ':' || premium_months || ':' || status, ',' order by position)
      from public.challenge_awards where challenge_id = ch) <> '1:12:pending_activation,2:6:pending_activation' then
    raise exception 'FAIL: premios';
  end if;
  begin
    perform public.challenge_admin_reopen(ch);
    raise exception 'FAIL: reabrio un finalizado';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  ok := ok || 'finaliza, congela y adjudica premios sin fechas'::text;

  -- Tras finalizar, el ranking se lee congelado aunque cambien las imagenes
  update public.card_images set status = 'rejected', rejection_reason = 'x', taken_down_at = now()
  where card_id = 784 and source_type = 'community';
  perform pg_temp.as_user(b);
  if (select points from public.challenge_leaderboard(ch, 10, 0) where is_me) <> 2 then
    raise exception 'FAIL: ranking final no congelado';
  end if;
  ok := ok || 'ranking final congelado'::text;

  select count(*) into n from public.card_image_events e
  join public.card_images ci on ci.id = e.card_image_id where ci.storage_path like 'test/%';
  if n < 25 then raise exception 'FAIL: auditoria %', n; end if;
  ok := ok || ('auditoria eventos=' || n);

  raise exception 'ALL TESTS PASSED (rolled back): %', array_to_string(ok, ' | ');
end $$;
