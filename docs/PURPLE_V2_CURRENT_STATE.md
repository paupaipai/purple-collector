# Purple Collector v2 — Estado real del proyecto (FASE A: auditoría)

Fecha: 2026-09-27 · Auditada desde `main` @ `9688be0`
Proyecto Supabase auditado: `qlswdqqjtqepxfqagooi` (lectura únicamente)

> **FASE A aprobada el 2026-09-27.** Las decisiones de producto y arquitectura
> viven en [`PURPLE_COLLECTOR_V2_MIGRATION.md`](./PURPLE_COLLECTOR_V2_MIGRATION.md).
> Este documento sigue siendo la foto del estado real; las secciones §5.1, §5.4,
> §6 y §7 fueron actualizadas para reflejar lo aprobado.

> **Nada de esto se ejecutó.** No se aplicaron migrations, no se tocó Storage,
> no se modificó `user_cards`, no se cambió ningún id. Todas las consultas a
> Supabase fueron `SELECT` sobre catálogos del sistema y conteos agregados.

---

## 0. Aviso previo sobre el documento de referencia

`PURPLE_COLLECTOR_V2_MIGRATION.md` **no existe** — ni en el repo, ni en
`~/`, ni en el historial de git (los `.md` versionados son `ROADMAP.md`,
`TECHNICAL.md`, `QA_CHECKLIST.md`, `RELEASE_LINKS.md` y
`.github/ISSUE_TEMPLATE/bug_report.md`).

La única fuente del modelo v2 que se encontró es
**`~/Downloads/Purple_Collector_v2_Roadmap.xlsx`** (66 tareas, 13 fases, hojas
`Seguimiento` / `Dashboard` / `Gantt 12 semanas` / `No tocar todavía`). El
contraste de esta auditoría se hace contra ese xlsx. Si el `.md` existe en otra
parte, hay que re-contrastar: puede proponer nombres distintos a los que aquí
se asumen.

Del xlsx, el bloque que manda es **Fase 1. Core / BD**:
`cards` → `card_images` (con `source_type` legacy/community/admin) →
`card_submissions` → estados de moderación → `reports` → multi-grupo → RLS.

---

## 1. Qué se encontró

### 1.1 Stack

| Pieza | Valor real |
|---|---|
| App | Expo SDK `~54.0.33`, React Native `0.81.5`, React `19.1.0`, expo-router `~6.0.23` |
| Nombre interno | `purplecollector` (package.json), target iOS `PurpleCollector` |
| Backend | `@supabase/supabase-js` `^2.101.1` |
| Errores | `@sentry/react-native` `^8.19.0` |
| Pagos | `react-native-purchases` `^10.4.1` (RevenueCat) |
| Flags | `PREMIUM_ENABLED = false`, `BIAS_ENABLED = false` y `LEGACY_TREATMENT_ENABLED = false` en `lib/constants.ts` |
| Nativo | `/ios` y `/android` están en `.gitignore` (generados). El último commit quitó soporte de iPad. |
| **Sin dependencias de imagen** | No hay `expo-image-picker`, `expo-image-manipulator` ni `expo-file-system`. El upload de FASE D requiere dependencias nuevas. |

Credenciales: `lib/supabase.ts` hardcodea `SUPABASE_URL` y la publishable key
(comentario explícito de que viajan en el bundle). Consistente con la migration
`20260908030000` que cerró la escritura pública al catálogo por ese motivo.

### 1.2 Supabase — tablas reales

| Tabla | Filas | RLS |
|---|---|---|
| `public.cards` | 4503 | on |
| `public.user_cards` | 7400 | on |
| `public.albums` | 159 | on |
| `public.album_versions` | 135 | on |
| `public.album_eras` | 33 | on |
| `public.collection_types` | 6 | on |
| `public.card_categories` | 15 | on |
| `public.card_sets` | 882 | on |
| `public.user_profiles` | 34 | on |
| `public.push_tokens` | 31 | on |
| `public.notifications_log` | 60 | on |
| `public.card_images` | **4503** | on | ← creada 2026-09-28; backfill legacy completo |

**No existe** ninguna tabla de imágenes, submissions, reportes, grupos/artistas
ni roles de moderación. **No existe** tabla `groups` ni columna `group_id` en
ningún lado.

### 1.3 `cards` — columnas reales

```
id               integer  NOT NULL  nextval('cards_id_seq')   ← SERIAL, no uuid
album_id         integer  NOT NULL
version_id       integer  NULL
category_id      integer  NOT NULL
card_set_id      bigint   NULL
member           text     NOT NULL
member_full_name text     NULL
member_emoji     text     NULL
retailer         text     NULL
card_name        text     NOT NULL
code             text     NOT NULL
image_path       text     NULL      ← AQUÍ vive la imagen hoy
rarity           text     NULL      default 'Common'
is_group         boolean  NULL      default false
is_blurred       boolean  NULL      default false
is_visible       boolean  NULL      default FALSE   ← ojo
release_date     date     NULL
notes            text     NULL
country          text     NULL
draw_type        text     NULL
sort_order       integer  NOT NULL  default 0
created_at       timestamptz        default now()
```

