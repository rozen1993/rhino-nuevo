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

- **Home** (`/`).
- **16 páginas de servicios** con el diseño definitivo:
  - la índice de servicios (`/servicios/`);
  - cobertura de eventos;
  - streaming y podcast;
  - catering;
  - organización de eventos;
  - producción audiovisual;
  - video corporativo;
  - bodas;
  - spots;
  - drones;
  - inmobiliaria;
  - sonido y proyectores;
  - activaciones BTL;
  - maestro de ceremonias;
  - fotografía publicitaria;
  - redes sociales.
- **Menú orbital:** al pulsar «Servicios» o «Portafolio», esa opción pasa al centro y la rodean sus páginas.
- **Animaciones:**
  - títulos que entran como rótulos;
  - fotos con cortinilla de color;
  - collage de cabecera con profundidad;
  - iconos que se mueven;
  - carrusel de muestras en bucle;
  - línea de pasos;
  - transición entre páginas.
- **Páginas «en construcción»:** portafolio, nosotros, contacto, política de privacidad y algunos servicios muestran un aviso hasta que estén listas.

## Avisos para revisar

- **Fotos de cabecera:** las de las páginas de servicios (`public/media/pXX-momento-*` y `pXX-captura-*`) son **ilustraciones creadas con IA**, sin rostros reconocibles. Sirven para el diseño y se sustituirán por fotos propias antes del lanzamiento. No representan eventos reales de Rhino.
- **Proyectos y logos de clientes:** proceden de la web actual. Para mostrarlos como casos hace falta confirmar el permiso de cada cliente.
- **Datos pendientes:** precios, capacidades, dirección del estudio, horarios y algunos textos (por ejemplo, el podcast) siguen pendientes de confirmar. Por eso hay secciones que todavía no aparecen.

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
node scripts/test-seo.mjs      # pruebas SEO
```

Una de las pruebas SEO lee el paquete del plan SEO, que no se incluye en este repositorio, y fallará sin él.
