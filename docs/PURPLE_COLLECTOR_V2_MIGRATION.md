# Purple Collector V2 — Migración al catálogo comunitario

Fecha: 2026-09-27 · Rama: `feat/community-images-v2` (creada desde `main` @ `9688be0`)
Estado: **FASE B.1 + B.3 + C.1 + E + F aplicadas · backfill hecho · SR-1 a SR-4 y BUG-1 hechos.**

Documento hermano: [`PURPLE_V2_CURRENT_STATE.md`](./PURPLE_V2_CURRENT_STATE.md) — auditoría del estado real.
Roadmap de origen: `~/Downloads/Purple_Collector_v2_Roadmap.xlsx` (66 tareas).

> **Aplicado en producción el 2026-09-28** (con aprobación explícita):
> `20260928145804_create_card_images.sql` y
> `20260928150106_create_community_buckets.sql`.
>
> **Sigue sin tocarse:** `cards.image_path` (4503 intactas), `user_cards`,
> los ids, `cards_full`, la UI, el bucket `photocards` y sus policies. No se
> movió ni borró ninguna imagen. No se hizo backfill de las 4503.
>
> **Piloto ARIRANG ejecutado el 2026-09-28**: 6 filas en `card_images`,
> validado e idempotente. Ver §5.1.

---

## 1. Decisiones aprobadas

### D1 — Legacy

Las 4503 imágenes actuales **no se eliminan, no se ocultan y no se modifican**.

- `cards.image_path` **permanece intacta**, indefinidamente, por compatibilidad
  con la Android v1 publicada.
- En V2 son `source_type = 'legacy'`, `status = 'approved'`.
- V2 podrá aplicarles blur / overlay / watermark "Imagen Legacy" — eso es
  **presentación**, no estado.
- Legacy funciona como **fallback**: cuando existe una `community` aprobada,
  ésta tiene prioridad.
- **No se crea `legacy_hidden`.** `source_type` y `status` son conceptos
  ortogonales.

Combinaciones válidas:

| source_type | status | significado |
|---|---|---|
| `legacy` | `approved` | catálogo actual, fallback |
| `community` | `pending` | aportada, en revisión |
| `community` | `approved` | aportada y publicada — gana a legacy |
| `community` | `rejected` | aportada y rechazada, con motivo |
| `admin` | `approved` | subida por el equipo (si se usa) |

Invariantes en la base: `legacy ⇒ status='approved'` y
`not is_primary or status='approved'`.

### D2 — Modelo: una sola tabla

**`card_images`, sin `card_submissions` en el MVP.** Las submissions son filas
con `status='pending'`.

Cubre los requisitos pedidos:

| Requisito | Columna |
|---|---|
| qué usuario aportó | `contributed_by` → `auth.users` (`on delete set null`) |
| quién revisó | `reviewed_by` |
| cuándo se envió | `created_at` (para `community` es el momento del envío) |
| cuándo se revisó | `reviewed_at` |
| motivo de rechazo | `rejection_reason` (obligatorio si `rejected`) |
| aceptación de términos | `terms_accepted_at` + `terms_version` (obligatorios si `community`) |
| imagen primaria | `is_primary` |

### D3 — Storage: buckets independientes

No se mezcla UGC con `photocards`. Policies exactas propuestas en §4.

### D4 — Git

Rama `feat/community-images-v2` creada desde `main`. Verificación previa:

```
rama actual        : main
main               : 9688be0
origin/main        : 9688be0
main...origin/main : 0  0        (sin divergencia, nada que actualizar)
working tree       : solo docs/PURPLE_V2_CURRENT_STATE.md sin rastrear
stash              : vacío
```

No se descartó nada: el documento sin rastrear viajó con la rama.

### D5 — iPad / scope

QA de iPad **fuera de scope**. El commit `9688be0` eliminó el soporte.
Target actual: **Android + Web/PWA**. iOS/iPadOS nativo fuera de scope.

