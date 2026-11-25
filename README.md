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
| `/lugares` | Lista | Catálogo de 183 lugares y eventos por tema, con filtros, votos y propuestas del grupo |
| `/decisiones` | Lista | Los votos de todos cruzados: ventana que va ganando, meses, lugares fijos, posible reparto de días, papeles y lo que me falta |
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
la primera forma y el primer color que nadie tenga. Los dos se cambian desde el perfil, con una
diferencia: la forma es gusto personal y se puede repetir; el color es lo que distingue a cada
uno de lejos y no se repite (los de otros se ven ocupados, con el nombre de quién es, y la API
rechaza tomarlos). El color se guarda, así que si alguien se sale, los demás no cambian de
color. Si el grupo pasa de 6, los colores se repiten. Todas las formas se dibujan
en la misma caja, así que cambiar de forma no mueve nada; donde los sellos se montan, cada uno
tapa al de abajo solo con su silueta.

**Llegadas al viaje.** Tres momentos, en `src/scripts/llegadas.ts` (lo dibuja) y `grupo.ts`
(decide cuándo):

La regla: cada persona ve la entrada de cada una de las demás **una sola vez**. Se guarda por
parejas en la tabla `vistos` («Lau ya vio a Juan»), así que vale para todos mis aparatos, y
solo cuando de verdad se mostró.

- *«Ya vas a bordo»*: quien se registra ve caer primero, chiquitos, los sellos de los que ya
  iban, y después el suyo en grande («Asiento 3 · ヘス · con Juan y Lau»). El suyo aterriza donde
  hizo clic (el voto que le pidió entrar, el boleto del Inicio o, si no, la cabecera); los
  chiquitos vuelan a su puesto en el boleto si está en la página, y si no se desvanecen. Nunca lo
  saca de la página. En Lugares, la página se recarga al terminar. Al registrarse, a todos los
  que ya iban se los da por vistos.
- *Desde tu última visita*: al abrir el Inicio, los que todavía no me han presentado caen
  juntos con un solo anuncio («Laura y Santiago se montaron al viaje») y vuelan a la casilla
  Pasajeros del boleto; si no se ve, la página baja lo justo.
- *Ponerse al día*: si entre ellos hay alguien que ya iba cuando entré (quedó así en las bases
  de antes de `vistos`, cuando la bienvenida no mostraba a los de antes), el anuncio es «Juan y
  Jess van a bordo contigo» y, debajo, como en la bienvenida, «Asiento 2 · ラウ · van 4». Sale una
  vez.

Al crear `vistos` en una base que ya existía, se llena una sola vez con la columna vieja
`personas.visto` (el id más alto que ya se me había anunciado): cuenta como visto quien llegó
después de mí y hasta ese id; los de antes quedan pendientes. La columna se deja, ya sin uso.

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

**De quién es un sello.** Tocar o hacer clic en cualquier sello muestra encima una etiqueta con
el nombre y su katakana («Falta» si es un pendiente), porque en celular no hay `title`. La pinta
`src/scripts/de-quien.ts` con los `data-nombre` y `data-katakana` que traen todos los sellos. Flota
(no mueve nada), sigue al sello si hay scroll y se cierra al tocar fuera, con Escape o si el
sello sale de la pantalla. No sale en los sellos que ya hacen otra cosa: el de la cabecera, las
muestras del perfil y los de una llegada.
- En el Inicio: `data-pasajeros` (los sellos de todo el grupo), `data-cuenta-pasajeros`
  («Van 3 de 4–5»), `data-portada` (si sigue a la vista, las llegadas van en grande) y
  `data-llegadas-despues` (las llegadas esperan a que ese elemento termine de animarse)

**En vivo.** Las páginas con sellos consultan `/api/estado` cada 6 segundos mientras la pestaña
está visible. Se pausa si nadie toca la página en 5 minutos. El Inicio solo consulta una vez, al cargar.

**Decisiones.** `/decisiones` no tiene votos propios: se arma en el servidor en cada visita con
todas las marcas, usando las cuentas de `src/lib/decisiones.ts` (funciones puras). No consulta en vivo:
lo que voten los demás sale al volver a abrirla. Las reglas:

- *Ventanas.* 好 vale 2 y 可 vale 1; se ordenan por puntos sobre lo posible entre quienes votaron.
  Un solo 否 tacha la ventana. Si a la que va adelante le falta un voto, se avisa cuál pasaría
  adelante si ese voto fuera «No puedo». Con menos de la mitad del grupo votando no se anuncia
  ganadora («es temprano»); si hay empate se nombran todas.
- *No cuadra.* Votos a una ventana sin ninguno de sus meses marcado como «Puedo».
- *Lugares.* Fijos: los quiere todo el grupo o todos menos uno (mínimo dos). Con fuerza: dos o
  más. Planes personales: uno solo. Lo que solo se da en otros meses se marca contra la ventana
  que va adelante.
