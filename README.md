# Cali → Japón · Cuaderno de viaje 2027

Sitio para organizar entre 4–5 amigos un viaje a Japón desde Cali: cuándo ir, qué papeles hacen
falta y qué lugares visitar. Cada uno entra con su nombre y una clave compartida, y deja sus
sellos para votar.

- **Publicado en:** https://nihon-trip.vercel.app
- **Repositorio:** `CondeHdz94/japan-travel` (privado). Cada push a `main` se despliega solo en Vercel.

## Con qué está hecho

| Pieza | Qué es |
| :-- | :-- |
| [Astro](https://docs.astro.build) 7 | Páginas estáticas, más rutas de servidor para la API y para Lugares |
| `@astrojs/vercel` | Adaptador de despliegue |
| libSQL (`@libsql/client`) | Base de datos: archivo local en desarrollo, [Turso](https://turso.tech) en producción |
| Fontsource | Tipografías autoalojadas: Shippori Mincho, Zen Kaku Gothic New, DM Mono |
| `sharp` (desarrollo) | Comprime las fotos del catálogo |

No hay framework de interfaz: lo interactivo es TypeScript sin dependencias.

## Secciones

| Ruta | Estado | Qué tiene |
| :-- | :-- | :-- |
| `/` | Lista | Portada, «boleto» del viaje, índice y animación de entrada |
| `/cuando-ir` | Lista | El año en Tokio mes a mes, cuatro ventanas candidatas para votar, fechas a evitar |
| `/requisitos` | Lista | Visa, rutas sin visa americana y checklist personal de papeles |
| `/lugares` | Lista | Catálogo de 116 lugares y eventos por tema, con filtros, votos y propuestas del grupo |
| Itinerario, Presupuesto, Apps | Pendientes | Aparecen en el índice como «Pronto» |

## Correrlo en local

```sh
pnpm install
pnpm dev        # http://localhost:4321
```

Hace falta un archivo `.env` con la clave del viaje (ver `.env.example`):

```
TRIP_KEY=la-clave
```

En local los datos van a `.data/local.db`, que se crea solo. Ni `.env` ni `.data/` suben al repo.

> `pnpm build` falla en Windows al empaquetar para Vercel (`EPERM ... symlink`) si no está
> activo el Modo de desarrollador. En Vercel compila bien.

## Variables de entorno

| Variable | Dónde | Para qué |
| :-- | :-- | :-- |
| `TRIP_KEY` | local y Vercel | Clave compartida para entrar. Si cambia, se cierran todas las sesiones |
| `TURSO_DATABASE_URL` | solo Vercel (Production) | URL `libsql://…` de la base. Sin ella se usa el archivo local |
| `TURSO_AUTH_TOKEN` | solo Vercel (Production) | Token de lectura y escritura de la base |

`.env.production` es una copia de respaldo local de los valores de producción; Vercel no lo lee
y no sube al repo.

## Cómo funciona el grupo

**Entrar.** Nombre + clave del viaje, sin cuentas ni correos. Si el nombre no existe se crea el
viajero; si existe, se entra como él (sin distinguir mayúsculas ni tildes: «Andrés» y «andres»
son el mismo). La sesión es una cookie firmada con la clave. Cualquiera con la clave puede
entrar con el nombre de otro: es una decisión consciente para un grupo de amigos.

**Sellos.** Cada viajero tiene un sello con la primera sílaba de su nombre en katakana
(`src/scripts/kana.ts` hace la transcripción por sonido) y su inicial latina. Hay 12 formas de
sello (`src/data/formas.ts`): al entrar por primera vez se asigna la primera que nadie tenga, y
cada quien la cambia desde su perfil. Todas se dibujan en la misma caja, así que cambiar de forma
no mueve nada; donde los sellos se montan, cada uno tapa al de abajo solo con su silueta.

**Marcas.** Todo lo que se vota es una fila `(persona, tipo, clave, valor)`:

| `tipo` | `clave` | `valor` |
| :-- | :-- | :-- |
| `mes` | `ene`…`dic` | 1 = puedo viajar |
| `ventana` | `cerezos`, `abril`, `primavera`, `verano`, `otono`, `invierno` | 2 me encanta · 1 me sirve · 0 no puedo |
| `papel` | `pasaporte`, `visa`, … | 1 = ya lo tengo |
| `lugar` | id del catálogo, o `u<id>` si lo propuso el grupo | 1 = quiero ir |

**En las páginas** lo interactivo se declara con atributos y `src/scripts/grupo.ts` hace el resto:

```html
<div data-marca="mes:oct">
  <button class="poner" data-poner="1">Puedo</button>
  <span data-sellos></span>
</div>
```

- `data-marca="tipo:clave"` — contenedor de algo que se puede marcar
- `data-poner="valor"` — botón que pone o quita ese valor
- `data-sellos` — donde se pintan los sellos (`data-valor` filtra; `data-fantasmas` muestra los pendientes)
- `data-sello-de="idPersona"` — el sello de una persona puntual
- `data-entrar` — abre el registro

**En vivo.** Las páginas con sellos consultan `/api/estado` cada 6 segundos mientras la pestaña
está visible. Se pausa si nadie toca la página en 5 minutos. El Inicio solo consulta una vez, al cargar.

**Sin saltos.** El espacio de los sellos se reserva de antemano, el último estado se guarda en
`localStorage` para pintar de una, y en Lugares el orden por votos se fija al cargar.

**Privacidad.** Sin sesión se ve la información, pero no los nombres, los sellos ni los lugares
propuestos por el grupo. Los documentos sensibles nunca se suben: el sitio solo los recuerda.

## API

Todas en `src/pages/api/`, responden JSON.

| Ruta | Qué hace |
| :-- | :-- |
| `GET estado` | Quién soy, quiénes somos y todas las marcas (vacío sin sesión) |
| `POST entrar` | `{nombre, clave}` → abre sesión |
| `POST salir` | Cierra la sesión de este dispositivo |
| `POST renombrar` | `{nombre, forma?}` → cambia mi nombre (y la forma de mi sello, si viene) conservando marcas |
| `POST borrarme` | Me saca del grupo, con mis marcas y los lugares que propuse |
| `POST marca` | `{tipo, clave, valor}` → pone una marca; `valor: null` la quita. Solo acepta claves que existen: las de `src/data/claves.ts`, el catálogo o un lugar propuesto vigente |
| `POST lugares` | Propone un lugar |
| `POST quitar-lugar` | `{id}` → quita un lugar que yo propuse |

## Pruebas

```sh
pnpm test                        # todo: lógica, escritorio (1280) y celular (390)
pnpm test --project=logica       # solo funciones y API, sin navegador (segundos)
pnpm test lugares                # un solo archivo
```

Están en `pruebas/` y usan Playwright con el Edge que trae Windows. Levantan su propio servidor
en el puerto 4399, con clave y base propias (`.data/pruebas.db`): no leen el `.env` ni tocan
`.data/local.db`, y la base de pruebas se vacía después de cada prueba.

| Archivo | Qué cubre |
| :-- | :-- |
| `unidad.spec.ts` | Katakana, etiquetas de meses y coherencia del catálogo y las fotos |
| `api.spec.ts` | Toda la API: sesión, marcas, renombrar, borrarse, proponer y quitar, privacidad |
| `paginas.spec.ts` | Cada página: carga limpia, cabecera, enlaces, desborde, entrada animada |
| `grupo.spec.ts` | Registro, sellos, en vivo, perfil, sin conexión y «nada salta» |
| `lugares.spec.ts` | Filtros, sellos, proponer, quitar y avisos en vivo |

## Lugares y fotos

- El catálogo inicial está en `src/data/lugares.ts` (temas, zonas, temporadas y lugares).
  Lo que propone el grupo vive en la tabla `lugares` de la base.
- Las fotos son de Wikimedia Commons, de uso libre con atribución. Se bajan con:

  ```sh
  node scripts/fotos-lugares.mjs          # solo las que faltan
  node scripts/fotos-lugares.mjs --todo   # todas de nuevo
  ```

  El script toma la imagen principal del artículo indicado en `wiki`; si es un logo o un mapa,
  el campo `foto` permite dar una búsqueda en Commons. Deja las imágenes en `public/lugares/`
  y los créditos en `src/data/fotos.json`, que se muestran al final de la página.
- Para agregar un lugar al catálogo: añadirlo a `SEMILLAS` y correr el script.

## Estructura

```text
scripts/fotos-lugares.mjs    baja y comprime las fotos del catálogo
scripts/iconos.mjs           saca los íconos a partir de public/favicon.svg
scripts/tarjeta.html         la tarjeta que sale al compartir el enlace (public/tarjeta.png)
public/                      íconos, manifiesto y tarjeta para compartir
public/lugares/              fotos del catálogo
src/
├── components/Intro.astro   animación de entrada del Inicio
├── data/                    secciones, catálogo de lugares, créditos de fotos, formas de sello
├── layouts/Base.astro       cabecera, lomo vertical, registro y perfil
├── lib/                     base de datos, sesión, consultas de lugares
├── pages/                   páginas y API
├── scripts/                 grupo.ts (sellos y sesión), kana.ts, intro.ts
└── styles/global.css        sistema visual y estilos de sellos
```

## Diseño

Cuaderno de viaje editorial: papel washi, tinta sumi, bermellón como acento, Mincho para títulos,
kanji en vertical. Los colores y tipografías son variables en `src/styles/global.css`.

Nada queda de fábrica: el ícono es el sello 旅 de la cabecera (`public/favicon.svg`, con el kanji
como trazo; `node scripts/iconos.mjs` saca de ahí el `.ico` y los de pantalla de inicio), el
enlace compartido en WhatsApp muestra una tarjeta propia (`scripts/tarjeta.html` explica cómo
volver a sacarla) y una dirección que no existe cae en `src/pages/404.astro`. La dirección
pública del sitio está en `site`, en `astro.config.mjs`: si cambia, se cambia ahí.

## Pendientes y cosas por confirmar

- La información de visa y rutas es una primera pasada de noviembre de 2026; lo marcado
  «por confirmar» en la página hay que verificarlo en la fuente oficial.
- Las descripciones y fechas del catálogo de lugares no están verificadas contra fuentes.
- Un lugar propuesto no se puede editar, solo quitar y volver a crear.
- Las copias de Preview en Vercel no tienen variables de entorno: no funcionan hasta crear una
  base de pruebas para ellas.
