# QA Checklist

Probar sobre los binarios reales, no en dev client — salvo el bloque de V2, que
**exige** un build nuevo (ver abajo).

---

## 🟣 Purple Collector V2 — catálogo comunitario

Bloque nuevo. Nada de esto existe en la Android v1 publicada.

> ⚠️ **Requiere un build nativo nuevo.** `expo-image-picker` y
> `expo-image-manipulator` son módulos nativos: en un binario anterior a su
> instalación, tocar "Aportar imagen" muestra *"esta versión de la app todavía no
> puede elegir fotos"* en vez de abrir la galería. En **web funciona sin rebuild**.

### Estado de las banderas (`lib/constants.ts`)

- [ ] `CONTRIBUTIONS_ENABLED = true` — el botón de aportar está visible
- [ ] `LEGACY_TREATMENT_ENABLED = true` — las legacy salen borrosas y marcadas
- [ ] `CARD_SUBMISSIONS_ENABLED = true` — se puede proponer una card que falta
- [ ] `PREMIUM_ENABLED = false` y `BIAS_ENABLED = false` (sin cambios)

### Tratamiento visual de las legacy

- [ ] Una card legacy se ve **borrosa pero reconocible**: se distingue el miembro
      y la pose. Si no se identifica qué card es, el blur está demasiado alto
- [ ] Lleva la marca **"Imagen Legacy"** centrada, legible sobre fotos claras y oscuras
- [ ] Una card con imagen **aportada y aprobada** se ve **nítida y sin marca** —
      el contraste entre una y otra tiene que saltar a la vista
- [ ] Las legacy **no adquiridas** no quedan negras: se apilan tres capas
      (opacidad 0.65 + velo lila + velo legacy) y hay que mirar que siga leyéndose
- [ ] En el detalle de la card, la miniatura legacy también sale borrosa

### Aportar una imagen

- [ ] Detalle de una card → **"Aportar imagen"** → aparece el texto de derechos
- [ ] Cancelar en ese punto no envía nada
- [ ] Aceptar → pide permiso de fotos (con el texto de Purple Collector, no el genérico)
- [ ] Denegar el permiso → mensaje claro, no un crash
- [ ] Elegir una foto → *"Enviada a revisión"*
- [ ] Volver a abrir esa card → dice **"Tu imagen está en revisión"**, sin botón de aportar
- [ ] La card **sigue mostrando la legacy** mientras el aporte está pendiente
- [ ] **Encuadre**: la imagen enviada queda en **2:3**, sea cual sea la foto original
      — en Android eliges el recorte, en iOS y web se recorta al centro
- [ ] Foto de móvil grande (>5 MB) → **se acepta**: el límite se mide sobre la
      imagen ya recortada y reescalada, no sobre la original
- [ ] Sin conexión al enviar → error legible, no se queda colgado

### Aportar una card que NO está en el catálogo

> No requiere build nativo nuevo: usa los mismos módulos que el aporte de
> imagen, que ya están en el binario.

- [ ] Perfil → **Aportar una card que falta** → abre el formulario
- [ ] Al pie de un álbum → misma entrada → llega con **tipo, era y álbum ya
      rellenos** (viene por `?albumId=`)
- [ ] **Cascada**: elegir un tipo llena las eras; cambiar el tipo **vacía** era,
      álbum, versión y card set
- [ ] Un álbum **sin versiones** deja el selector de versión vacío y bloqueado,
      no muestra las de otro álbum
- [ ] Los **card sets** que aparecen son sólo los del álbum elegido, y se
      reducen al elegir versión o categoría
- [ ] El buscador aparece en álbumes (159) y en sets, pero **no** en tipos (6)
- [ ] **Enviar está apagado** hasta tener foto + álbum + categoría + miembro +
      nombre (≥2 caracteres)
- [ ] Elegir foto → abre el **cropper 2:3**; la miniatura queda encuadrada
- [ ] Enviar → pide confirmación de derechos → *"Propuesta enviada"*
- [ ] Enviar **la misma card otra vez** → *"Ya enviaste esta misma card"*, no un
      error de base