- *Días.* Los 15 días se reparten entre zonas en proporción a los votos de lo que quieren dos o
  más (mayor residuo). Es una posible opción, no un plan.
- *Tu parte.* Mis pendientes, cada uno con su enlace: si mi voto decide la ventana, qué ventanas
  me faltan, meses, lugares y el primer papel que me falte entre el pasaporte y los que otro del
  grupo ya tiene (no todo: los hospedajes no se piden meses antes). En Papeles, «Lo urgente» es
  el primero que el grupo ya empezó o, si no, el primero que le falte a alguien.

**Sin saltos.** El espacio de los sellos se reserva de antemano, el último estado se guarda en
`localStorage` para pintar de una, y en Lugares las tarjetas van siempre en el orden del catálogo: sellar no las mueve, ni al recargar.

**Privacidad.** Sin sesión se ve la información, pero no los nombres, los sellos ni los lugares
propuestos por el grupo. Decisiones, sin sesión, solo muestra cómo se cuenta. Los documentos
sensibles nunca se suben: el sitio solo los recuerda.

## API

Todas en `src/pages/api/`, responden JSON.

| Ruta | Qué hace |
| :-- | :-- |
| `GET estado` | Quién soy, quiénes somos (con forma y color), todas las marcas y mis `pendientes`: los ids que todavía no me han presentado (vacío sin sesión) |
| `POST entrar` | `{nombre, clave, soyYo?}` → abre sesión; `nuevo: true` si se registró. Si el nombre ya existe y no viene `soyYo: true`, responde 409 con `existe` (para el «¿eres tú?») |
| `POST visto` | `{ids}` → ya me presentaron a esos viajeros. Solo suma; ignora ids que no existen y el mío |
| `POST salir` | Cierra la sesión de este dispositivo |
| `POST renombrar` | `{nombre, forma?, tinta?}` → cambia mi nombre (y la forma o el color de mi sello, si vienen) conservando marcas. Un color de otro: 409 con de quién es |
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
| `unidad.spec.ts` | Katakana, etiquetas de meses y coherencia del catálogo, las fotos y las escenas |
| `api.spec.ts` | Toda la API: sesión, marcas, renombrar, borrarse, proponer y quitar, privacidad |
| `paginas.spec.ts` | Cada página: carga limpia, cabecera, enlaces, desborde, entrada animada |
| `grupo.spec.ts` | Registro, sellos, en vivo, perfil, sin conexión y «nada salta» |
| `llegadas.spec.ts` | Bienvenida (con los que ya iban), llegadas desde mi última visita con varios viajeros y aparatos, ponerse al día, «¿eres tú?» y el boleto |
| `lugares.spec.ts` | Filtros (menús, hoja, varias opciones, dirección), sellos, proponer, quitar y avisos en vivo |
| `decisiones.unidad.spec.ts` | Las cuentas de Decisiones, iniciales y giro de los sellos (sin navegador) |
| `decisiones.spec.ts` | Decisiones: privacidad, la que va adelante, mi parte, temprano, empate, todas tachadas y lugares |
| `escenas.spec.ts` | Escenas de anime: sello y línea de la tarjeta, filtro «聖地 Solo anime», ventana, imágenes desde anitabi (interceptadas) |

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
- Si Commons no tiene nada (pasa con las estatuas y parques de anime), la foto se busca con
  licencia libre en [Openverse](https://openverse.org), se recorta y se pone a mano en
  `public/lugares/`, con su crédito en `fotos.json` y `aMano: true` para que `--todo` no la borre.
  Una licencia «NC» (no comercial) sirve, porque el sitio no es comercial.
- La foto tiene que mostrar lo famoso del lugar (la pagoda con el Fuji, los monos en el agua), no lo
  primero que salga. Si no hay ninguna libre, se usa la foto oficial del lugar, con crédito y
  `licencia: "foto oficial ©"` (pasa con Nijigen no Mori y Attack on Titan en Hita).
- El nombre de cada lugar lleva a leer sobre él: al artículo de `wiki` en Wikipedia en español
  si existe, y si no en inglés; en los propuestos, al enlace que puso quien lo propuso. «Mapa»
  siempre lleva a Google Maps. Los enlaces a Wikipedia se resuelven una vez con:

  ```sh
  node scripts/articulos-lugares.mjs
  ```

  y quedan en `src/data/articulos.json`. Si `wiki` se usó solo para la foto y el artículo es de
  otra cosa, `sinArticulo: true` deja el nombre sin enlace; si no existe el artículo, también.
- Para agregar un lugar al catálogo: añadirlo a `SEMILLAS` y correr los dos scripts.

### La barra de Lugares

Dos filas con dos trabajos: arriba los **temas**, que solo llevan a su sección (su número cuenta lo
que se ve con los filtros puestos; en 0 se apagan); abajo los **filtros**.

- **Desde 960 px:** Zona y Temporada son menús con casillas (se escogen una o varias y aplican al
  instante; el botón dice «Todas las zonas», «Tokio» o «Zona · 2»); Mis sellos y «聖地 Solo anime»
  son fichas con ✓. Cada opción dice cuántos lugares tiene con los demás filtros puestos.
- **Por debajo de 960 px:** un botón «Filtros (n)» abre una hoja con las mismas opciones como
  fichas. La hoja trabaja sobre un borrador: nada cambia detrás hasta «Ver N lugares». Al lado del
  botón quedan los filtros puestos, cada uno con ✕ para quitarlo.
- **Cómo se combinan:** dentro de un filtro se suman (Tokio o Norte), entre filtros se cruzan.
  Un lugar de todo el año no se esconde por la temporada.
- **Dirección:** `/lugares?zona=tokio,norte&t=verano,invierno&mios=1&anime=1`. Los enlaces de un
  solo valor (`?t=otono`, el de «Cuándo ir») siguen sirviendo y los valores desconocidos se ignoran.
- La lógica sin DOM (qué pasa, dirección, mensaje vacío) está en `src/scripts/filtros.ts`.

## Escenas de anime (聖地巡礼)

Lugares marca los sitios del catálogo donde pasa una escena de anime:

- **Tarjeta:** sello «聖地 N obras» arriba a la izquierda de la foto (solo avisa, no se toca) y,
  al fondo del texto, «聖 Sale en: A, B y N más · Ver escenas →».
- **Filtro:** «聖地 Solo anime», una ficha más de la barra de filtros (ver arriba). No es una
  sección: deja en cada tema solo sus lugares con escenas y queda en la dirección (`?anime=1`).
- **Ventana:** todas las obras del lugar seguidas, de la que más escenas tiene ahí a la que
  menos. En escritorio, índice fijo que marca la obra que se ve; en celular, hoja con una barra
  fija «Viendo · 2 de 16 · Índice». El encabezado con la X queda pegado arriba en los dos, y en
  celular la hoja tiene manija: arrastrarla hacia abajo la cierra. Vive en la dirección
  (`#escenas-<id>`): la X, Esc, «atrás» y tocar afuera la cierran. La pinta `src/scripts/escenas.ts`; el `<dialog>` y sus estilos están en
  `src/components/Escenas.astro`.

**Datos.** Los puntos salen de la API pública de [anitabi](https://github.com/anitabi/anitabi.cn-document),
con licencia CC BY-NC-SA 4.0: cada escena muestra su fuente con enlace y el estudio que la animó
(«Animación: …», que no es el dueño de los derechos). Se arman con:

```sh
node scripts/escenas.mjs               # usa la copia local de .data/anitabi/
node scripts/escenas.mjs --refrescar   # vuelve a pedirle todo a anitabi
```

- `scripts/escenas.config.mjs`: las series (temporadas y películas van juntas), su nombre a
  mostrar y a qué lugar va cada punto, por palabras clave.
- Nombre: el de Latinoamérica si es conocido; si no, el inglés oficial; si no, el rōmaji. Nunca
  en letra japonesa. El rōmaji va debajo cuando es distinto.
- `src/data/escenas.json` lo genera el script; no se edita a mano.
- `src/data/escenas-revision.json` sí es a mano, y el script nunca lo pisa: estado de cada escena
  (`confirmada` con su enlace, `validada` o `por-confirmar`), distancia si es otro punto
  («Queda»), la escena principal de una obra y lo que se excluye.

**Imágenes.** No se copian: la ventana las muestra desde anitabi, como indica su
[documentación](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md): la mediana
(`?plan=h360`) para la escena grande, la pequeña (`?plan=h160`) para las miniaturas, nunca la
completa, y la fuente con su enlace al lado. Solo se piden con sesión (sin sesión la ventana
muestra todo menos las imágenes) y cuando alguien abre la ventana. Si una no carga, el marco del
mismo tamaño lleva a verla en anitabi. Las pruebas nunca le piden nada a anitabi: interceptan
sus imágenes.

## Estructura

```text
scripts/fotos-lugares.mjs    baja y comprime las fotos del catálogo
scripts/articulos-lugares.mjs resuelve a qué artículo de Wikipedia lleva cada lugar
scripts/escenas.mjs          arma las escenas de anime (y escenas.config.mjs, su configuración)
scripts/iconos.mjs           saca los íconos a partir de public/favicon.svg
scripts/tarjeta.html         la tarjeta que sale al compartir el enlace (public/tarjeta.png)
public/                      íconos, manifiesto y tarjeta para compartir
public/lugares/              fotos del catálogo
src/
├── components/              Intro.astro (entrada del Inicio) y Sello.astro (el sello pintado en el servidor)
├── data/                    secciones, ventanas, catálogo de lugares, créditos de fotos, formas de sello
├── layouts/Base.astro       cabecera, lomo vertical, registro y perfil
├── lib/                     base de datos, sesión, consultas de lugares, cuentas de Decisiones
├── pages/                   páginas y API
├── scripts/                 grupo.ts (sellos y sesión), sello.ts (iniciales y giro), llegadas.ts, kana.ts, intro.ts
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
