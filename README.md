# Rhino Audiovisuales · nueva web (avance)

Avance de la nueva web de Rhino Audiovisuales, hecho con [Astro](https://astro.build). Es una **versión de revisión**, todavía no publicada: todas las páginas llevan `noindex`, y el mapa del sitio sale vacío hasta decidir el dominio y el lanzamiento.

## Verla en tu computadora

Necesitas Node.js 22 o superior.

```bash
npm ci
npm run dev       # modo desarrollo en http://127.0.0.1:4323
```

Para ver la versión compilada, tal como quedaría publicada:

```bash
npm run build
npx astro preview --host 127.0.0.1 --port 4400   # http://127.0.0.1:4400
```

## Qué incluye este avance

Actualizado el 27-11-2026.

- **Home** (`/`).
- **18 páginas de servicios con el diseño «escena»:** cada una abre con una cabecera a pantalla completa con animación propia sobre la foto, como luces, haces, pantallas LED, vapor, flashes, ondas de sonido, confeti o formas de motion graphics. Cada una tiene además al menos un bloque animado propio de su servicio:
  - **índice de servicios** (`/servicios/`): visor de cámara de fotos;
  - **cobertura de eventos:** visor y fotogramas de cámara;
  - **streaming y podcast:** visor «en vivo»;
  - **catering:** momentos de la jornada;
  - **organización de eventos:** escaleta;
  - **producción audiovisual:** línea de tiempo de edición;
  - **video corporativo:** claquetas;
  - **bodas:** álbum que se revela;
  - **spots:** del boceto a la toma;
  - **drones:** vista que gana altura al bajar;
  - **inmobiliaria:** plano con recorrido;
  - **sonido y proyectores:** imagen que se enfoca y ecualizador;
  - **activaciones BTL:** ráfaga de confeti;
  - **maestro de ceremonias:** tarjeta del conductor;
  - **fotografía publicitaria:** vista general, detalle y composición;
  - **redes sociales:** calendario de contenidos;
  - **animación y motion graphics** (nueva): muestras animadas en vivo, editor de curvas y formatos;
  - **estudio fotográfico** (nueva): selector de sesiones con flash y hoja de contactos.
- **Show infantil navideño:** telón animado.
- **Menú orbital:** al pulsar «Servicios» o «Portafolio», esa opción pasa al centro y la rodean sus páginas.
- **Barra fija de redes** (WhatsApp, Facebook, Instagram) en el borde derecho.
- **Cortina de marca** al pasar de una página a otra. No bloquea el scroll.
- **Movimiento reducido:** si el sistema pide reducir el movimiento, todo se ve quieto y completo. Las animaciones se detienen fuera de pantalla.
- **Páginas «en construcción»:** portafolio, nosotros, contacto, política de privacidad y algunos servicios muestran un aviso hasta que estén listas.

## Avisos para revisar

- **Fotos:**
  - Las fotos de cabecera y de los bloques son **ilustraciones creadas con IA**, sin rostros reconocibles ni textos.
  - Sirven para el diseño y se sustituirán por fotos propias antes del lanzamiento.
  - No representan eventos, clientes ni instalaciones reales de Rhino.
- **Contenido temporal de maqueta en «Animación y motion graphics» y «Estudio fotográfico»:**
  - Qué es: las modalidades de sesión, las fotos del espacio y las animaciones de ejemplo son provisionales y están rotuladas en la página.
  - Dónde está: se identifica en `src/data/paginas-extra.json` (`temporal`).
  - Protección: mientras exista, esas páginas no se pueden aprobar para publicar, y en un build de producción salen «en construcción».
- **Proyectos y logos de clientes:** proceden de la web actual. Para mostrarlos como casos hace falta confirmar el permiso de cada cliente.
- **Datos pendientes:**
  - siguen sin confirmar los precios, las capacidades, la dirección del estudio, los horarios, los enlaces de Facebook e Instagram y algunos textos;
  - por eso hay secciones que todavía no aparecen.

## Estructura

| Carpeta o archivo | Contenido |
| --- | --- |
| `src/pages/` | Rutas: la home, la plantilla de páginas interiores (`[...slug].astro`) y la 404. |
| `src/components/v4/` | Diseño de las páginas de servicios. |
| `src/components/OrbitalMenu.astro` y `src/scripts/navigation.ts` | Menú orbital. |
| `src/data/` | Registro de páginas, textos de cada página y mapa de secciones (`maquetas-v4.json`). |
| `src/styles/` | Estilos. |
| `src/scripts/` | Comportamiento. |
| `public/media/` | Imágenes. |

## Comprobaciones

```bash
npm run check                  # revisa el build: un H1, noindex, recursos locales, sin rastreo
node scripts/test-seo.mjs      # pruebas SEO (incluye que el contenido temporal no llegue a producción)
```

Una de las pruebas SEO lee el paquete del plan SEO, que no se incluye en este repositorio, y fallará sin él.
