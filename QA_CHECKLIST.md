# QA Checklist — pre-release 1.0.1

Probar sobre los binarios reales (TestFlight `1.0.1 (9)` y el `.aab` Android `1.0.1 (6)`), no en dev client.

## 🔴 Prioridad alta — fixes de esta sesión

### Push notifications
- [ ] App **cerrada del todo** (killed): notificación `kind: 'new_album'` + `albumId` real → tocarla → abre directo en el álbum correcto, sin quedarse pegada en el logo de carga
- [ ] App en **background** (minimizada): mismo test
- [ ] App **abierta en primer plano**: se muestra el banner y al tocarlo navega igual
- [ ] Repetir en iOS **y** Android

### Login / onboarding
- [ ] Cerrar sesión → entrar con Google → no se queda pegado en loading
- [ ] Igual con Apple Sign In
- [ ] Usuario nuevo: onboarding (selección de bias) aparece una sola vez
- [ ] Activar modo avión justo al abrir la app (fuerza timeout de red) → cae a login en vez de colgarse eterno

### Filtro "Grupo"
- [ ] Álbum ARIRANG (u otro con cards grupales): filtrar Miembro = "Grupo" → aparecen las cards de BTS/grupo
- [ ] Mismo filtro en Colección y Wishlist (control, ya andaban bien)

### PROMO_MODE apagado
- [ ] Imágenes de photocards, portadas de álbum, avatares y email real se ven normales — nada de siluetas ni "@paupau.collector"

### Contador por miembro en Profile (marca not_collecting)
- [ ] Marca una card como "No coleccionando" → entra a Profile (o vuelve a esa pantalla) → el denominador (`owned/total`) de ese miembro baja en 1, ya no se queda fijo
- [ ] Repite con una card grupal (`is_group: true`) → el contador "Group" también baja
- [ ] Revierte el estado (quítale "No coleccionando") → el contador vuelve a subir

### Contadores de álbum/tipo estables (fetchAllRows sin .order())
- [ ] Entra a un tipo de colección con muchos álbumes (ej. "Solos") → anota el total ("X/Y photocards")
- [ ] Sal y vuelve a entrar varias veces (o espera un refetch en background) → el total **no debe cambiar** entre visitas
- [ ] Revisa un par de álbumes individuales (ej. Happy, Echo de Jin) → sus totales tampoco deben fluctuar

### Versión visible en Profile
- [ ] Al fondo de Profile aparece `vX.X.X (build)` — confirma que en iOS coincide con el build de TestFlight y en Android con el `versionCode` subido
- ⚠️ Este footer es nuevo (requiere `expo-application`, recién agregado) — **no va a aparecer en los binarios ya generados** (TestFlight `9` / `.aab` `6`), solo en el próximo build que se genere después de este cambio

## 🟡 Regresión general

### Álbum
- [ ] Cambiar estado de una card (Tengo / Quiero / En camino / No coleccionando)
- [ ] Contador de duplicados
- [ ] Búsqueda
- [ ] Filtros combinados (categoría + estado + miembro)
- [ ] Animación de celebración al completar un álbum

### Colección
- [ ] Filtro por álbum + miembro
- [ ] Buscador

### Wishlist
- [ ] Cards en "Quiero" / "En camino"
- [ ] Popup de acción rápida, cambiar estado desde ahí

### Perfil
- [ ] Stats generales
- [ ] Breakdown por rareza
- [ ] Member stats
- [ ] Cambiar idioma ES/EN
- [ ] Disclaimer legal visible

### Notificaciones
- [ ] Activar/desactivar permisos desde el sistema no rompe nada al reabrir la app

## 🟢 Casos borde

- [ ] Card sin imagen o `is_blurred` → placeholder con inicial, no espacio roto
- [ ] Álbum con 0% coleccionado vs 100% completado
- [ ] Rotar el celular / cambiar de app y volver (background → foreground) en medio de cualquier flujo
- [ ] Borrar cuenta (flujo Apple 5.1.1) con cuenta de prueba desechable → borra todo, no deja rastro
