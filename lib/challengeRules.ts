/**
 * Reglas del Community Challenge.
 *
 * Versiones (challenges.rules_version es texto: '1', '2', ...):
 *   '1'  21-nov-2026  1 punto por photocard con frente y reverso de la misma persona.
 *   '2'  26-nov-2026  0,5 por lado; reemplazo por calidad; la calidad es prioritaria.
 *
 * Si cambian, subir challenges.rules_version en la base y CONTRIBUTION_TERMS_VERSION
 * (lib/constants.ts): cada aporte guarda en card_images.terms_version que version
 * acepto quien lo envio, asi queda el registro de las versiones anteriores.
 */

type Section = { title: string; items: string[] };

export const CHALLENGE_RULES_VERSION = '2';

export const CHALLENGE_RULES: Record<'es' | 'en', Section[]> = {
  es: [
    {
      title: '1. Premios y duración',
      items: [
        'Primer lugar: 12 meses de Purple Collector Premium. Segundo lugar: 6 meses. Tercer lugar: 3 meses.',
        'El concurso comenzó el 21 de noviembre de 2026 y no tiene fecha fija de término: se cierra cuando el catálogo inicial esté completo.',
      ],
    },
    {
      title: '2. Requisitos para participar',
      items: [
        'Tener una cuenta en Purple Collector con nombre de usuario.',
        'Aportar fotos desde la app (Android o web) usando la opción "Aportar" de cada photocard.',
        'Aceptar las condiciones de uso de imágenes al enviar cada aporte.',
      ],
    },
    {
      title: '3. Qué aportes suman puntos',
      items: [
        'Cada lado aprobado suma 0,5 puntos: frente = 0,5, reverso = 0,5. Frente y reverso = 1 punto.',
        'La photocard debe ser parte del catálogo que existía al comenzar el concurso.',
        'El aporte debe enviarse mientras el concurso está recibiendo aportes.',
        'No es necesario aportar los dos lados: dos personas distintas pueden sumar 0,5 cada una por completar la misma photocard.',
        'Cada lado tiene un solo dueño: sus 0,5 puntos son de quien aportó la imagen vigente, la que se muestra en el catálogo para ese lado.',
        'Una photocard nunca da más de 1 punto en total (0,5 por el frente + 0,5 por el reverso), aunque tenga varias imágenes aprobadas.',
      ],
    },
    {
      title: '4. Reemplazo por imágenes de mejor calidad',
      items: [
        'Puedes aportar una foto de mejor calidad para un lado que ya tiene imagen de la comunidad.',
        'Si se aprueba, pasa a ser la imagen vigente, se acredita con tu @usuario y los 0,5 puntos de ese lado pasan a ti; quien los tenía los pierde.',
        'Si tu foto es de calidad igual o inferior a la vigente, se rechaza y no suma. Ante calidad equivalente se mantiene la que se envió primero.',
        'Si mejoras tu propia imagen, conservas tus 0,5 puntos, pero no sumas más.',
        'Subir primero una imagen no garantiza conservar sus puntos.',
        'Si el reemplazo se envió fuera del plazo del concurso, igual puede pasar a ser la imagen vigente, pero no suma puntos para nadie.',
        'Las imágenes reemplazadas se conservan en tu historial de aportes, aunque ya no sumen.',
      ],
    },
    {
      title: '5. Qué aportes no cuentan',
      items: [
        'Imágenes rechazadas o que aún estén pendientes de revisión.',
        'Imágenes duplicadas que no mejoran la que ya se muestra: se rechazan y no suman.',
        'Imágenes reemplazadas por otra de mejor calidad: sus 0,5 puntos pasan a la nueva.',
        'Imágenes retiradas o invalidadas después de su aprobación: sus puntos se descuentan y el ranking se recalcula.',
        'Photocards o álbumes agregados al catálogo después del inicio del concurso.',
        'Aportes enviados después del cierre del concurso.',
      ],
    },
    {
      title: '6. Desempate',
      items: [
        'Si dos o más participantes terminan con los mismos puntos, gana quien alcanzó ese puntaje primero, según la fecha de envío registrada del último lado que hoy le suma puntos.',
        'Si esa fecha también coincide, se ordena por un identificador interno fijo, para que el resultado sea siempre el mismo.',
      ],
    },
    {
      title: '7. Fechas y cierre',
      items: [
        'El concurso se cierra cuando todas las photocards del catálogo inicial tengan un aporte aprobado, o antes si Purple Collector lo anuncia en Novedades.',
        'Al cerrar, se dejan de recibir aportes para el concurso y se revisan los que llegaron dentro del plazo.',
        'Las ganadoras se publican solo cuando no queden aportes del período pendientes de revisión.',
        'Una vez publicados los resultados, el ranking definitivo ya no cambia.',
      ],
    },
    {
      title: '8. Revisión de las imágenes',
      items: [
        'La calidad es prioritaria: una imagen de baja calidad no se aprueba aunque todavía no haya imagen de la comunidad para esa photocard.',
        'Cada lado se revisa por separado. Para aprobarse, la foto debe: corresponder a la photocard y al lado indicados; mostrar la photocard completa; verse nítida, con buena resolución y sin desenfoque; no tener reflejos ni sombras que dificulten verla; estar bien orientada y recortada; tener colores fieles; no tener marcas de agua de terceros, y respetar las condiciones de uso.',
        'El ranking es provisional hasta que el concurso termine: se actualiza cada vez que se aprueba, reemplaza o retira una imagen.',
        'Purple Collector puede invalidar un aporte aprobado por error, fraude o incumplimiento: sus puntos se descuentan y, si corresponde, se recupera una imagen anterior válida.',
        'Cada decisión de revisión queda registrada con su motivo.',
      ],
    },
    {
      title: '9. Condiciones de los premios Premium',
      items: [
        'Los premios se activarán cuando Purple Collector Premium esté disponible oficialmente. No hay fecha de lanzamiento definida.',
        'La duración del premio empieza a contar desde su activación, no desde el fin del concurso.',
        'Los premios son personales, no se pueden transferir ni cambiar por dinero.',
      ],
    },
    {
      title: '10. Uso autorizado de imágenes y créditos',
      items: [
        'Al aportar, autorizas a Purple Collector a mostrar la imagen en el catálogo de la app.',
        'Cada imagen aprobada se acredita con tu @usuario.',
      ],
    },
    {
      title: '11. Privacidad y nombres de usuario',
      items: [
        'El ranking es público para quienes usan la app y muestra solo tu @usuario y tus puntos.',
        'Nunca se publica tu correo ni tu nombre real. Te recomendamos que tu @usuario no sea tu nombre real.',
        'Puedes cambiar tu @usuario desde tu perfil en cualquier momento.',
      ],
    },
  ],
  en: [
    {
      title: '1. Prizes and duration',
      items: [
        'First place: 12 months of Purple Collector Premium. Second place: 6 months. Third place: 3 months.',
        'The challenge started on November 21, 2026 and has no fixed end date: it closes when the initial catalog is complete.',
      ],
    },
    {
      title: '2. How to take part',
      items: [
        'Have a Purple Collector account with a username.',
        'Contribute photos from the app (Android or web) with the "Contribute" option on each photocard.',
        'Accept the image usage terms when sending each contribution.',
      ],
    },
    {
      title: '3. What counts',
      items: [
        'Each approved side is worth 0.5 points: front = 0.5, back = 0.5. Front and back = 1 point.',
        'The photocard must be part of the catalog that existed when the challenge started.',
        'The contribution must be sent while the challenge is accepting contributions.',
        'You do not need to send both sides: two different people can earn 0.5 each for completing the same photocard.',
        'Each side has a single owner: its 0.5 points belong to whoever contributed the current image, the one shown in the catalog for that side.',
        'A photocard never gives more than 1 point in total (0.5 for the front + 0.5 for the back), even if it has several approved images.',
      ],
    },
    {
      title: '4. Better-quality replacements',
      items: [
        'You can send a better-quality photo for a side that already has a community image.',
        "If it is approved, it becomes the current image, is credited to your @username, and that side's 0.5 points move to you; whoever had them loses them.",
        'If your photo is the same quality or worse than the current one, it is rejected and does not score. When quality is equivalent, the one sent first stays.',
        'If you improve your own image, you keep your 0.5 points but do not earn more.',
        'Being the first to upload an image does not guarantee keeping its points.',
        'If a replacement was sent outside the challenge period, it can still become the current image, but it scores for nobody.',
        'Replaced images stay in your contribution history, even though they no longer score.',
      ],
    },
    {
      title: "5. What doesn't count",
      items: [
        'Rejected images, or images still pending review.',
        'Duplicate images that do not improve the one already shown: they are rejected and do not score.',
        'Images replaced by a better-quality one: their 0.5 points go to the new one.',
        'Images removed or invalidated after approval: their points are subtracted and the ranking recalculated.',
        'Photocards or albums added to the catalog after the challenge started.',
        'Contributions sent after the close.',
      ],
    },
    {
      title: '6. Tie-break',
      items: [
        'If two or more participants end with the same points, the one who reached that score first wins, according to the recorded send date of the last side that currently scores for them.',
        'If that date is also the same, a fixed internal identifier decides, so the result is always the same.',
      ],
    },
    {
      title: '7. Dates and closing',
      items: [
        'The challenge closes when every photocard in the initial catalog has an approved contribution, or earlier if Purple Collector announces it in News.',
        'Once closed, no new contributions count, and the ones sent in time are reviewed.',
        'Winners are published only when no contributions from the period are left pending.',
        'Once results are published, the final ranking no longer changes.',
      ],
    },
    {
      title: '8. Image review',
      items: [
        'Quality comes first: a low-quality image is not approved even if the photocard has no community image yet.',
        'Each side is reviewed separately. To be approved, the photo must: match the photocard and the side; show the whole photocard; be sharp, with good resolution and no blur; have no reflections or shadows that make it hard to see; be correctly oriented and cropped; have faithful colors; have no third-party watermarks; and follow the usage terms.',
        'The ranking is provisional until the challenge ends: it updates every time an image is approved, replaced or removed.',
        'Purple Collector may invalidate an approved contribution because of an error, fraud or a rule breach: its points are subtracted and, when appropriate, a previous valid image is restored.',
        'Every review decision is recorded with its reason.',
      ],
    },
    {
      title: '9. Premium prize terms',
      items: [
        'Prizes will be activated when Purple Collector Premium is officially available. There is no launch date yet.',
        'The prize duration starts counting from activation, not from the end of the challenge.',
        'Prizes are personal and cannot be transferred or exchanged for money.',
      ],
    },
    {
      title: '10. Image usage and credits',
      items: [
        'Only upload photos you took or have the right to share.',
        'By contributing, you allow Purple Collector to show the image in the app catalog.',
        'Every approved image is credited with your @username.',
      ],
    },
    {
      title: '11. Privacy and usernames',
      items: [
        'The ranking is public to app users and shows only your @username and your points.',
        'Your email and real name are never published. We recommend your @username not be your real name.',
        'You can change your @username from your profile at any time.',
      ],
    },
  ],
};