### 1.4 Dónde vive la imagen hoy — respuesta directa

**En `cards.image_path` (text, nullable): un path relativo dentro del bucket
público `photocards`.** No hay tabla intermedia, no hay versiones, no hay
autoría, no hay estado.

Desde **FASE E** el punto de resolución de las imágenes de cards es
`getCardImageUrl()` en `lib/supabase.ts`, que toma el bucket de la vista.
`getPhotocardUrl()` queda solo para las **portadas de álbum**
(`albums.cover_image_url`, 3 llamadas: `app/type/[id].tsx`,
`app/album/[id].tsx`, `hooks/useEraAlbums.ts`):

```ts
export function getPhotocardUrl(imagePath: string): string {
  const { data } = supabase.storage.from('photocards').getPublicUrl(imagePath);
  return `${data.publicUrl}?v=${IMAGE_CACHE_VERSION}`;   // IMAGE_CACHE_VERSION = 'v1'
}
```

Convención de paths (5 prefijos de primer nivel, jerarquía semántica manual):

| Prefijo | Cards |
|---|---|
| `merch_seasons_greetings/` | 2104 |
| `korean_albums/` | 1166 |
| `solo_projects/` | 780 |
| `dvd_bluray/` | 232 |
| `japanese_albums/` | 221 |

Ejemplo: `korean_albums/school_trilogy/orul82/album_pc/orul82-album-pcs/rm.png`

**Datos duros del catálogo actual:**

| Métrica | Valor |
|---|---|
| cards totales | 4503 |
| cards con `is_visible = true` | **4503 (todas)** |
| cards con `image_path` no nulo | **4503 (todas)** |
| cards visibles **sin** imagen | **0** |
| cards con `is_blurred = true` | 0 |
| `image_path` compartidos por >1 card | 0 |
| objetos en bucket `photocards` | 4612 |
| objetos no referenciados por `cards` | 109 |
| — de esos, portadas de álbum (`albums.cover_image_url`) | 76 |
| **huérfanos reales** | **33** |

Consecuencia para el roadmap: **hoy no existe el estado "photocard sin
imagen"**. Las tareas 7 ("marcar imágenes actuales como legacy") y 23 ("diseñar
estado Sin imagen") operan sobre un catálogo 100% poblado con imágenes de
terceros. El estado "sin imagen" no tendrá datos reales que lo ejerciten hasta
que se abra multi-grupo o se oculten las legacy.

### 1.5 `user_cards` — columnas reales (NO se modificó)

```
id             integer     NOT NULL  nextval('user_cards_id_seq')
user_id        uuid        NOT NULL
card_id        integer     NOT NULL           ← FK a cards.id (integer)
status         card_status NULL      default 'pending'
quantity       integer     NULL      default 1
acquired_date  timestamptz NULL
trade_open     boolean     NULL      default false
notes          text        NULL
duplicate_count integer    NOT NULL  default 0
created_at     timestamptz NULL      default now()
updated_at     timestamptz NULL      default now()
```

Enum real: `card_status = have, want, otw, not_collecting, pending`

Distribución real de estados:

| status | filas |
|---|---|
| `have` | 3386 |
| `want` | 2082 |
| `otw` | 1913 |
| `not_collecting` | 19 |
| `pending` | **0** |

Hay constraint único sobre `(user_id, card_id)` — la app depende de él vía
`upsert(..., { onConflict: 'user_id,card_id' })` en `useCards.ts`,
`useWishlist.ts`.

### 1.6 Vistas

| Vista | Tipo | Notas |
|---|---|---|
| `cards_full` | `security_invoker = true` | Camino de lectura único de la app. Era `SECURITY DEFINER`; corregido el 2026-09-28 (**SR-1**). Extendida en **FASE E** con la imagen resuelta: 29 columnas |
| `album_card_counts` | `security_invoker = true` | Migration `20260908024314` |
| `member_card_counts` | `security_invoker = true` | Migration `20260908024314` |

`cards_full` expone: `id, code, member, member_full_name, member_emoji,
card_name, retailer, rarity, image_path, is_group, is_blurred, release_date,
notes, album_id, album_name, album_short, album_color, album_cover, version_id,
version_name, version_short, category_id, category_name, category_short,
category_color`; filtra `WHERE c.is_visible = true`.

Desde **FASE E** expone además `primary_image_path`, `primary_image_bucket`,
`primary_image_source` y `primary_image_contributed_by` — la imagen ya resuelta
según la regla de display (`community` > `admin` > `legacy`), vía
`LEFT JOIN LATERAL ... LIMIT 1` sobre `card_images`. `image_path` se conserva
intacta para la Android v1.

Desde **BUG-5** expone también `country`, `draw_type` y `category_sort_order`,
así que `useCards.ts` ya no los recompone en cliente: la pantalla de álbum pasó
de 4 consultas de catálogo a 2. **32 columnas en total.**

