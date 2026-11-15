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
| `/` | Lista | Portada, «boleto» del viaje con los pasajeros, índice, animación de entrada y llegadas al viaje |
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
viajero. Si ya existe (sin distinguir mayúsculas, tildes ni espacios: «Andrés» y «andres» son el
mismo), el registro pregunta «Ya hay alguien llamado Andrés en el viaje. ¿Eres tú?»: «Sí, soy
yo» entra como esa persona; «No, soy otra persona» pide otro nombre. Así un segundo «Juan» no
queda convertido en el primero. «Juan», «Juan Camilo» y «Juan Pablo» son nombres distintos. La
sesión es una cookie firmada con la clave. Cualquiera con la clave puede entrar con el nombre de
otro: es una decisión consciente para un grupo de amigos (la pregunta evita equivocaciones, no
suplantaciones).

**Sellos.** Cada viajero tiene un sello con la primera sílaba de su nombre en katakana
(`src/scripts/kana.ts` hace la transcripción por sonido) y sus iniciales: una por palabra
(«Juan» → J, «Juan Camilo» → JC); si dos chocan, se alarga la última palabra («Ana» y «Andrés»
→ Ana y And). Hay 12 formas de sello (`src/data/formas.ts`) y 6 colores: al entrar se asignan
la primera forma y el primer color que nadie tenga. La forma se cambia desde el perfil; el color
es fijo, así que si alguien se sale, los demás no cambian de color. Todas las formas se dibujan
en la misma caja, así que cambiar de forma no mueve nada; donde los sellos se montan, cada uno
tapa al de abajo solo con su silueta.

**Llegadas al viaje.** Dos momentos, en `src/scripts/llegadas.ts` (lo dibuja) y `grupo.ts`
(decide cuándo):

- *«Ya vas a bordo»*: quien se registra ve caer su sello en grande, y aterriza donde hizo clic
  (el voto que le pidió entrar, el boleto del Inicio o, si no, la cabecera). Nunca lo saca de
  la página. En Lugares, la página se recarga al terminar.
- *Desde tu última visita*: al abrir el Inicio, los que entraron después de mi «visto» caen
  juntos con un solo anuncio («Laura y Santiago se montaron al viaje») y vuelan a la casilla
  Pasajeros del boleto; si no se ve, la página baja lo justo. «Visto» es el id más alto que ya se
  me anunció; se guarda por persona en la base, así que vale para todos mis aparatos, y solo
  cuando de verdad se mostró. Quien se registra arranca con su propio id: no se le anuncian los
  que ya estaban.

Arranca cuando termina de caer el sello 計画中 (después de la intro, si la hay), más 0,6 s, y
solo con el estado fresco del servidor. Solo se salta a propósito («Saltar», un toque o
Escape): el scroll no lo salta, y mientras dura la página se queda quieta sin esconder la barra
de scroll. Hay versión tranquila, sin golpe (los sellos caen en el boleto cuando se ve y abajo
dice «Nuevos: …»), si hay movimiento reducido, si el estado llega más de 2 s tarde, si ya se
bajó del titular o si se hizo clic o se tecleó algo antes. Sin red no se anuncia nada. El Inicio
no consulta en vivo: quien llegue mientras está abierto sale en la próxima visita.

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
- En el Inicio: `data-pasajeros` (los sellos de todo el grupo), `data-cuenta-pasajeros`
  («Van 3 de 4–5»), `data-portada` (si sigue a la vista, las llegadas van en grande) y
  `data-llegadas-despues` (las llegadas esperan a que ese elemento termine de animarse)

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
| `GET estado` | Quién soy, quiénes somos (con forma y color), todas las marcas y mi `visto` (vacío sin sesión) |
| `POST entrar` | `{nombre, clave, soyYo?}` → abre sesión; `nuevo: true` si se registró. Si el nombre ya existe y no viene `soyYo: true`, responde 409 con `existe` (para el «¿eres tú?») |
| `POST visto` | `{hasta}` → ya se me anunció hasta ese viajero. Solo sube, y nunca más allá del último que existe |
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
| `llegadas.spec.ts` | Bienvenida, llegadas desde mi última visita con varios viajeros y aparatos, «¿eres tú?» y el boleto |
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
- El nombre de cada lugar lleva a leer sobre él: al artículo de `wiki` en Wikipedia en español
  si existe, y si no en inglés; en los propuestos, al enlace que puso quien lo propuso. «Mapa»
  siempre lleva a Google Maps. Los enlaces a Wikipedia se resuelven una vez con:

  ```sh
  node scripts/articulos-lugares.mjs
  ```

  y quedan en `src/data/articulos.json`. Si `wiki` se usó solo para la foto y el artículo es de
  otra cosa, `sinArticulo: true` deja el nombre sin enlace; si no existe el artículo, también.
- Para agregar un lugar al catálogo: añadirlo a `SEMILLAS` y correr los dos scripts.

## Estructura

```text
scripts/fotos-lugares.mjs    baja y comprime las fotos del catálogo
scripts/articulos-lugares.mjs resuelve a qué artículo de Wikipedia lleva cada lugar
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
├── scripts/                 grupo.ts (sellos y sesión), llegadas.ts (el momento de una llegada), kana.ts, intro.ts
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
