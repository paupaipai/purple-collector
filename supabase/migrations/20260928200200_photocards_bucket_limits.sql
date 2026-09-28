-- SR-3 — Limite de tamano y whitelist de MIME en el bucket `photocards`.
--
-- El bucket tenia file_size_limit = null y allowed_mime_types = null, o sea
-- que aceptaba cualquier tipo de archivo y de cualquier tamano. La subida esta
-- restringida a admins por la policy "admin upload photocards", asi que no era
-- explotable por cualquiera, pero un bucket publico sin techo ni whitelist es
-- una superficie innecesaria: un error de un admin, o una sesion de admin
-- comprometida, alcanzaba para convertirlo en hosting de cualquier cosa.
--
-- Medido antes de aplicar, sobre los 4612 objetos existentes:
--
--   image/png    4611 objetos, el mayor 54 kB
--   image/jpeg      1 objeto,  40 kB
--   total        60 MB, promedio 13 kB
--   objetos sobre 1 MiB: 0
--
-- De ahi los valores. 5 MiB es ~100x el objeto mas grande que existe, asi que
-- no hay riesgo de rechazar una resubida de contenido actual, y sigue siendo un
-- techo razonable para un scan de photocard. La whitelist cubre los dos tipos
-- presentes mas webp, e iguala la de los buckets community.
--
-- OJO: el limite y la whitelist se aplican a subidas FUTURAS, no a los objetos
-- ya guardados. Nada del catalogo actual se invalida.
--
-- Curiosidad que quedo registrada: el unico objeto image/jpeg tiene extension
-- .png (todas las extensiones del bucket son .png). Por eso la whitelist
-- incluye jpeg: si fuera solo png, resubir ese objeto fallaria.
--
-- Si en algun momento hace falta subir HEIC directo desde un iPhone, hay que
-- agregar image/heic aqui; hoy no hay ninguno.
--
-- Reversible con:
--   update storage.buckets
--     set file_size_limit = null, allowed_mime_types = null
--   where id = 'photocards';

update storage.buckets
set file_size_limit   = 5242880,  -- 5 MiB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'photocards';
