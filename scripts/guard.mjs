// This delivery is a local visual review, never a release build.
if (process.env.RHINO_RELEASE === '1') {
  console.error('Publicación bloqueada: faltan validación visual, host canónico, rutas internas y revisión de los datos de publicación.');
  process.exit(1);
}
