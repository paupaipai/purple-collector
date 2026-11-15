-- Propuestas de card cuyo album NO esta en el catalogo.
--
-- Hasta ahora una propuesta exigia album, categoria y nombre, porque al
-- aprobarla se crea la card dentro de ese album. Si el album no existe, la
-- persona no tenia como proponer nada.
--
-- Con `album_unlisted = true` se pide solo foto, miembro y una DESCRIPCION
-- (en `notes`). No se crea nada automaticamente: es una solicitud que el
-- moderador revisa a mano (crea el album si vale la pena, y luego la card).
-- "Resolverla" la deja en 'approved' sin card creada.

alter table public.card_submissions
  add column if not exists album_unlisted boolean not null default false;

alter table public.card_submissions
  alter column album_id drop not null,
  alter column category_id drop not null,
  alter column card_name drop not null;

-- El largo del nombre solo aplica si hay nombre.
alter table public.card_submissions
  drop constraint if exists card_submissions_card_name_len;
alter table public.card_submissions
  add constraint card_submissions_card_name_len
  check (card_name is null or (length(btrim(card_name)) between 2 and 120));

-- Una propuesta normal sigue necesitando todo lo de antes.
alter table public.card_submissions
  drop constraint if exists card_submissions_listed_complete;
alter table public.card_submissions
  add constraint card_submissions_listed_complete
  check (album_unlisted or (album_id is not null and category_id is not null and card_name is not null));

-- Una sin album: sin taxonomia (no puede apuntar a un album que dice que no
-- existe) y con una descripcion que sirva para algo.
alter table public.card_submissions
  drop constraint if exists card_submissions_unlisted_has_description;
alter table public.card_submissions
  add constraint card_submissions_unlisted_has_description
  check (
    not album_unlisted
    or (
      album_id is null and version_id is null and card_set_id is null
      and notes is not null and length(btrim(notes)) >= 10
    )
  );

-- Aprobada = card creada, salvo las de album no listado, que se "resuelven"
-- sin crear nada.
alter table public.card_submissions
  drop constraint if exists card_submissions_approved_has_card;
alter table public.card_submissions
  add constraint card_submissions_approved_has_card
  check (status <> 'approved'::public.image_status or created_card_id is not null or album_unlisted);
