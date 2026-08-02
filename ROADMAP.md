# k-collect — Roadmap

## Regla de oro para lanzar
> Si un usuario nuevo puede entrar, ver las cards, marcar las que tiene y saber qué le falta → **es lanzable.**
> Todo lo demás es post-launch.

---

## MVP — Lo que necesita estar listo para lanzar

### Datos
- [ ] Terminar las 221 photocards Arirang
- [ ] Verificar que todas tienen imagen, miembro, rareza y álbum correctos

### Funcionalidad core
- [ ] Login con Google (✓ hecho)
- [ ] Ver colección completa
- [ ] Marcar cards como `have`, `want`, `otw`, `missing`, `not_collecting`
- [ ] Wishlist funcional
- [ ] Perfil básico: nombre, foto, stats simples

### Calidad mínima
- [ ] No crashea en los flujos principales
- [ ] Funciona en iOS y Android
- [ ] Estados de loading cuando la red es lenta

### Distribución
- [ ] TestFlight (iOS) — probar con usuarios reales antes del lanzamiento público
- [ ] Play Store internal testing (Android)
- [ ] Lanzamiento público en App Store / Play Store

---

## Post-launch — Alta prioridad (según feedback)

- [ ] Búsqueda y filtros en la colección (por miembro, rareza, álbum, estado)
- [ ] Estadísticas por álbum (% completado, cuántas faltan)
- [ ] Agregar más álbumes (beyond Arirang)
- [ ] Notificaciones cuando alguien tiene una card que necesitas

## Post-launch — Media prioridad

- [ ] Trading / intercambio entre usuarios
- [ ] Fotos propias de tus photocards físicas
- [ ] Modo offline básico

## Post-launch — Baja prioridad / experimental

- [ ] Rankings / leaderboards de coleccionistas
- [ ] Scan de photocard con cámara
- [ ] Comunidad / foros

---

## Stack actual
- **Framework:** Expo + Expo Router
- **Auth:** Supabase Auth (Google OAuth) — NO agregar Clerk, ya está cubierto
- **DB:** Supabase
- **UI:** React Native custom (GalaxyBackground, GlassCard, NeonBar, Photocard)
