/** Public facts and build defaults. This file does not authorize publication. */
export const site = Object.freeze({
  name: 'Rhino Audiovisuales',
  language: 'es-PE',
  locale: 'es_PE',
  // F6 leaves www/non-www undecided. Set only after the owner's decision.
  canonicalOrigin: null,
  telephone: '+51965683542',
  whatsapp: '51965683542',
  email: 'info@rhinoaudiovisuales.com',
  // Versión cuadrada sobre el degradado: el logo original es blanco sobre transparente y no se vería en fondo blanco.
  logo: '/media/logo-rhino-cuadrado-512.png',
  socialImage: Object.freeze({
    path: '/media/og-rhino.png',
    width: 1200,
    height: 630,
    alt: 'Rhino Audiovisuales — productora audiovisual en Lima',
  }),
});