- [ ] Sin conexión al enviar → error legible, y **no** queda una imagen huérfana
      en el bucket

### Handle y atribución

- [ ] Perfil → **Handle** → ponerse uno: 3-20 caracteres, minúsculas, números y `_`
- [ ] Formato inválido (`ab`, `Pau`, `pau pau`) → aviso, no se guarda
- [ ] Un handle reservado (`admin`, `soporte`…) → *"está reservado"*
- [ ] Un handle que ya tiene otra cuenta → *"ya está en uso"*
- [ ] Tras ponerlo, las cards que ya aportaste muestran **@handle** sin volver a
      subir nada (lo propaga un trigger)
- [ ] Cambiarlo → el `@` de la grilla cambia también
- [ ] Sin handle y con aportes: en **Aportes** sale *"Tus aportes salen sin
      firmar"*, y toca llevar directo al editor
- [ ] Con handle puesto, ese aviso desaparece al volver a la tab

### Aportes (tab) y refresco

- [ ] Tab **Aportes**: el botón de aportar, Moderación (solo admin, con el
      contador) y la lista de lo que has aportado
- [ ] Una propuesta aprobada aparece **una sola vez**, como *Card nueva*, y con
      la foto de la card que creó
- [ ] Un rechazo muestra el motivo **en castellano**, no el token (`wrong_card`)
- [ ] **Al volver de moderar**, el álbum y la lista de aportes se actualizan
      solos, sin reabrir la app
- [ ] Dejar la app quieta en Colección **no genera tráfico**: antes refrescaba
      en bucle (~3,5 consultas/segundo)

### Aviso de duplicado en el formulario

- [ ] Elegir álbum + categoría + miembro de un hueco que **ya tiene card** →
      aparece el aviso en ámbar con esa card y su foto
- [ ] Dice **con foto** / **sin foto** según corresponda
- [ ] **Usar la mía acá** con una foto ya elegida → la manda como aportación de
      imagen a esa card, sin repetir el encuadre
- [ ] **Usar la mía acá** sin foto elegida → avisa de que falta la foto
- [ ] El aviso **no bloquea**: se puede seguir y enviar la card nueva igual
      (hay 610 combinaciones con duplicados legítimos)
- [ ] Sin versión elegida, el aviso busca en **todas** las versiones del álbum

### Moderación de propuestas (solo admin)

- [ ] Pestaña **Cards** en Moderación, con el contador
- [ ] La ficha muestra la foto, el miembro, el `@handle` y **la cadena completa**
      (tipo › era › álbum › versión › categoría)
- [ ] Las notas del contributor se ven entre comillas
- [ ] **Aprobar** pide confirmación (crea una card visible para todo el mundo)
- [ ] Tras aprobar: la card **aparece en el álbum** que decía, en su categoría,
      con la imagen aportada y **sin blur** (es community, no legacy)
- [ ] El `code` de la card nueva sigue la convención `ÁLBUM-MIEMBRO-CATEGORÍA`
- [ ] Si el card set traía retailer/país/draw type, la card nueva los tiene
- [ ] La atribución `@handle` es de **quien la propuso**, no de quien aprobó
- [ ] **Rechazar** pide motivo (5 opciones) y la propuesta desaparece de la
      bandeja sin crear nada
- [ ] Aprobar dos veces la misma propuesta → *"already approved"*, **no** crea
      una segunda card

### Moderación (solo admin)

- [ ] Con cuenta **no admin**: la entrada *Moderación* **no** aparece en Perfil
- [ ] Con cuenta admin: aparece debajo de la tarjeta de *Cuenta*
- [ ] ⚠️ Tras cambiar el rol hay que **cerrar y abrir sesión**: el perfil se lee
      una sola vez al montar
- [ ] Pestaña **Pendientes**: muestra la imagen aportada **al lado** de la que se
      ve hoy, para poder comparar
- [ ] **Aprobar** → la card pasa a mostrar la imagen nueva en el álbum
- [ ] **Rechazar** → pide motivo; la card vuelve a la legacy
- [ ] Al contributor, esa card ya no le dice "en revisión"