Sigue sin exponer `card_set_id` ni `cards.sort_order`, que la app no usa.

### 1.7 Storage

Tres buckets (los dos community creados el 2026-09-28, ambos vacíos):

| id | public | file_size_limit | allowed_mime_types | objetos |
|---|---|---|---|---|
| `photocards` | true | 5 MiB | png, jpeg, webp | 4612 |
| `photocard-community` | true | 5 MiB | jpeg, png, webp | 0 |
| `photocard-community-review` | **false** | 5 MiB | jpeg, png, webp | 0 |

Los tres buckets tienen ya límite de 5 MiB y whitelist de MIME: `photocards` la
recibió el 2026-09-28 (**SR-3**).

Policies sobre `storage.objects`:

| Policy | cmd | roles | condición |
|---|---|---|---|
| `public read photocards` | SELECT | public (incl. anon) | `bucket_id = 'photocards'` |
| `admin upload photocards` | INSERT | authenticated | bucket + `user_profiles.is_admin` |
| `admin update photocards` | UPDATE | authenticated | bucket + `user_profiles.is_admin` |

**No hay policy de DELETE.** Retirar una imagen reportada no es posible hoy
desde la app ni como admin autenticado: requiere `service_role`.

### 1.8 RLS existente en `public`

| Tabla | Lectura | Escritura |
|---|---|---|
| `cards`, `albums`, `album_versions`, `card_categories` | `Public read *` → `public`, `USING true` | solo `admin_all_*` (ALL, authenticated, `is_admin()`) |
| `album_eras`, `collection_types`, `card_sets` | `... read for authenticated` → `authenticated`, `USING true` | solo `admin_all_*` |
| `user_cards` | `Own cards select` → `public`, `auth.uid() = user_id` | insert/update/delete propios |
| `user_profiles` | solo "propia fila" (`auth.uid() = id`), 3 policies a `authenticated` tras **SR-7**. La permisiva `Public read profiles` se eliminó en **SR-2** | insert/update propios; el UPDATE está limitado **por columna** tras **SR-8** — `is_admin` y `created_at` no son modificables |
| `push_tokens` | own | own (+ RPC `register_push_token` SECURITY DEFINER) |
| `notifications_log` | solo admin | ninguna para cliente (service_role) |

