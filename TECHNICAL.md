# k-collect — Resumen Técnico

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Expo ~54 + expo-router v6 |
| Auth / DB | Supabase (Google OAuth) |
| Estado premium | AsyncStorage (`@kcollect/premium`) |
| i18n | ES/EN — `lib/I18nContext.tsx` + `lib/i18n.ts` |
| Animaciones | react-native-reanimated + Animated API |

**Backend:** Supabase en `qlswdqqjtqepxfqagooi.supabase.co`
- `cards_full` — vista principal de photocards
- `user_cards` — status por usuario (have, want, otw, missing, not_collecting, maybe)

---

## Pantallas

| Pantalla | Ruta | Descripción |
|---|---|---|
| Home | `/(tabs)/` | Lista de álbumes con progreso y barra neon |
| Collection | `/(tabs)/collection` | Grid de photocards agrupadas por álbum |
| Wishlist | `/(tabs)/wishlist` | Lista de cards want / otw / missing |
| Profile | `/(tabs)/profile` | Stats del usuario + configuración de cuenta |
| Album Detail | `/album/[id]` | Cards de un álbum con modal de status |
| Paywall | `/paywall` | Modal con 3 planes en CLP |
| Login | `/auth/` | Login con Google via Supabase |

---

## Features FREE vs PREMIUM

### FREE

- Ver todos los álbumes con barra de progreso individual
- Entrar al detalle de cualquier álbum
- Filtrar por **categoría** dentro de un álbum
- Marcar cards con status: `have` `want` `otw` `missing` `not_collecting` `maybe`
- Contador de duplicados por card (cuando status = `have`)
- Colección completa con filtro por **álbum**
- Wishlist con filtros por status y miembro
- Perfil: stats básicos (owned, wishlist, % completado, sets completos)
- Barra de progreso general
- Modal de celebración al completar un álbum
- Cambio de idioma ES / EN

### PREMIUM 💎

- **Colección:** filtro por miembro (RM, Jin, Suga, J-Hope, Jimin, V, Jungkook, Group)
- **Colección:** stats extendidos (miembros únicos, Ultra Rare + Limited count)
- **Colección:** desglose por rareza (Common / Rare / Ultra Rare / Limited)
- **Album detail:** filtro por miembro
- **Perfil:** desglose por rareza
- **Perfil:** colección por miembro (cuántas cards de cada uno)
- **Perfil:** progreso por álbum (% completado con barra individual)
- Badge "Premium" visible en el perfil

---

## Paywall

Tres planes en CLP. El pago actualmente **no está conectado** — `handlePurchase()` llama a `unlock()` directamente en AsyncStorage (modo test).

| Plan | Precio | Badge |
|---|---|---|
| Lifetime | $14.990 CLP | ⭐ Recomendado (destacado) |
| Annual | $22.990 CLP | ¡Ahorra 36%! |
| Monthly | $2.990 CLP | — |

**TODO:** Conectar RevenueCat / Expo IAP. Hay un botón "Revertir (modo test)" visible en la pantalla cuando ya eres premium.

---

## Componentes clave

| Componente | Descripción |
|---|---|
| `GalaxyBackground` | Fondo animado de estrellas (presente en todas las pantallas) |
| `GlassCard` | Contenedor con efecto glassmorphism |
| `NeonBar` | Barra de progreso con glow neon |
| `Photocard` | Card individual con imagen, status indicator y tap handler |
| `PremiumLock` | Gate component — reemplaza secciones con CTA al paywall |
| `OnboardingScreen` | Selección de bias (se muestra una vez post-login) |
| `LoginScreen` | Pantalla de login con Google |

---

## Hooks

| Hook | Descripción |
|---|---|
| `useAuth` | Usuario, sesión, signOut, deleteAccount |
| `useAlbums` | Lista de álbumes con stats de owned/total por usuario |
| `useCards` / `useAlbumCards` | Cards de un álbum con status del usuario |
| `useCollection` | Todas las cards con status `have` del usuario |
| `useWishlist` | Cards con status `want`, `otw`, `missing` |

---

## Contextos globales

| Contexto | Archivo | Clave AsyncStorage |
|---|---|---|
| Premium | `lib/PremiumContext.tsx` | `@kcollect/premium` |
| Idioma | `lib/I18nContext.tsx` | `@kcollect/lang` |
| Onboarding | (lógica en `app/_layout.tsx`) | `@kcollect/onboarded`, `@kcollect/bias` |

---

## Estado actual para lanzar

### Listo
- [x] Login con Google
- [x] Ver y navegar álbumes
- [x] Marcar / desmarcar cards
- [x] Colección, Wishlist y Perfil funcionales
- [x] Sistema premium con PremiumLock y Paywall
- [x] Onboarding con selección de bias
- [x] i18n ES/EN
- [x] Celebración al completar álbum

### Pendiente
- [ ] Conectar RevenueCat / Expo IAP al paywall
- [ ] Completar las 221 photocards Arirang en Supabase
- [ ] Verificar imágenes, miembro, rareza y álbum de cada card
- [ ] TestFlight (iOS) — testing interno
- [ ] Play Store internal testing (Android)