### Reportes

- [ ] Detalle de una card → **"Reportar esta imagen"** → 4 motivos
- [ ] Tras reportar, esa card dice **"Ya reportaste esta imagen"** y no deja repetir
- [ ] Pestaña **Reportes** (admin): motivo, card, origen de la imagen y la foto
- [ ] Si varias personas reportan la misma imagen, aparece el contador **×N**
- [ ] **Mantener** → el reporte se cierra y la imagen **sigue ahí**
- [ ] **Retirar imagen** → pide confirmación

### Retirar una imagen (takedown)

> ⚠️ **Irreversible y sin respaldo.** Borra el objeto de Storage. Usar una card
> que no importe perder.

- [ ] Retirar una **legacy** → la card pasa a **placeholder** con la inicial del miembro
- [ ] No vuelve al recargar ni al reabrir la app
- [ ] Retirar una **community aprobada** → la card **vuelve a mostrar la legacy**
      (el fallback), no queda sin imagen
- [ ] El reporte queda cerrado y desaparece de la bandeja

### Compatibilidad con la v1 publicada

- [ ] Abrir la **Android v1 ya publicada** contra la misma base: el catálogo se ve
      igual que siempre, sin borrosos ni marcas
- [ ] Una card cuya legacy se retiró: en v1 tampoco se ve (es el único caso en que
      V2 toca `cards.image_path`, y es a propósito)

---

## 🟡 Regresión general

### Álbum
- [ ] Cambiar estado de una card (Tengo / Quiero / En camino / No coleccionando)
- [ ] Contador de duplicados
- [ ] Búsqueda
- [ ] Filtros combinados (categoría + estado + miembro)
- [ ] Animación de celebración al completar un álbum
- [ ] **Orden de la grilla**: agrupada por categoría, y dentro por draw type y país
      — lo trae la vista ahora, no el cliente

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
- [ ] Cambiar idioma ES/EN — **incluidos los textos nuevos de V2**
- [ ] Disclaimer legal visible
- [ ] Versión `vX.X.X (build)` al fondo

### Login / onboarding
- [ ] Cerrar sesión → entrar con Google → no se queda pegado en loading
- [ ] Igual con Apple Sign In
- [ ] Usuario nuevo: onboarding aparece una sola vez
- [ ] Modo avión justo al abrir → cae a login en vez de colgarse

### Push notifications
- [ ] App cerrada: notificación `new_album` → abre en el álbum correcto
- [ ] App en background: mismo test
- [ ] App en primer plano: banner y navegación
- [ ] Repetir en iOS **y** Android

### Notificaciones
- [ ] Activar/desactivar permisos desde el sistema no rompe nada al reabrir

---

## 🟢 Casos borde

- [ ] Card sin imagen o `is_blurred` → placeholder con inicial, no espacio roto
- [ ] Álbum con 0% coleccionado vs 100% completado
- [ ] Rotar el celular / background → foreground en medio de cualquier flujo
- [ ] Borrar cuenta (flujo Apple 5.1.1) con cuenta desechable → borra todo
- [ ] **Borrar la cuenta de alguien que aportó una imagen aprobada**: la imagen
      sigue en el catálogo y la attribution queda en null, no se cae nada
- [ ] **Portadas de álbum**: 76 de 159 tienen portada; el resto debe mostrar su
      placeholder, no un hueco roto

---

## Notas de entorno

- La base guarda **UTC**; git y la app muestran hora local (Chile, UTC−3). Tres
  horas de diferencia al comparar timestamps.
- Tras tocar hooks o tipos, **Fast Refresh no siempre basta**. Reiniciar:
  `xcrun simctl terminate booted com.paupaipai.purplecollector && xcrun simctl launch booted com.paupaipai.purplecollector`
- Para saltar directo a un álbum: `xcrun simctl openurl booted "purplecollector://album/3"`
- Cambiar `is_admin` solo se puede desde el **dashboard de Supabase**: la app no
  tiene permiso de escribir esa columna (SR-8).