Efecto en el roadmap: la fase **10. iOS** (5 tareas, incluida "QA iPhone/iPad")
queda suspendida; la tarea 57 ("evitar depender de imágenes legacy
problemáticas") deja de ser bloqueante de release, pero **el riesgo legal R1 no
desaparece** — solo deja de tener a App Review como forzante.

---

## 2. Cambio respecto a la propuesta de FASE A

### 2.1 Backfill en dos pasos: piloto primero

FASE A proponía crear la tabla **y** backfillear las 4503 legacy en la misma
migration. **Aprobado: no.** Primero el piloto de 6 cards de ARIRANG (§5).

La constraint `unique (bucket_id, storage_path)` permite
`on conflict (bucket_id, storage_path) do nothing`, así que el backfill se puede
correr, reintentar y volver a correr sin duplicar nada.

**Ambos pasos ejecutados el 2026-09-28**: piloto de 6 cards (§5.1) y luego el
backfill completo en `20260928183346_backfill_legacy_card_images.sql` (§5.2).
Haberlos separado sirvió: el piloto validó los invariantes y la RLS contra datos
reales antes de tocar el catálogo entero.

### 2.2 Una primaria por `source_type`, no una por card

**Esto sí cambia la arquitectura propuesta en FASE A** y por eso se actualizó
`PURPLE_V2_CURRENT_STATE.md` §5.1/§7.

FASE A proponía:

```sql
create unique index card_images_one_primary
  on card_images (card_id) where is_primary and status = 'approved';
```

Una sola primaria por card. Pero D1 dice que legacy es **fallback** y que
community **tiene prioridad** — eso exige que ambas coexistan aprobadas. Con el
índice de FASE A habría que apagar `is_primary` en la legacy al aprobar la
community, y volver a encenderlo si la community se retira. Dos escrituras
correlacionadas, y si la segunda falla la card se queda sin imagen.

Lo aprobado:

```sql
create unique index card_images_one_primary_per_source
  on card_images (card_id, source_type) where is_primary and status = 'approved';
```

La prioridad `community > legacy` se resuelve **en la lectura** (§3). Ventajas
concretas: aprobar una community es una sola escritura; retirar una community
hace que la legacy reaparezca **sola**, sin ninguna escritura compensatoria; y
un takedown nunca puede dejar una card sin imagen por un fallo a mitad de camino.

---

## 3. Regla de display — IMPLEMENTADA (FASE E, 2026-09-28)

Orden de resolución de la imagen de una card:

1. `community` + `approved` + `is_primary`
2. `admin` + `approved` + `is_primary`
3. `legacy` + `approved` + `is_primary` (fallback)
4. placeholder

**Una imagen `pending` o `rejected` nunca se convierte en imagen pública.**

No depende de ningún filtro del frontend. Está impuesto en **cuatro** capas:

| Capa | Mecanismo |
|---|---|
| Constraint | `check (not is_primary or status = 'approved')` |
| RLS | `card_images public read approved` → `using (status = 'approved')` |
| Vista | el lateral de `cards_full` filtra `status = 'approved' and is_primary` |
| Storage | pending vive en un bucket **privado** distinto (§4) |

El filtro de la vista es redundante con la RLS **a propósito**: un contributor
autenticado sí puede ver sus propias filas `pending` (policy
`card_images contributor reads own`), y sin ese filtro una pending suya podría
ganarle a la legacy **en su propia sesión**.

### Implementación

`20260928185827_cards_full_resolved_image.sql`. `cards_full` gana 4 columnas al
final —`primary_image_path`, `primary_image_bucket`, `primary_image_source`,
`primary_image_contributed_by`— resueltas con un `LEFT JOIN LATERAL ... LIMIT 1`:

```sql
left join lateral (
  select ci.storage_path, ci.bucket_id, ci.source_type, ci.contributed_by
  from public.card_images ci
  where ci.card_id = c.id and ci.status = 'approved' and ci.is_primary
  order by case ci.source_type
             when 'community' then 0
             when 'admin'     then 1
             else 2
           end
  limit 1
) img on true
```

El lateral con `limit 1` es lo que resuelve el **riesgo R11**: garantiza una fila
por card. Un join normal multiplicaría las filas en cuanto una card tuviera más
de una imagen, y los hooks paginan de a 1000 asumiendo una fila por card.

`image_path` **se conserva** y las 25 columnas anteriores quedan en el mismo
orden y tipo, así que la Android v1 publicada no nota el cambio.
`security_invoker = true` se declara explícitamente para no perder SR-1 en el
`create or replace`.

### Verificación

| Comprobación | Resultado |
|---|---|
| filas / cards distintas | 4503 / 4503 — **sin fan-out** |
| suma de ids (igual a antes del cambio) | 14 099 191 |
| columnas en la vista | 29 (25 + 4) |
| `primary_image_path` ≠ `image_path` | 0 |
| resueltas a `legacy` | 4503 |
| `security_invoker` preservado | sí |

Regla de display probada en caliente sobre la card 1437, con rollback forzado:

| Escenario | `primary_image_source` |
|---|---|
| solo legacy | `legacy` |
| + una community **pending** | `legacy` — la pending no aparece |
| + una community **approved primary** | `community`, con su bucket y su attribution |
| tras retirar la community | `legacy` — **reaparece sola** |

Esa última línea es lo que justifica el índice por `(card_id, source_type)`
en vez de por card: no hace falta ninguna escritura compensatoria al retirar una
imagen comunitaria.

Rendimiento del camino caliente (álbum de 287 cards): ~3,6 ms, con el lateral
usando el índice parcial `card_images_one_primary_per_source`. Toca más páginas
que antes (898 buffers vs 37) por el lookup por card, pero todas son aciertos de
caché. La medición previa al cambio (31 ms) fue en frío, así que las dos cifras
no son comparables directamente.

Extremo a extremo vía PostgREST con la clave pública: 287 filas para el álbum 3
y la URL resuelta devuelve el PNG real (HTTP 200, 11 125 bytes).

### Lo que NO incluye FASE E

El tratamiento visual de las legacy es **FASE F** (§3.1).

---

### 3.1 FASE F — tratamiento visual de las legacy (2026-09-28)

La decisión D1 dice que V2 **podrá** aplicar blur / overlay / watermark "Imagen
Legacy". Eso pide una **capacidad**, no un cambio incondicional — y por una razón
concreta: **hoy el 100% del catálogo es legacy**. Marcar las 4503 no distinguiría
nada de nada y degradaría la app para todos los usuarios actuales, sin ningún
beneficio hasta que existan imágenes comunitarias con las que contrastar.

Implementado siguiendo el idioma que ya usa el repo para esto
(`PREMIUM_ENABLED`, `BIAS_ENABLED`): el código entra completo y apagado.

```ts
// lib/constants.ts
export const LEGACY_TREATMENT_ENABLED = false;
export const LEGACY_BLUR_RADIUS = 3;
export const LEGACY_VEIL_COLOR = 'rgba(11,0,36,0.35)';
```

Con la bandera en `true`:

| Dónde | Tratamiento |
|---|---|
| `Photocard.tsx` (grilla) | `blurRadius={3}` sobre la imagen + velo lila + etiqueta "Legacy" abajo a la izquierda, enfrentada al icono de estado |
| `CardStatusModal.tsx` (detalle) | etiqueta de procedencia sobre el pie de la miniatura: "Legacy" o "Comunidad" |

La condición es `card.primary_image_source === 'legacy'`, así que **una imagen
aportada y aprobada nunca lleva marca de legacy** — que es justamente el
incentivo que se busca.

i18n: `imageSourceLegacy` y `imageSourceCommunity`, en ES y EN.

**Cuándo encenderla:** cuando haya una masa real de imágenes comunitarias, o si
hace falta diferenciar el contenido de terceros por otro motivo. Es una línea.

**Lo que FASE F no incluye:** la attribution nominal ("Aportada por @usuario",
tarea 32 del roadmap) está **bloqueada**: `user_profiles` no tiene columna
`username` y `display_name` es nullable y no único. La vista ya expone
`primary_image_contributed_by`, así que falta solo decidir cuál es el handle
público.

---

## 4. Storage — policies de los buckets (creados 2026-09-28)

### 4.1 Por qué dos buckets y no uno

Un bucket de Supabase con `public = true` sirve **todos** sus objetos por
`/object/public` **sin evaluar RLS**. Es lo que hace `photocards` hoy y es lo
que permite que `getPhotocardUrl()` devuelva una URL permanente que
`expo-image` puede cachear en disco.

Consecuencia: un único bucket público para UGC haría públicamente accesibles las
`pending` y `rejected`, contra D3. Y un único bucket privado obligaría a URLs
firmadas con expiración para **todas** las imágenes, rompiendo el caché en disco
y el patrón actual.

Propuesta: **separar por estado, no solo por origen.**

| Bucket | `public` | Contenido |
|---|---|---|
| `photocards` | `true` | **Sin cambios.** Legacy. Lo que lee la Android v1. |
| `photocard-community-review` | **`false`** | `pending` y `rejected`. Solo autor + admin. |
| `photocard-community` | `true` | **Solo aprobadas.** Lectura pública. |

Al aprobar, el objeto se **mueve** de `...-review` a `photocard-community` y se
actualiza `card_images.storage_path` / `bucket_id`. Por eso `bucket_id` es una
columna de la tabla y por eso la CHECK de bucket **no** está atada al `status`
(habría un estado intermedio inválido durante el movimiento).

Coste asumido: un `storage.move` en el flujo de aprobación, que debe ser
idempotente y reconciliable. Se diseña en FASE D/G.

> **APROBADO el 2026-09-28** ("usa los 3 buckets"). Los dos buckets community
> fueron creados junto a sus policies en
> `20260928150106_create_community_buckets.sql`. `photocards` no se tocó.

### 4.2 Configuración de bucket propuesta

Ambos buckets community:

```
file_size_limit     : 5242880           -- 5 MiB
allowed_mime_types  : {image/jpeg, image/png, image/webp}
```

(`photocards` hoy tiene ambos en `null`; corregirlo es **SR-3**, aparte.)

### 4.3 Policies propuestas para `photocard-community-review` (privado)

Convención de ruta: `<auth.uid()>/<uuid>.<ext>` — la propiedad es derivable del
path, sin join.

```sql
-- NO EJECUTAR. Propuesta para revisión.

-- Leer: solo el autor y los admins. Sin policy pública: el bucket es privado.
create policy "community review read own or admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photocard-community-review'
    and ( (storage.foldername(name))[1] = auth.uid()::text or public.is_admin() )
  );

-- Subir: solo en la carpeta propia. El límite de tamaño y la whitelist de MIME
-- los impone el bucket, no la policy.
create policy "community review insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photocard-community-review'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: retirar un envío propio, o limpieza por moderación.
create policy "community review delete own or admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photocard-community-review'
    and ( (storage.foldername(name))[1] = auth.uid()::text or public.is_admin() )
  );

-- Sin UPDATE para nadie salvo admin: reemplazar el binario de un envío ya
-- revisado permitiría un bait-and-switch.
create policy "community review update admin"
  on storage.objects for update to authenticated
  using      (bucket_id = 'photocard-community-review' and public.is_admin())
  with check (bucket_id = 'photocard-community-review' and public.is_admin());
```

### 4.4 Policies propuestas para `photocard-community` (público, solo aprobadas)

```sql
-- NO EJECUTAR. Propuesta para revisión.

-- Lectura pública, igual que photocards.
create policy "community public read"
  on storage.objects for select to public
  using (bucket_id = 'photocard-community');

-- NINGUNA policy de INSERT para authenticated: los objetos entran aquí solo
-- por el movimiento que hace la aprobación (service_role, salta RLS). Un
-- usuario no puede escribir nunca en el bucket público.

-- Takedown.
create policy "community delete admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photocard-community' and public.is_admin());

create policy "community update admin"
  on storage.objects for update to authenticated
  using      (bucket_id = 'photocard-community' and public.is_admin())
  with check (bucket_id = 'photocard-community' and public.is_admin());
```

---

## 5. Piloto ARIRANG — las 6 cards

Álbum identificado: **`albums.id = 3`, `name = 'ARIRANG'`**, era `ARIRANG`
(id 8), tipo `Álbumes coreanos` (id 1), release `2026-03-20`.
287 cards, 48 card_sets, 7 cards de grupo, **1084 filas de `user_cards`**
apuntando a ese álbum.

Selección elegida para **cubrir formas distintas**, no por ser contiguas. Los
`id` son informativos: el script resuelve por `code`.

| # | id | `code` | miembro | `is_group` | categoría | set | country | draw | rarity | version | filas `user_cards` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1437 | `ARIRANG-WV-RM-GROUP` | RM | no | Album PCs | Weverse Albums Group PCs | KOREA | R1 | Common | 14 | 8 |
| 2 | 1444 | `ARIRANG-WV-GROUP-GROUP` | Group | **sí** | Album PCs | Weverse Albums Group PCs | KOREA | R1 | Common | 14 | 11 |
| 3 | 1445 | `ARIRANG-WV-GROUP-GROUP-2` | Group | **sí** | Album PCs | Weverse Albums Group PCs | KOREA | R1 | Common | 14 | 11 |
| 4 | 796 | `ARIRANG-RM-MUSIC-KOREA-LUCKY-DRAW` | RM | no | Lucky Draw | Music Korea Lucky Draw R1 | KOREA | R1 | **Rare** | — | 3 |
| 5 | 1565 | `ARIRANG-RM-WEVERSE-JAPAN-POBS` | RM | no | POBs | Weverse Japan POBs | **JAPAN** | R1 | Common | — | 2 |
| 6 | 1557 | `ARIRANG-JUNGKOOK-WEVERSE-GLOBAL-POBS-SELFIE-A` | Jungkook | no | POBs | Weverse Global POBs Selfie A | KOREA | R1 | Common | — | 9 |

Cobertura: 2 cards de grupo y 4 solistas · 3 miembros distintos (+ `Group`) ·
3 categorías · 4 card_sets · 2 países · 2 rarezas · `version_id` nulo y no nulo ·
44 filas de `user_cards` que deben quedar intactas.

Los 6 `image_path` y sus objetos, verificados el 2026-09-27 (**los 6 existen** en
el bucket `photocards`):

| id | `image_path` | bytes | mime | objeto creado |
|---|---|---|---|---|
| 796 | `korean_albums/arirang/arirang/lucky_draw/arirang_music_korea_lucky_draw/rm.png` | 12 422 | image/png | 2026-06-20 |
| 1437 | `korean_albums/arirang/arirang/album_pc/wv/arirang-weverse-albums-group-pcs/rm.png` | 11 125 | image/png | 2026-07-03 |
| 1444 | `korean_albums/arirang/arirang/album_pc/wv/arirang-weverse-albums-group-pcs/group.png` | 11 072 | image/png | 2026-07-03 |
| 1445 | `korean_albums/arirang/arirang/album_pc/wv/arirang-weverse-albums-group-pcs/group_2.png` | 12 404 | image/png | 2026-07-03 |
| 1557 | `korean_albums/arirang/arirang/pob/arirang_weverse_global_pob_a/jungkook.png` | 13 812 | image/png | 2026-07-04 |
| 1565 | `korean_albums/arirang/arirang/pob/arirang_weverse_japan_pob/rm.png` | 22 362 | image/png | 2026-07-04 |

Script: `supabase/scripts/pilot_arirang_legacy_images.sql` — **fuera de
`migrations/`** para que `supabase db push` no lo ejecute nunca. Aborta si
alguna card no existe, no pertenece a ARIRANG, no tiene `image_path` o su objeto
no está en el bucket.

---

### 5.2 Resultado del backfill completo (ejecutado 2026-09-28)

`20260928183346_backfill_legacy_card_images.sql`. Un único bloque `DO`: atómico,
con 3 guardas previas y 6 verificaciones.

Guardas: ninguna `image_path` sin objeto real en el bucket · ninguna
`image_path` compartida por más de una card · las filas legacy previas
coherentes con su card.

| Métrica | Valor |
|---|---|
| filas antes (piloto) | 6 |
| insertadas | **4497** |
| total en `card_images` | **4503** |
| `legacy` + `approved` + `is_primary` | 4503 |
| con `contributed_by` | 0 |
| `pending` o `rejected` | 0 |
| cards con imagen y **sin** fila | 0 |
| `storage_path` ≠ `cards.image_path` | 0 |
| cards con más de una primaria legacy | 0 |

Controles: `cards.image_path` 4503 (intactas) · `user_cards` sin tocar · 4612
objetos en `photocards` · 0 en los buckets community.

Idempotencia comprobada: segunda corrida → 0 insertadas, 4503 en total.
`anon` ve 4503 filas sobre 4503 cards distintas, una por card.

Reversible con `delete from card_images where source_type = 'legacy';`

---

## 6. SECURITY_REMEDIATION_PLAN

Hallazgos de FASE A. **Ninguno se mezcla en la migration de `card_images`.**
Cada uno es una migration y un commit propios, revisables por separado.

| ID | Hallazgo | Severidad | Bloquea V2 | Migration propuesta |
|---|---|---|---|---|
| ~~**SR-1**~~ | ~~`cards_full` es `SECURITY DEFINER` (advisor: ERROR)~~ | Alta | — | **HECHO 2026-09-28**: `20260928182438_cards_full_security_invoker.sql` |
| ~~**SR-2**~~ | ~~`user_profiles` expone las 34 filas a `anon`, incluido `is_admin`~~ | Alta | — | **HECHO 2026-09-28**: `20260928195206_restrict_user_profiles_read.sql` |
| ~~**SR-3**~~ | ~~Bucket `photocards` sin `file_size_limit` ni `allowed_mime_types`~~ | Media | — | **HECHO 2026-09-28**: `20260928200200_photocards_bucket_limits.sql` |
| ~~**SR-4**~~ | ~~Sin policy DELETE en `storage.objects` para `photocards`~~ | Media | — | **HECHO 2026-09-28**: `20260928200304_photocards_admin_delete_policy.sql` |
| **SR-5** | `search_path` mutable en `is_admin`, `set_card_status`, `get_collection_stats` (advisor: WARN ×3) | Baja | No | `..._function_search_path.sql` |
| **SR-6** | `set_card_status` y `get_collection_stats` existen, no están en ninguna migration y la app **no las llama** | Baja | No | investigar → `drop` o documentar |
| **SR-7** | Policies duplicadas/solapadas en `user_profiles` (2 INSERT equivalentes, 3 SELECT) | Baja | No | `..._cleanup_user_profiles_policies.sql` |

### SR-1 — detalle

Hoy es inocuo: `cards` es de lectura pública, así que definer e invoker dan lo
mismo. **Deja de serlo en FASE E**, cuando la vista incluya imágenes con estado
de moderación: una vista `SECURITY DEFINER` evalúa con permisos del creador y
filtraría `pending` y `rejected`. Es prerequisito de la nueva vista, no un
"nice to have".

**Aplicado el 2026-09-28.** Se usó `alter view public.cards_full set
(security_invoker = true)` en vez de `create or replace view`: cambia solo la
opción, sin reescribir la definición, así que no hay riesgo de alterar columnas,
orden ni el filtro `is_visible`.

Verificación antes y después, idéntica en los tres roles:

| rol | filas | suma de ids |
|---|---|---|
| `postgres` | 4503 | 14 099 191 |
| `anon` | 4503 | 14 099 191 |
| `authenticated` | 4503 | 14 099 191 |

Las tres vistas del esquema (`cards_full`, `album_card_counts`,
`member_card_counts`) quedan ahora con `security_invoker = true`, y el advisor
de seguridad pasa a **cero ERRORs**. Los WARN que quedan son todos preexistentes
(SR-5, funciones `SECURITY DEFINER` invocables, políticas con acceso anónimo
—intencionales— y protección de contraseñas filtradas).

Reversible con `alter view public.cards_full set (security_invoker = false);`

### SR-3 y SR-4 — hechos (2026-09-28)

**SR-3.** Medido antes de poner límites, sobre los 4612 objetos de `photocards`:

| MIME | objetos | el mayor |
|---|---|---|
| `image/png` | 4611 | 54 kB |
| `image/jpeg` | 1 | 40 kB |

Total 60 MB, promedio 13 kB, **0 objetos sobre 1 MiB**. De ahí los valores:
`file_size_limit = 5 MiB` (≈100× el objeto más grande que existe, así que no
hay riesgo de rechazar una resubida del catálogo actual) y
`allowed_mime_types = {image/png, image/jpeg, image/webp}` — los dos tipos
presentes más webp, igualando los buckets community.

Se aplica solo a subidas **futuras**; nada del catálogo actual se invalida.

Rareza encontrada: el único objeto `image/jpeg` tiene extensión `.png` (todas
las extensiones del bucket son `.png`). Por eso la whitelist incluye jpeg — con
png sola, resubir ese objeto fallaría.

Si algún día hace falta subir HEIC directo desde un iPhone, hay que agregar
`image/heic`; hoy no hay ninguno.

**SR-4.** `photocards` tenía SELECT (pública), INSERT y UPDATE (de admin) pero
**ninguna** policy de DELETE: retirar una imagen por un reporte de copyright o
un takedown exigía `service_role`. Eso choca con la tarea 37 del roadmap, que
pide que retirar contenido sea una operación normal del mantenedor. Los buckets
community ya nacieron con su DELETE de admin; esto deja `photocards` a la par.

Usa `public.is_admin()` y no la forma inline de las policies hermanas del mismo
bucket. Es una inconsistencia deliberada: `is_admin()` es `SECURITY DEFINER`, así
que no depende de que la RLS de `user_profiles` deje leer la fila. Unificar las
hermanas sería parte de SR-7.

**Hallazgo al pasar:** las policies de admin de `photocards` leen
`user_profiles` dentro de su expresión, así que SR-2 pudo haberlas roto.
Verificado que **no**: el `EXISTS` inline sigue dando `true` para el admin,
porque solo necesita su propia fila, que la policy de "propia fila" permite.

Estado final de los tres buckets:

| bucket | público | límite | MIME | objetos |
|---|---|---|---|---|
| `photocards` | sí | 5 MiB | png, jpeg, webp | 4612 |
| `photocard-community` | sí | 5 MiB | jpeg, png, webp | 0 |
| `photocard-community-review` | **no** | 5 MiB | jpeg, png, webp | 0 |

`photocards` queda con las cuatro operaciones cubiertas: SELECT pública, e
INSERT / UPDATE / DELETE de admin.

**Predicado de la nueva policy, probado por rol:** `true` para el admin,
`false` para un usuario normal. No ejecuté un DELETE real: borrar metadata de
Storage en producción, aunque sea dentro de una transacción revertida, no vale
el riesgo cuando el predicado se puede evaluar directamente.

---

### SR-2 — hecho (2026-09-28)

Aplicado después de hacer la auditoría que era prerequisito.

**Auditoría — los tres accesos de la app son a la propia fila y con sesión:**

| Sitio | Query | Gate |
|---|---|---|
| `app/_layout.tsx:107` | `select onboarding_completed .eq('id', session.user.id)` | dentro del bloque que retorna si `!session` |
| `lib/BiasContext.tsx:54` | `select biases .eq('id', userId)` | el efecto retorna si `!userId` |
| `hooks/useAuth.ts:179` | `update display_name` de la propia fila | tras el login |

Ninguno lee el perfil de otra persona; ninguno corre como `anon`. Las edge
functions usan `service_role` y saltan RLS. Así que bastó con **quitar la policy
permisiva** — sin tocar grants ni crear vistas, al contrario de lo que había
propuesto: las dos policies de "propia fila" que ya existían cubren los tres
casos.

```sql
drop policy if exists "Public read profiles" on public.user_profiles;
```

**Verificación, los dos lados:**

| Quién | Antes | Después |
|---|---|---|
| `anon` (SQL) | 34 filas, 1 admin visible | **0 filas, 0 admins** |
| `anon` (REST con la clave publicable) | las 34 filas | **`[]`** |
| `authenticated` con un `sub` real | — | **1 fila, la suya**, y lee `onboarding_completed` y `biases` |
| control: `cards_full` como `anon` | 200 | **200** — el catálogo sigue público |

Quedan 6 policies en `user_profiles`: 2 INSERT, 2 SELECT y 2 UPDATE, redundantes
por pares. Esa limpieza es **SR-7**, aparte.

**Para la attribution de V2:** no se debe reabrir esta policy. Va por una vista
restringida con solo `(id, display_name, avatar_url)` y `security_invoker`.

---

## 7. Bugs existentes — commits independientes

No se corrigen dentro de la migration de `card_images`.

| ID | Bug | Archivo | Commit propuesto |
|---|---|---|---|
| **BUG-1** | Filtra por `c.image_url`, que `cards_full` no expone (expone `image_path`). `Image.prefetch` del álbum **nunca corre**: el `filter` deja el array vacío. Código muerto + pérdida silenciosa de rendimiento en la pantalla más usada. | `hooks/useCards.ts:113-114` | `fix: prefetch de imágenes en la vista de álbum` |
| **BUG-2** | **64 de los 140 `albums.cover_image_url` apuntan a objetos que no existen** en el bucket → portadas rotas. Hallazgo nuevo de esta iteración. | datos | `fix: portadas de álbum inexistentes` (requiere decidir: subir o vaciar) |
| **BUG-3** | `cards.is_visible` default `false`: una card insertada por un futuro flujo de aprobación queda invisible salvo que se ponga explícitamente. | schema | `chore: revisar default de cards.is_visible` |
| **BUG-4** | `card_status` tiene `pending` como DEFAULT, la app nunca lo escribe y `lib/types.ts` no lo conoce. Un insert sin `status` explícito queda en un estado que ninguna pantalla renderiza. Hoy: 0 filas así. | schema + `lib/types.ts` | `chore: alinear enum card_status con CardStatus` |
| **BUG-5** | `cards_full` no expone `country` ni `draw_type`, así que `useCards.ts` lanza 2 queries extra por álbum para recomponerlos. Optimización, no bug de corrección. | `hooks/useCards.ts` | opcional, fusionable con FASE E |

---

## 8. Informe de objetos huérfanos en Storage

**Nada se borró.** Solo lecturas.

Los "109 huérfanos" de FASE A eran una medición incompleta: contaban objetos no
referenciados por `cards.image_path`, sin considerar `albums.cover_image_url`.

| Medición | Objetos |
|---|---|
| Total en bucket `photocards` | 4612 |
| Referenciados por `cards.image_path` | 4503 |
| No referenciados por `cards` | 109 |
| — de esos, referenciados por `albums.cover_image_url` | **76** |
| **Huérfanos reales** | **33** |
| `.emptyFolderPlaceholder` | 0 |

Hallazgo colateral: de los 140 `albums.cover_image_url` poblados, **64 apuntan a
objetos que no existen** (→ BUG-2).

### Los 33 huérfanos, por origen probable

**(A) 7 objetos — ARIRANG Music Korea Lucky Draw R2 · ruta equivocada**

```
korean_albums/arirang/arirang/lucky_draw/rim/arirang_music_korea_lucky_draw_r2/{jhope,jimin,jin,jungkook,rm,suga,v}.png
```
Creados 2026-07-03 · ~102 KB · image/png

Origen confirmado: las cards del set `Music Korea Lucky Draw R2` (set 140, ids
1460+) apuntan a
`korean_albums/arirang/arirang/lucky_draw/arirang_music_korea_lucky_draw_r2/rm.png`
— **sin** el segmento `rim/`. Subida a una ruta errónea, resubida correctamente,
la primera quedó atrás. Superseded.

**(B) 7 objetos — PTD Live random PC**

```
korean_albums/live_ost_specials/ptd_live/album_pc/ptd-live-random-pc/{7 miembros}.png
```
Creados 2026-06-24 · ~109 KB · image/png
Ninguna card los referencia. Set probablemente nunca cargado en `cards`.

**(C) 7 objetos — Winter Package 2021, caras traseras** ← *el más interesante*

```
merch_seasons_greetings/summer_winter_package/winter_package_2021/album_pc/winter_package_2021_pc/{7 miembros}_back.png
```
Creados 2026-08-21 · ~101 KB · image/png

Son los **reversos** de photocards. El schema actual no puede referenciarlos:
`cards` tiene una sola `image_path`. Es un argumento directo a favor de
`card_images` — es exactamente el caso "varias imágenes por card" que la tabla
habilita. **Candidatos a recuperar, no a borrar.**

**(D) 12 objetos — variantes numeradas de Golden y D-Day**

```
solo_projects/jungkook/golden/exclusive/golden-walmart-pc/jungkook_2.png
solo_projects/jungkook/golden/pob/golden-ums-pob-pc/jungkook.png
solo_projects/jungkook/golden/pob/golden-wvg-special-gift-pvc-pc/jungkook_{4,5}.png
solo_projects/suga_agustd/d_day/album_pc/{1,2,wv}/album_pcs/suga{,_2,_3}.png
```
Creados 2026-07-27 → 2026-08-10 · ~207 KB · image/png
Sufijos `_2`/`_3`/`_4`/`_5`: sobrantes de reorganizaciones del catálogo.

### Recomendación

| Grupo | Objetos | Acción propuesta |
|---|---|---|
| A | 7 | Borrables (ruta errónea, superseded) — **tras confirmar** byte a byte contra los correctos |
| B | 7 | Revisar si el set PTD Live debería existir en `cards` |
| C | 7 | **No borrar.** Recuperar como segunda imagen por card cuando `card_images` esté en producción |
| D | 12 | Revisión manual caso a caso |

Total: ~518 KB. **No justifica ningún delete apresurado.** Sugerencia: no tocar
nada hasta que `card_images` esté validada, y entonces reevaluar C y D como
material a recuperar.

---

### 5.1 Resultado del piloto (ejecutado 2026-09-28)

Script reestructurado como **un único bloque `DO`** antes de correrlo: atómico,
y cualquier guarda o verificación que falle aborta sin escribir nada. El archivo
del repo es exactamente lo que se ejecutó.

Las 4 guardas y las 4 verificaciones pasaron. Resultado:

| card_id | `code` | source_type | status | is_primary | bucket | path == `image_path` |
|---|---|---|---|---|---|---|
| 796 | `ARIRANG-RM-MUSIC-KOREA-LUCKY-DRAW` | legacy | approved | sí | photocards | sí |
| 1437 | `ARIRANG-WV-RM-GROUP` | legacy | approved | sí | photocards | sí |
| 1444 | `ARIRANG-WV-GROUP-GROUP` | legacy | approved | sí | photocards | sí |
| 1445 | `ARIRANG-WV-GROUP-GROUP-2` | legacy | approved | sí | photocards | sí |
| 1557 | `ARIRANG-JUNGKOOK-WEVERSE-GLOBAL-POBS-SELFIE-A` | legacy | approved | sí | photocards | sí |
| 1565 | `ARIRANG-RM-WEVERSE-JAPAN-POBS` | legacy | approved | sí | photocards | sí |

Las seis con `contributed_by` nulo, como corresponde a legacy.

**Idempotencia comprobada:** segunda corrida → 0 filas insertadas, 6 en total.

**RLS comprobada en caliente** (con rollback forzado, sin residuo):

| Prueba | Resultado |
|---|---|
| `anon` ve las 6 aprobadas | sí |
| con una `pending` presente (7 filas reales), `anon` sigue viendo **6** | sí |
| `anon` puede insertar | **no** |

Los `card_images.id` son 16–21, no 1–6: la secuencia `identity` avanzó durante
las pruebas de invariantes previas, que se revirtieron. Es irrelevante — el id
no se expone ni se usa como clave de negocio.

**Controles post-piloto:** `cards` 4503 y `cards.image_path` 4503 (intactas) ·
`user_cards` sin tocar · 4612 objetos en `photocards` · **0** objetos en los
buckets community · 0 paths desalineados.

---

## 9. Entregables de esta iteración

| # | Entregable | Ruta | Estado |
|---|---|---|---|
| 1 | Documento de decisiones | `docs/PURPLE_COLLECTOR_V2_MIGRATION.md` | este archivo |
| 2 | Auditoría actualizada | `docs/PURPLE_V2_CURRENT_STATE.md` | §5.1 y §7 actualizadas (§2.2) |
| 3 | Migration estructural | `supabase/migrations/20260928145804_create_card_images.sql` | **aplicada** |
| 3b | Buckets de UGC | `supabase/migrations/20260928150106_create_community_buckets.sql` | **aplicada** |
| 3c | SR-1 | `supabase/migrations/20260928182438_cards_full_security_invoker.sql` | **aplicada** |
| 4 | Script de piloto | `supabase/scripts/pilot_arirang_legacy_images.sql` | **ejecutado**, 6 filas |
| 5 | Plan de seguridad | §6 | 7 ítems, migrations separadas |
| 6 | Cards del piloto | §5 | 6 cards identificadas y verificadas |
| 7 | Informe de huérfanos | §8 | 109 → 33 reales, 4 orígenes |

### Lo que sigue sin tocarse

- `cards.image_path` — 4503 intactas
- `user_cards` — sin una sola escritura
- los ids — ningún cambio de tipo ni de valor
- la UI — ningún archivo de `app/`, `components/`, `hooks/` o `lib/`
- el bucket `photocards` y sus 3 policies
- ninguna imagen movida ni borrada
- ningún objeto huérfano eliminado
- **sin backfill de las 4503**

### Nota sobre los timestamps de las migrations

`apply_migration` registra en el remoto el timestamp real de ejecución, no el
del archivo local. Los tres archivos se renombraron para calzar con lo que
quedó registrado (`20260928145804`, `20260928150106`, `20260928182438`) — el
mismo problema que resolvió el commit `5fb736a`. Sin eso, `supabase db push`
leería historial divergente e intentaría reaplicarlas.

### Pendiente

1. **FASE D**: upload real. Requiere `expo-image-picker` (no está instalado, y
   es nativo: implica rebuild de dev/EAS) y el flujo de aprobación que mueve el
   objeto de `...-review` al bucket público.
2. **Handle público para la attribution** — decisión de producto: ¿columna
   `username` única elegida por el usuario, o `display_name` con fallback? Hoy
   `display_name` es nullable y no único. Bloquea la tarea 32 del roadmap.
3. **SR-5 a SR-7** y los bugs BUG-2 a BUG-5, en commits separados.
4. **Los 7 reversos del Winter Package 2021** (§8, grupo C): ahora que
   `card_images` admite varias imágenes por card, son recuperables.