`is_admin()`:

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true);
$$;
```

Admins reales en la base: **1**.

### 1.9 Migrations — el repo NO es la fuente de verdad

8 archivos en `supabase/migrations/`:

```
20260805120000_add_push_notifications.sql
20260806000000_push_tokens_select_policy.sql
20260806130000_add_country_to_cards.sql
20260807090000_add_draw_type_to_cards.sql
20260810120000_fix_push_token_reassignment.sql
20260810120100_add_name_en_to_collection_types.sql
20260908024314_add_card_count_views.sql
20260908030000_restrict_catalog_writes_to_admins.sql
```

**Todo el núcleo del schema es anterior a la carpeta y nunca fue capturado**:
`cards`, `albums`, `album_versions`, `album_eras`, `collection_types`,
`card_categories`, `card_sets`, `user_cards`, `user_profiles`, el enum
`card_status`, la vista `cards_full`, `is_admin()`, el bucket y sus policies.
La migration `20260810120100` lo dice explícitamente ("la tabla misma precede a
la carpeta de migrations") y `20260908024314` anota "ya aplicada en el proyecto
remoto; este archivo deja el repo a la par".

Funciones que existían en la base y **no** estaban en ninguna migration:
`set_card_status`, `get_collection_stats`, `handle_new_user`, `is_admin`. Las
dos primeras se **borraron** el 2026-09-28 (**SR-6**): estaban muertas.
`is_admin` quedó con `search_path` fijo (**SR-5**). El único `.rpc()` del código
sigue siendo `register_push_token` en `hooks/usePushNotifications.ts:64`.

### 1.10 Tipos TypeScript

`lib/types.ts` (110 líneas). Relevante:

```ts
export type CardStatus = 'have' | 'want' | 'otw' | 'not_collecting';  // sin 'pending'
export type ImageSourceType = 'legacy' | 'community' | 'admin';      // FASE E
export type ImageStatus = 'pending' | 'approved' | 'rejected';       // FASE E
export interface CardImage { ... }                                   // FASE E
export interface CardFull {
  ...;
  image_path: string | null;              // ruta legacy cruda, para la v1
  primary_image_path: string | null;      // FASE E: imagen resuelta
  primary_image_bucket: string | null;
  primary_image_source: ImageSourceType | null;
  primary_image_contributed_by: string | null;
}
export interface CardWithStatus extends CardFull { status: CardStatus | null; duplicate_count: number }
```

`CardFull` es un espejo manual de `cards_full` (no hay tipos generados desde
Supabase). `CardFull` declara `country` y `draw_type`, que la vista no expone —
los rellena `useCards.ts` con queries aparte.

### 1.11 Hooks / servicios

| Archivo | Lee | Escribe |
|---|---|---|
| `hooks/useCards.ts` | `albums`, `cards_full`, `cards`, `card_categories`, `user_cards` | `user_cards` (status, duplicate_count) |
| `hooks/useCollection.ts` | `user_cards` (`have`) + `cards_full` | — |
| `hooks/useWishlist.ts` | `user_cards` (`want`,`otw`) + `cards_full` | `user_cards` |
| `hooks/useAlbums.ts` | `user_cards`+`cards!inner`, `albums`, `album_versions`, `album_card_counts` | — |
| `hooks/useEraAlbums.ts` | `collection_types`, `album_eras`, `albums`, `album_versions`, `user_cards`, `album_card_counts` | — |
| `hooks/useCollectionTypes.ts` | `collection_types`, `album_eras`, `albums` | — |
| `hooks/useAuth.ts` / `usePushNotifications.ts` | auth / `push_tokens` | RPC |

No hay capa de servicios: cada hook habla directo a PostgREST. `lib/supabase.ts`
aporta los helpers de paginación `fetchAllPages` / `fetchAllByIds` /
`fetchAllRows` (existen porque PostgREST corta en 1000 filas y porque
`in.(...)` revienta el largo de URL).

### 1.12 Componentes que renderizan photocards

| Archivo | Uso de imagen |
|---|---|
| `components/Photocard.tsx` | `hasImage = !!getCardImageUrl(card) && !card.is_blurred`; si no, placeholder con la inicial del miembro. **FASE F**: blur + velo + etiqueta "Legacy" cuando `primary_image_source === 'legacy'`, tras `LEGACY_TREATMENT_ENABLED` (hoy `false`) |
| `components/CardStatusModal.tsx:35` | thumb desde `card.image_path` |
| `app/(tabs)/wishlist.tsx:43` | thumb desde `card.image_path` |
| `app/album/[id].tsx` | 527 líneas — el corazón del catálogo |
| `app/type/[id].tsx:66` | `album.cover_image_url` |

Jerarquía visual actual en `Photocard.tsx`: **binaria**, `have` vs todo lo
demás. Dos constantes la calibran: `NOT_OWNED_IMAGE_OPACITY = 0.65` y
`NOT_OWNED_OVERLAY_OPACITY = 0.32` (velo lila). El estado se indica con un icono
en la esquina (`✓` / corazón / carrito / `✕` / círculo vacío).
No hay gradación 100/90/75/50% como pide la tarea 21.

`app/album/[id].tsx` ya tiene los filtros de la tarea 22, con estos valores de
`statusFilter`: `'All' | 'none' | 'have' | 'want' | 'otw' | 'not_collecting'`.
`'none'` = `status === null`, que es exactamente el "Missing" del roadmap.

### 1.13 Panel administrativo

**No existe.** Cero referencias a `is_admin` / `isAdmin` / `admin` en `app/`,
`components/`, `hooks/` o `lib/`. Toda la administración del catálogo se hace
desde el dashboard de Supabase a mano. Lo único con gate de admin en runtime es
la edge function `send-notification`.

### 1.14 Edge functions

| Función | `verify_jwt` | Qué hace |
|---|---|---|
| `delete-account` | `false` (valida internamente con `withSupabase({ auth: ["user"] })`) | revoca token Apple → borra `user_cards` → borra `user_profiles` → `auth.admin.deleteUser`. **No toca Storage.** |
| `send-notification` | `true` | broadcast push, gate por `is_admin`, audita en `notifications_log` |

### 1.15 i18n

`lib/i18n.ts`, 374 líneas, dos objetos planos `en` y `es`, con
`TranslationKey = keyof typeof en` y `const es: Translations`. Toda key nueva
debe ir en **ambos** o TypeScript rompe. La v2 añade del orden de 40 keys
(estados, aportar imagen, derechos, moderación, reportes, attribution).

---

## 2. Contraste con el roadmap v2

| Tarea del roadmap | Realidad | Veredicto |
|---|---|---|
| 5. Separar `cards` de `card_images` | La imagen es la columna `cards.image_path` | Correcto, hay que crear la tabla |
| 6. `source_type` legacy/community/admin | No existe | Nuevo |
| 7. Marcar actuales como legacy | 4503/4503 con imagen → **el catálogo entero es legacy** | Backfill trivial, riesgo legal intacto |
| 8. `card_submissions` | No existe | Nuevo — ver §5, propongo replantearlo |
| 9. Estados de moderación | No existe | Nuevo |
| 10. `reports` | No existe | Nuevo |
| 11. `group_id` / multi-grupo | No hay tabla ni columna. `albums.artist` es texto libre con 9 valores: `BTS, RM, Jin, Suga, SUGA / Agust D, j-hope, Jimin, V, Jungkook` | Nuevo **y** requiere normalizar: `Suga` y `SUGA / Agust D` ya son dos valores distintos |
| 12. Revisar RLS | Existe y es coherente para v1; nada cubre UGC ni moderación | Ampliar |
| 4/21. 5 estados Have/Want/OTW/Missing/Not collecting | 4 en el enum + `Missing` = ausencia de fila (`statusFilter === 'none'`) | **No agregar `missing` al enum**; ya está modelado |
| 13–19. Panel mantenedor | No hay panel | Todo nuevo |
| 20. Ver todas las photocards aunque no las tengas | **Ya funciona así** (`cards_full` trae el álbum completo, el status se superpone) | Nada que hacer |
| 22. Filtros de estado | **Ya existen** en `app/album/[id].tsx` | Nada que hacer |
| 27. Cámara y galería | Sin dependencias instaladas | Nuevo |
| 60. QA iPad | El último commit **quitó** soporte de iPad | Contradicción a resolver con el roadmap |

---

## 3. Qué archivos y tablas habría que modificar

### Tablas / objetos existentes a tocar (ninguno de forma destructiva)

| Objeto | Cambio | Fase |
|---|---|---|
| `cards.image_path` | **Se conserva tal cual.** Queda deprecada pero viva: la Android v1 ya instalada la lee. Se retira recién cuando no queden clientes v1. | — |
| `cards.is_visible` | Revisar el default `false` antes de que un flujo de aprobación inserte cards | B |
| `cards_full` | Añadir la imagen primaria aprobada (`primary_image_path`, `image_source_type`, `image_contributed_by`) **sin quitar `image_path`**; y pasar a `security_invoker = true` | E |
| `storage.objects` policies | Nueva policy INSERT para `authenticated` limitada a un prefijo propio; nueva policy DELETE para admin | D |
| bucket `photocards` | Añadir `allowed_mime_types` y `file_size_limit`, **o** crear bucket aparte para UGC | D |
| `user_profiles` | Añadir `username` (para attribution) y estado de contributor; limpiar policies duplicadas; reevaluar `Public read profiles` | C/G |
| enum `card_status` | **Sin cambios** | — |
| `user_cards` | **Sin cambios** | — |
| `delete-account` | Manejar imágenes aportadas y attribution antes de borrar el usuario | C |

### Archivos del repo a tocar

| Archivo | Por qué |
|---|---|
| `supabase/migrations/` | Migrations nuevas de FASE B en adelante |
| `lib/types.ts` | `CardImage`, `ImageSourceType`, `ImageStatus`; `CardFull` con los campos de imagen |
| `lib/supabase.ts` | `getPhotocardUrl` sigue sirviendo (mismo bucket); añadir helper de upload y, si se separa el bucket, un segundo resolver |
| `hooks/useCards.ts` | Camino de lectura del álbum + **bug §4.1** |
| `hooks/useCollection.ts`, `hooks/useWishlist.ts` | Consumen `cards_full`; se arrastran con el cambio de vista |
| `components/Photocard.tsx` | Jerarquía de 5 estados (tarea 21), estado "sin imagen" (23), "en revisión" (24) |
| `components/CardStatusModal.tsx` | Punto de entrada natural a "Aportar imagen" y "Reportar" |
| `app/album/[id].tsx` | Pantalla más afectada |
| `lib/constants.ts` | `STATUS_CONFIG` / opacidades / nuevos estados de imagen |
| `lib/i18n.ts` | ~40 keys × 2 idiomas |
| `package.json` | `expo-image-picker` (+ manipulator si hay recorte) |
| `app/_layout.tsx` + rutas nuevas | detalle de photocard, aportar, mis contribuciones, panel admin |
| `docs/privacy.html` | UGC, moderación, copyright (tareas 34–38) |

---

## 4. Riesgos detectados

### 4.1 Bugs reales encontrados de paso (no son parte de la migración)

1. ~~**`hooks/useCards.ts` filtra por `c.image_url`, campo que `cards_full` no
   expone**~~ — **CORREGIDO el 2026-09-28 (BUG-1, commit propio).** El
   `Image.prefetch` del álbum nunca corría: el `filter` dejaba el array vacío.
   Ahora precarga la imagen ya resuelta por la vista.
2. ~~**`cards_full` es SECURITY DEFINER**~~ — **CORREGIDO el 2026-09-28 (SR-1).**
   Era inocuo entonces (`cards` es de lectura pública), pero en cuanto la vista
   incluya imágenes con estado de moderación, un SECURITY DEFINER **filtraría
   pending y rejected** saltándose la RLS del que consulta. El advisor de
   seguridad queda en cero ERRORs.
3. **`cards.is_visible` tiene default `false`.** Cualquier card insertada por un
   futuro flujo de aprobación queda invisible salvo que se ponga explícitamente.
   **Deliberadamente NO cambiado** (BUG-3): podría ser intencional —insertar como
   borrador y publicar después— y con 4503/4503 visibles no hay evidencia de que
   ese flujo esté en uso. Ponerlo en `true` podría publicar cards a medio cargar.
   Lo que sí es obligatorio: el flujo de aprobación de FASE G debe fijar
   `is_visible` explícitamente.
4. ~~**`card_status` tiene `pending` como DEFAULT**~~ — **CORREGIDO el
   2026-09-28 (BUG-4).** Era un estado fantasma, 0 filas sobre 7381. Ahora un
   insert sin `status` queda en NULL, que es como la app representa "sin
   marcar". `pending` sigue existiendo en el enum, sin uso.
5. **33 objetos huérfanos reales** en el bucket (de 109 no referenciados por
   `cards`, 76 son portadas de álbum). Informe completo por origen en §8 del
   documento de decisiones. Además, **64 de los 140 `albums.cover_image_url`
   apuntan a objetos que no existen** → portadas rotas.
6. ~~**Sin policy DELETE en `storage.objects`**~~ — **CORREGIDO el 2026-09-28
   (SR-4).** `photocards` ya tiene las cuatro operaciones cubiertas: SELECT
   pública, e INSERT / UPDATE / DELETE de admin.
7. **`delete-account` no limpia Storage** → con UGC, borrar una cuenta dejará
   objetos huérfanos y romperá la attribution.
8. ~~**`Public read profiles` (`public`, `USING true`)** expone las 34 filas de
   `user_profiles` a `anon`, incluido `is_admin`~~ — **CORREGIDO el 2026-09-28
   (SR-2).** `anon` pasa de ver 34 filas y 1 admin a ver 0, verificado también
   por REST con la clave publicable.
9. **`user_profiles` no tiene `username`/handle.** La attribution
   "Aportada por @usuario" no tiene de dónde salir: `display_name` es nullable
   y no único.
10. ~~Policies duplicadas en `user_profiles`~~ — **CORREGIDO el 2026-09-28
    (SR-7).** Seis policies para tres operaciones pasaron a tres, todas a
    `authenticated`.
11. **Escalada de privilegios (hallazgo posterior, CORREGIDO — SR-8).** La RLS
    filtra filas, no columnas: cualquier usuario autenticado podía hacer
    `PATCH /rest/v1/user_profiles?id=eq.<su_uuid>` con `{"is_admin": true}` y
    quedar admin, y de ahí escribir todo el catálogo. Probado explotable antes
    de cerrarlo. Arreglado con privilegios a nivel de columna.

### 4.2 Riesgos de la migración, por gravedad

| # | Riesgo | Mitigación |
|---|---|---|
| **R1** | **Legal.** Las 4503 imágenes son de terceros. Separar `card_images` con `source_type='legacy'` **no reduce el riesgo por sí solo**: solo habilita el takedown. La tarea 57 dice "evitar depender de imágenes legacy problemáticas" para iOS. | Decisión de producto pendiente (§6) |
| **R2** | **La base no es reproducible desde el repo.** Escribir migrations contra el `.md` en vez de contra el schema real produce DDL que no aplica. | Toda migration de FASE B se escribe contra lo documentado aquí; opcionalmente una migration `0000_baseline` que capture lo preexistente |
| **R3** | **`cards.id` es `integer`/serial y `user_cards.card_id` es `integer`.** Cualquier tabla nueva con FK a cards debe usar `bigint`/`integer`, **no uuid**. Migrar ids rompería 7400 filas de `user_cards`. | FK `references cards(id)` sin tocar el tipo |
| **R4** | **Quitar `cards.image_path` rompe la Android v1 ya instalada** y el bundle web publicado. | Backfill aditivo; `image_path` se conserva y se sincroniza mientras haya clientes v1 |
| **R5** | `cards_full` es el camino de lectura de 3 hooks. Cambiarla es un cambio en producción para todos. | `create or replace view` aditivo (solo columnas nuevas al final), nunca quitar columnas |
| **R6** | **Fuga de moderación.** Si `card_images` es de lectura pública sin filtro de estado, se ven las pending y rejected. | RLS con filtro por `status`, `security_invoker` en las vistas, y política aparte para que el contributor vea **solo su propia** pending |
| **R7** | **Bucket público, sin límite de tamaño ni de mime + upload de usuarios = hosting de imágenes abierto.** | Bucket o prefijo separado para UGC, `allowed_mime_types`, `file_size_limit`, INSERT restringido a un prefijo por `auth.uid()` |
| **R8** | FK de attribution → `auth.users` vs `delete-account`. Sin `on delete set null` el borrado de cuenta falla o cae en cascada sobre imágenes del catálogo. | `on delete set null` + `delete-account` actualizado |
| **R9** | El backfill debe ser **idempotente** (`on conflict do nothing`) para poder correrlo dos veces sin duplicar 4503 filas. | Índice único `(card_id, storage_path)` |
| **R10** | Multi-grupo sobre `albums.artist` texto libre, ya sucio (`Suga` vs `SUGA / Agust D`). | Normalizar **antes** de introducir `groups` |
| **R11** | 4503 filas nuevas en `card_images` + join extra en el camino caliente. `fetchAllPages` ya existe por el cap de 1000 de PostgREST: la nueva vista debe seguir devolviendo **una fila por card**, no una por imagen. | La vista agrega la imagen primaria, no hace fan-out |
| **R12** | `IMAGE_CACHE_VERSION = 'v1'` es el único invalidador de caché en dispositivo (los objetos no llevan `updated_at`). Una imagen comunitaria aprobada **no se verá** en dispositivos que ya cachearon el placeholder. | Los paths UGC incluyen un id único → URL distinta, no requiere bump |

---

## 5. Tablas nuevas propuestas

### 5.1 `card_images` — la pieza central

> **Versión aprobada y APLICADA el 2026-09-28** en
> `supabase/migrations/20260928145804_create_card_images.sql`.
> El archivo es la fuente de verdad; abajo queda el resumen y los dos cambios
> respecto al borrador original de FASE A.

Columnas: `id`, `card_id` (→ `cards.id`, **integer**), `bucket_id`,
`storage_path`, `source_type`, `status`, `is_primary`, `contributed_by`,
`reviewed_by`, `reviewed_at`, `rejection_reason`, `terms_accepted_at`,
`terms_version`, `width`, `height`, `byte_size`, `created_at`.

**Cambio 1 — una primaria por `source_type`, no una por card.**

El borrador de FASE A proponía:

```sql
-- DESCARTADO
create unique index card_images_one_primary
  on public.card_images (card_id) where is_primary and status = 'approved';
