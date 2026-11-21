/**
 * Reglas del Community Challenge (rules_version '1').
 *
 * Si cambian, subir challenges.rules_version en la base y anotarlo aqui: las
 * reglas que valen para un concurso son las que estaban publicadas cuando se
 * envio cada aporte.
 */

type Section = { title: string; items: string[] };

export const CHALLENGE_RULES_VERSION = '1';

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
        '1 photocard aprobada = 1 punto.',
        'La photocard debe ser parte del catálogo que existía al comenzar el concurso.',
        'Debes enviar el frente y el reverso de la photocard, y ambos deben ser aprobados.',
        'El aporte debe enviarse mientras el concurso está recibiendo aportes.',
        'Si varias personas envían la misma photocard, el punto es para el primer aporte completo (frente y reverso) enviado que termine siendo aprobado.',
      ],
    },
    {
      title: '4. Qué aportes no cuentan',
      items: [
        'Imágenes rechazadas o que aún estén pendientes de revisión.',
        'Aportes incompletos (solo frente o solo reverso).',
        'Photocards que ya tenían un aporte válido anterior (duplicados) y reenvíos de la misma photocard.',
        'Imágenes retiradas o invalidadas después de su aprobación: su punto se descuenta y el ranking se recalcula.',
        'Photocards o álbumes agregados al catálogo después del cierre del concurso.',
        'Aportes enviados después del cierre del concurso.',
      ],
    },
    {
      title: '5. Desempate',
      items: [
        'Si dos o más participantes terminan con los mismos puntos, gana quien alcanzó ese puntaje primero, según la fecha de envío registrada de su último aporte puntuado.',
      ],
    },
    {
      title: '6. Fechas y cierre',
      items: [
        'El concurso se cierra cuando todas las photocards del catálogo inicial tengan un aporte aprobado, o antes si Purple Collector lo anuncia en Novedades.',
        'Al cerrar, se dejan de recibir aportes para el concurso y se revisan los que llegaron dentro del plazo.',
        'Las ganadoras se publican solo cuando no queden aportes del período pendientes de revisión.',
      ],
    },
    {
      title: '7. Revisión de las imágenes',
      items: [
        'Cada lado se revisa por separado. Se aprueban fotos que correspondan a la photocard indicada, se vean completas y nítidas y respeten las condiciones de uso.',
        'El ranking es provisional hasta que el concurso termine y se revisen todos los aportes.',
        'Purple Collector puede invalidar un aporte aprobado si luego se detecta que no cumple las reglas.',
      ],
    },
    {
      title: '8. Condiciones de los premios Premium',
      items: [
        'Los premios se activarán cuando Purple Collector Premium esté disponible oficialmente. No hay fecha de lanzamiento definida.',
        'La duración del premio empieza a contar desde su activación, no desde el fin del concurso.',
        'Los premios son personales, no se pueden transferir ni cambiar por dinero.',
      ],
    },
    {
      title: '9. Uso autorizado de imágenes y créditos',
      items: [
        'Al aportar, autorizas a Purple Collector a mostrar la imagen en el catálogo de la app.',
        'Cada imagen aprobada se acredita con tu @usuario.',
      ],
    },
    {
      title: '10. Privacidad y nombres de usuario',
      items: [
        'El ranking es público para quienes usan la app y muestra solo tu @usuario y tu cantidad de photocards aprobadas.',
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
        '1 approved photocard = 1 point.',
        'The photocard must be part of the catalog that existed when the challenge started.',
        'You must send the front and the back, and both must be approved.',
        'The contribution must be sent while the challenge is accepting contributions.',
        'If several people send the same photocard, the point goes to the first complete contribution (front and back) sent that ends up approved.',
      ],
    },
    {
      title: "4. What doesn't count",
      items: [
        'Rejected images, or images still pending review.',
        'Incomplete contributions (front only or back only).',
        'Photocards that already had a valid earlier contribution (duplicates), and resubmissions of the same photocard.',
        'Images removed or invalidated after approval: their point is subtracted and the ranking recalculated.',
        'Photocards or albums added to the catalog after the challenge started.',
        'Contributions sent before after the close.',
      ],
    },
    {
      title: '5. Tie-break',
      items: [
        'If two or more participants end with the same points, the one who reached that score first wins, according to the recorded send date of their last scoring contribution.',
      ],
    },
    {
      title: '6. Dates and closing',
      items: [
        'The challenge closes when every photocard in the initial catalog has an approved contribution, or earlier if Purple Collector announces it in News.',
        'Once closed, no new contributions count, and the ones sent in time are reviewed.',
        'Winners are published only when no contributions from the period are left pending.',
      ],
    },
    {
      title: '7. Image review',
      items: [
        'Each side is reviewed separately. Photos are approved when they match the photocard, look complete and sharp, and follow the usage terms.',
        'The ranking is provisional until the challenge ends and every contribution is reviewed.',
        'Purple Collector may invalidate an approved contribution if it later turns out not to follow the rules.',
      ],
    },
    {
      title: '8. Premium prize terms',
      items: [
        'Prizes will be activated when Purple Collector Premium is officially available. There is no launch date yet.',
        'The prize duration starts counting from activation, not from the end of the challenge.',
        'Prizes are personal and cannot be transferred or exchanged for money.',
      ],
    },
    {
      title: '9. Image usage and credits',
      items: [
        'Only upload photos you took or have the right to share.',
        'By contributing, you allow Purple Collector to show the image in the app catalog.',
        'Every approved image is credited with your @username.',
      ],
    },
    {
      title: '10. Privacy and usernames',
      items: [
        'The ranking is public to app users and shows only your @username and your number of approved photocards.',
        'Your email and real name are never published. We recommend your @username not be your real name.',
        'You can change your @username from your profile at any time.',
      ],
    },
  ],
};