```

Lo aprobado:

```sql
create unique index card_images_one_primary_per_source
  on public.card_images (card_id, source_type) where is_primary and status = 'approved';
```

Razón: la decisión D1 define legacy como **fallback** y community como
**prioritaria**, lo que exige que ambas coexistan aprobadas. Con un único índice
por card habría que apagar `is_primary` en la legacy al aprobar la community y
volver a encenderlo al retirarla — dos escrituras correlacionadas, y si la
segunda falla la card se queda sin imagen. Con el índice por `source_type`, la
prioridad se resuelve en la lectura y la legacy reaparece sola.

**Cambio 2 — la unicidad es por objeto, no por `(card_id, storage_path)`.**

```sql
constraint card_images_unique_object unique (bucket_id, storage_path)
```

Un objeto de Storage se registra una sola vez. Es también lo que hace
idempotentes el piloto y el backfill posterior
(`on conflict (bucket_id, storage_path) do nothing`). Se verificó que hoy ningún
`image_path` está compartido por más de una card, así que no se pierde nada.

**Invariantes añadidos** (ver el archivo para el SQL exacto):
`legacy ⇒ approved` · `community ⇒ contributed_by not null` ·
`community ⇒ terms_accepted_at y terms_version not null` ·
`community resuelta ⇒ reviewed_by y reviewed_at not null` ·
`rejected ⇒ rejection_reason not null` ·
`not is_primary or status = 'approved'` (una pending nunca es pública) ·
y el bucket atado al `source_type`.

**Backfill en dos pasos, ambos ejecutados el 2026-09-28.** Primero un piloto de
6 cards de ARIRANG (`supabase/scripts/pilot_arirang_legacy_images.sql`, fuera de
`migrations/`) para validar invariantes y RLS contra datos reales; después el
backfill completo en `20260928183346_backfill_legacy_card_images.sql`: 4497
filas insertadas, 4503 en total, una por card, con `storage_path` idéntico a
`cards.image_path`. Detalle en el documento de decisiones §5.2.

### 5.2 `image_reports`

```sql
create type report_reason as enum
  ('wrong_card','duplicate','copyright','inappropriate','low_quality','other');
create type report_status as enum ('open','resolved_kept','resolved_removed','dismissed');

create table public.image_reports (
  id           bigint generated always as identity primary key,
  card_image_id bigint not null references public.card_images(id) on delete cascade,
  reported_by  uuid   references auth.users(id) on delete set null,
  reason       report_reason not null,
  detail       text,
  status       report_status not null default 'open',
  resolved_by  uuid   references auth.users(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint image_reports_one_open_per_user
    unique (card_image_id, reported_by)
);
```

### 5.3 Fases posteriores (no en FASE B)

- **`groups`** (artista/grupo) + `albums.group_id` — requiere normalizar
  `albums.artist` antes. Fase 11 del roadmap.
- **`contributor_status`** en `user_profiles` (ok / warned / suspended / blocked)
  — tarea 19.
- **`user_profiles.username`** unique — necesario para la attribution (tarea 32).

### 5.4 Recomendación: **no crear `card_submissions`**

El roadmap pide una tabla `card_submissions` aparte (tarea 8). Mi recomendación
es **una sola tabla `card_images` con `status`**, por razones concretas de este
código:

- "Aprobar submission" pasa a ser un `update status` en una fila. Con dos tablas
  hay que copiar la fila **y mover o re-subir el objeto de Storage** — en un
  bucket público, con paths jerárquicos manuales, eso es la parte frágil.
- "Tu imagen en revisión" (tarea 24) y la attribution (32) leen exactamente la
  misma fila. Con dos tablas, `Photocard.tsx` tendría que consultar dos fuentes.
- "Editar metadata antes de aprobar" (tarea 16) es, para el MVP, editar la
  **card existente** — y el admin ya puede hacerlo vía `admin_all_cards`. No
  necesita staging.

Lo que `card_submissions` sí resolvería es el caso "el usuario propone una card
**nueva** que no existe en el catálogo". Eso no es MVP: hoy hay 4503 cards, 0 sin
imagen, y el flujo de aporte arranca **desde una card existente**. Propongo
diferirlo a la fase de multi-grupo, donde sí tiene sentido.

**APROBADO el 2026-09-27** (decisión D2). Se usa una sola tabla `card_images`;
`card_submissions` queda fuera del MVP y se reevalúa en la fase de multi-grupo.

---

## 6. Decisiones — RESUELTAS

Las cinco preguntas de esta sección fueron respondidas el 2026-09-27. Detalle
completo en [`PURPLE_COLLECTOR_V2_MIGRATION.md`](./PURPLE_COLLECTOR_V2_MIGRATION.md) §1.

| Pregunta original | Decisión |
|---|---|
| ¿Legacy se muestra, se oculta o se retira? | **Se conserva intacta**, `legacy + approved`, como fallback. Blur/overlay/watermark son presentación. **No** se crea `legacy_hidden`. |
| ¿`card_submissions` aparte o una sola tabla? | **Una sola tabla** `card_images` con `status`. |
| ¿Bucket UGC nuevo o prefijo en `photocards`? | **Buckets nuevos**, sin mezclar con `photocards`: `photocard-community` (público, solo aprobadas) + `photocard-community-review` (privado, pending/rejected). Aprobado y creado el 2026-09-28. |
| ¿Rama `v2` o seguir en `main`? | Rama **`feat/community-images-v2`** desde `main` @ `9688be0`. |
| ¿Existe el `.md` de referencia? | **No existe.** La fuente es el xlsx. |

Decisión adicional: **iPad y iOS/iPadOS nativo quedan fuera de scope.** Target
actual Android + Web/PWA. Esto suspende la fase 10 del roadmap (5 tareas) y
quita a App Review como forzante del riesgo R1 — pero **R1 sigue vigente**.

---

## 7. FASE B.1 — aplicada el 2026-09-28

`supabase/migrations/20260928145804_create_card_images.sql`, puramente aditiva,
sin cambios en la app:

1. enums `image_source_type` / `image_status`
2. tabla `card_images` con sus 8 constraints de invariante
3. índices: `(card_id)`, único parcial `(card_id, source_type)`, cola de
   moderación por `created_at` donde `pending`, y `(contributed_by)`
4. `enable row level security`
5. cinco policies: lectura pública solo de `approved` · el contributor lee las
   propias en cualquier estado · el contributor inserta solo
   `community/pending/suyas/no primarias/con términos` · el contributor borra
   las propias mientras sigan `pending` · admin `ALL` vía `is_admin()`
6. grants para `anon` (solo select) y `authenticated`
7. `comment on` sobre la tabla y las dos columnas menos obvias

Lo que **no** hace, a propósito:

- no toca `cards.image_path`
- no toca `cards_full` (eso es FASE E, y depende de **SR-1**)
- no toca `user_cards` ni ningún id
- no toca Storage, ni sus policies, ni crea buckets
- no borra ni mueve ninguna imagen
- **no hace backfill** — eso lo decide el piloto
- no cambia nada en la app: la v1 sigue leyendo `cards.image_path`
- no incluye ninguna corrección de seguridad ni de bugs (§6 y §7 del documento
  de decisiones, commits separados)

Reversible con `drop table card_images;` + `drop type image_status, image_source_type;`.

**Verificación tras aplicarla** (sólo lecturas): 0 filas en `card_images` y
4503 en `cards.image_path`. Ambas confirmadas antes de correr el piloto.

**Estado real al 2026-09-28**, ya ejecutado:
**B.2** piloto ARIRANG — **hecho**, 6 filas ·
**C.1** buckets y policies de Storage — **hecho**, 3 buckets ·
**SR-1** `cards_full` a `security_invoker` — **hecho**.

**Pendiente**: **B.3** decidir el backfill de las 4503 · **D** upload ·
**E** camino de lectura y regla de display · **F** UI legacy ·
**G** moderación y reportes · **SR-2** a **SR-7** y BUG-1 a BUG-5.

<!-- El bloque de abajo es la secuencia original de FASE A; se conserva como
     referencia del plan tal como se propuso. -->
**Plan original**: **B.2** piloto ARIRANG (6 cards) · **B.3** validar y decidir
el backfill de las 4503 · **SR-1** `cards_full` a `security_invoker` ·
**C** buckets y policies de
Storage · **D** upload · **E** camino de lectura y regla de display ·
**F** UI legacy · **G** moderación y reportes.
