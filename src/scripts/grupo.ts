// Estado compartido del grupo en el navegador: quién soy, quiénes somos y qué marcó cada uno.
//
// Las páginas declaran lo interactivo con atributos:
//   data-marca="tipo:clave"   contenedor de algo que se puede marcar
//   data-poner="valor"        botón que pone (o quita) ese valor para mí
//   data-sellos               aquí se pintan los sellos de quienes marcaron
//     data-valor="n"            …solo los que marcaron ese valor
//     data-fantasmas            …y los que faltan, en tenue
//   data-entrar               abre el registro
//
// Y en el Inicio, para las llegadas al viaje:
//   data-pasajeros            los sellos de todo el grupo (la casilla «Pasajeros» del boleto)
//   data-cuenta-pasajeros     «Van 3 de 4–5», o quiénes son nuevos
//   data-portada              si sigue a la vista, las llegadas se presentan en grande
//   data-llegadas-despues     las llegadas esperan a que este termine de caer (el sello 計画中)

import { kana, primeraKana } from './kana';
import { giroFijo, iniciales as inicialesDe } from './sello';
import './de-quien';
import { FORMAS, formaDe } from '../data/formas';
import { anunciar, hayMomento, momento, movimientoReducido, type Llegada } from './llegadas';

interface Persona {
  id: number;
  nombre: string;
  /** Forma del sello (puede faltar en un estado guardado por una versión anterior). */
  forma?: string;
  /** Color fijo del sello (ídem). */
  tinta?: number;
}
interface Marca {
  p: number;
  t: string;
  c: string;
  v: number;
}
interface Estado {
  yo: Persona | null;
  personas: Persona[];
  marcas: Marca[];
  /** El id más alto que ya se me anunció. */
  visto?: number;
  /** Solo al registrarse: es una persona nueva. */
  nuevo?: boolean;
}

const VACIO: Estado = { yo: null, personas: [], marcas: [] };
const TINTAS = 6;

/** Personas cuyos sellos van volando: ocupan su puesto, pero todavía no se ven. */
const esperando = new Set<number>();
/** Texto temporal bajo los pasajeros (p. ej. «Nuevos: Santi y Vale»). */
let avisoPasajeros: string | null = null;

// Copia local del último estado: la página se pinta de una, sin esperar al servidor,
// y así los sellos no "aparecen" después moviendo el contenido.
const CACHE = 'grupo';
function recordado(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(CACHE) ?? 'null');
    return e?.yo ? e : VACIO;
  } catch {
    return VACIO;
  }
}
function recordar() {
  try {
    if (E.yo) localStorage.setItem(CACHE, JSON.stringify(E));
    else localStorage.removeItem(CACHE);
  } catch {
    /* sin almacenamiento: solo se pierde el pintado inmediato */
  }
}

/** Giro al azar para un sello recién puesto: entre 3° y 13°, a un lado o al otro. */
const giroNuevo = () => (Math.random() < 0.5 ? -1 : 1) * Math.round(3 + Math.random() * 10);

let E: Estado = recordado();
let pendiente: (() => unknown) | null = null;

const dlg = document.getElementById('registro') as HTMLDialogElement | null;
const form = dlg?.querySelector('form') ?? null;
const aviso = dlg?.querySelector<HTMLElement>('[role=alert]') ?? null;

const perfil = document.getElementById('perfil') as HTMLDialogElement | null;
const formPerfil = perfil?.querySelector('form') ?? null;
const avisoPerfil = perfil?.querySelector<HTMLElement>('[role=alert]') ?? null;

/** Muestra bajo el campo cómo queda el nombre en katakana. */
function pintarKana(campo: HTMLInputElement) {
  const destino = campo.form?.querySelector<HTMLElement>('[data-kana]');
  if (destino) destino.textContent = kana(campo.value);
}

document.addEventListener('input', (ev) => {
  const campo = ev.target as HTMLInputElement;
  if (campo.name === 'nombre') pintarKana(campo);
});

function desarmarBorrado() {
  const b = perfil?.querySelector<HTMLElement>('[data-borrarme]');
  if (!b) return;
  b.classList.remove('seguro');
  b.textContent = 'Borrarme del grupo';
}

/** Deja la página como para alguien sin sesión. */
function fuera() {
  perfil?.close();
  E = VACIO;
  esperando.clear();
  pintar();
  avisarSesion();
}

/** Avisa a las páginas que dependen de la sesión en el servidor (p. ej. Lugares) para que se recarguen. */
function avisarSesion() {
  document.dispatchEvent(new CustomEvent('grupo:sesion'));
}

async function api(ruta: string, body?: unknown): Promise<any> {
  const r = await fetch(
    `/api/${ruta}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Algo falló. Intenta de nuevo.');
  return j;
}

/** Las letras de abajo del sello de cada quien (ver sello.ts). */
const iniciales = () => inicialesDe(E.personas);

/** Color del sello: el guardado; en un estado viejo, el de su puesto en la lista. */
const tintaDe = (p: Persona) => p.tinta ?? Math.max(0, E.personas.findIndex((x) => x.id === p.id)) % TINTAS;

function sello(p: Persona, ini: Map<number, string>, fantasma = false, giro = -6): HTMLElement {
  const s = document.createElement('span');
  const forma = formaDe(p.forma);
  s.className = `sello-p f-${forma.id}${fantasma ? ' fantasma' : ''}${!fantasma && esperando.has(p.id) ? ' esperando' : ''}`;
  s.dataset.de = String(p.id);
  s.style.setProperty('--giro', `${giro}deg`);
  // el contorno: un dibujo que llena la caja del sello, igual de grande para todas las formas
  const contorno = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  contorno.setAttribute('viewBox', '0 0 32 48');
  contorno.setAttribute('aria-hidden', 'true');
  contorno.innerHTML = forma.trazo;
  s.append(contorno);
  s.dataset.tinta = String(tintaDe(p));
  const enKana = kana(p.nombre);
  const nombre = enKana ? `${p.nombre} · ${enKana}` : p.nombre;
  s.title = fantasma ? `${nombre}: pendiente` : nombre;
  // para la etiqueta que sale al tocarlo (de-quien.ts): en celular no hay title
  s.dataset.nombre = p.nombre;
  if (enKana) s.dataset.katakana = enKana;
  // arriba la primera sílaba en katakana, abajo la inicial latina
  const silaba = primeraKana(p.nombre);
  if (silaba) {
    const k = document.createElement('b');
    k.textContent = silaba;
    if (silaba.length > 1) k.className = 'dos';
    s.append(k);
  }
  const l = document.createElement('i');
  l.textContent = ini.get(p.id) ?? '?';
  if (l.textContent.length > 2) l.className = 'largo';
  s.append(l);
  return s;
}

/** Nombres de los colores, en el orden de las tintas de global.css (data-tinta 0…5). */
const NOMBRE_TINTA = ['Bermellón', 'Índigo', 'Matcha', 'Glicina', 'Ámbar', 'Sumi'];

/**
 * Llena el perfil con lo que se puede escoger del sello: la forma (se puede repetir) y el color
 * (no se repite: el de otro se ve, dice de quién es y no se puede tocar). Cada muestra es mi
 * propio sello con lo que llevo escogido, así se ve de una cómo quedaría.
 */
function pintarFormas(forma = formaDe(E.yo?.forma).id, tinta = E.yo ? tintaDe(E.yo) : 0) {
  const formas = perfil?.querySelector<HTMLElement>('[data-formas]');
  const tintas = perfil?.querySelector<HTMLElement>('[data-tintas]');
  if (!formas || !tintas || !E.yo) return;
  const yo = E.yo;
  const ini = iniciales();
  const opcion = (campo: string, valor: string, marcado: boolean, dice: string, muestra: HTMLElement) => {
    const o = document.createElement('label');
    o.title = dice;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = campo;
    radio.value = valor;
    radio.checked = marcado;
    radio.setAttribute('aria-label', dice);
    muestra.removeAttribute('title');
    o.append(radio, muestra);
    return o;
  };
  formas.replaceChildren(
    ...FORMAS.map((f) =>
      opcion('forma', f.id, f.id === forma, `${f.nombre}: ${f.pista}`, sello({ ...yo, forma: f.id, tinta }, ini, false, 0)),
    ),
  );
  tintas.replaceChildren(
    ...NOMBRE_TINTA.map((nombre, t) => {
      // el mío nunca sale ocupado, aunque en un grupo de más de 6 alguien lo comparta
      const de = t === tintaDe(yo) ? undefined : E.personas.find((p) => p.id !== yo.id && tintaDe(p) === t);
      // el color de otro se muestra con su sello (su sílaba y su inicial): se reconoce de quién es
      // aunque no se lea el nombre
      const muestra = de ? sello(de, ini, false, 0) : sello({ ...yo, forma, tinta: t }, ini, false, 0);
      const o = opcion('tinta', String(t), t === tinta, de ? `${nombre}: es de ${de.nombre}` : nombre, muestra);
      if (de) {
        o.classList.add('ocupada');
        o.querySelector('input')!.disabled = true;
        const quien = document.createElement('small');
        // el primer nombre; si otro del grupo lo comparte, con la inicial del segundo («Juan C.»)
        const [primero, segundo] = de.nombre.split(' ');
        const repetido = E.personas.some((p) => p.id !== de.id && p.nombre.split(' ')[0].toLowerCase() === primero.toLowerCase());
        quien.textContent = repetido && segundo ? `${primero} ${segundo.charAt(0)}.` : primero;
        o.append(quien);
      }
      return o;
    }),
  );
}

// al cambiar la forma, los colores se muestran con ella (y al revés)
perfil?.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement;
  if ((el.name !== 'forma' && el.name !== 'tinta') || !formPerfil) return;
  const datos = new FormData(formPerfil);
  pintarFormas(String(datos.get('forma')), Number(datos.get('tinta')));
  perfil.querySelector<HTMLInputElement>(`input[name=${el.name}][value="${el.value}"]`)?.focus();
});

// al cerrar el perfil no quedan sellos de muestra en la página
perfil?.addEventListener('close', () => {
  perfil.querySelector('[data-formas]')?.replaceChildren();
  perfil.querySelector('[data-tintas]')?.replaceChildren();
});

const valorDe = (p: number, t: string, c: string) =>
  E.marcas.find((m) => m.p === p && m.t === t && m.c === c)?.v;

/**
 * Pinta la página según el estado. Con `animar`, los sellos que aparecen en esta pasada
 * caen con animación y giro al azar (se usa cuando es uno mismo quien acaba de marcar).
 */
function pintar(animar = false) {
  const ini = iniciales();
  document.documentElement.dataset.sesion = E.yo ? 'si' : 'no';
  recordar();

  const quien = document.getElementById('quien');
  if (quien) {
    quien.replaceChildren();
    const b = document.createElement('button');
    b.type = 'button';
    if (E.yo) {
      const n = document.createElement('span');
      n.className = 'yo';
      n.textContent = E.yo.nombre;
      const enKana = kana(E.yo.nombre);
      if (enKana) {
        const k = document.createElement('small');
        k.textContent = enKana;
        n.append(k);
      }
      b.dataset.perfil = '';
      b.setAttribute('aria-label', `${E.yo.nombre}: tu nombre y sesión`);
      b.append(sello(E.yo, ini), n);
    } else {
      b.className = 'mono';
      b.dataset.entrar = '';
      b.textContent = 'Entrar';
    }
    quien.append(b);
  }

  // sello de una persona puntual (p. ej. quien propuso un lugar)
  for (const hueco of document.querySelectorAll<HTMLElement>('[data-sello-de]')) {
    const p = E.personas.find((x) => x.id === Number(hueco.dataset.selloDe));
    hueco.replaceChildren(...(p ? [sello(p, ini, false, giroFijo(`de:${p.id}`))] : []));
  }

  for (const caja of document.querySelectorAll<HTMLElement>('[data-marca]')) {
    const [t, c] = caja.dataset.marca!.split(':');
    const mio = E.yo ? valorDe(E.yo.id, t, c) : undefined;

    for (const b of caja.querySelectorAll<HTMLElement>('[data-poner]'))
      b.setAttribute('aria-pressed', String(mio === Number(b.dataset.poner)));

    for (const zona of caja.querySelectorAll<HTMLElement>('[data-sellos]')) {
      const filtro = zona.dataset.valor;
      // Se reutilizan los sellos que ya están: solo se crean los nuevos y se quitan los que
      // sobran, para que los demás no se muevan ni repitan su animación.
      const puestos = new Map<string, HTMLElement>();
      for (const n of zona.children) puestos.set((n as HTMLElement).dataset.k ?? '', n as HTMLElement);

      const nodos: HTMLElement[] = [];
      E.personas.forEach((p) => {
        const v = valorDe(p.id, t, c);
        const cuenta = v !== undefined && (filtro === undefined || v === Number(filtro));
        const fantasma = !cuenta;
        if (fantasma && !('fantasmas' in zona.dataset)) return;
        const k = [p.id, fantasma ? 'f' : 's', p.nombre, ini.get(p.id), tintaDe(p), p.forma].join('|');
        let n = puestos.get(k);
        if (n) puestos.delete(k);
        else {
          const nuevo = animar && !fantasma;
          const giro = nuevo ? giroNuevo() : giroFijo(`${p.id}:${t}:${c}:${filtro ?? ''}`);
          n = sello(p, ini, fantasma, giro);
          n.dataset.k = k;
          if (nuevo) {
            n.classList.add('nuevo');
            n.addEventListener('animationend', () => n!.classList.remove('nuevo'), { once: true });
          }
        }
        nodos.push(n);
      });

      for (const viejo of puestos.values()) viejo.remove();
      nodos.forEach((n, i) => {
        if (zona.children[i] !== n) zona.insertBefore(n, zona.children[i] ?? null);
      });
    }
  }

  pintarPasajeros(ini);
}

/** La casilla «Pasajeros» del boleto: un sello por viajero, en orden de llegada. */
function pintarPasajeros(ini: Map<number, string>) {
  const fila = document.querySelector<HTMLElement>('[data-pasajeros]');
  if (!fila) return;
  // como en las zonas de sellos: se reutilizan los que ya están, así no repiten su animación
  const puestos = new Map<string, HTMLElement>();
  for (const n of fila.children) puestos.set((n as HTMLElement).dataset.k ?? '', n as HTMLElement);
  const nodos = E.personas.map((p) => {
    const k = [p.id, p.nombre, ini.get(p.id), tintaDe(p), p.forma].join('|');
    let n = puestos.get(k);
    if (n) puestos.delete(k);
    else {
      n = sello(p, ini, false, giroFijo(`pasajero:${p.id}`));
      n.dataset.k = k;
    }
    return n;
  });
  for (const viejo of puestos.values()) viejo.remove();
  nodos.forEach((n, i) => {
    if (fila.children[i] !== n) fila.insertBefore(n, fila.children[i] ?? null);
  });
  pintarCuenta();
}

/** «Van 3 de 4–5» bajo los pasajeros (solo cuenta los sellos que ya se ven). */
function pintarCuenta() {
  const cuenta = document.querySelector<HTMLElement>('[data-cuenta-pasajeros]');
  if (!cuenta) return;
  const n = E.personas.filter((p) => !esperando.has(p.id)).length;
  cuenta.textContent = avisoPasajeros ?? (n > 5 ? `Van ${n}` : `Van ${n} de 4–5`);
  cuenta.classList.toggle('nuevos', !!avisoPasajeros);
}

/**
 * Muestra los sellos de alguien que estaban esperando. El de `destino` se asienta (acaba de
 * aterrizar ahí); los demás caen en su puesto. Sin `destino`, todos caen; con `animar` en falso,
 * aparecen sin más.
 */
function mostrar(id: number, destino: Element | null, animar = true) {
  esperando.delete(id);
  for (const s of document.querySelectorAll<HTMLElement>(`.sello-p.esperando[data-de="${id}"]`)) {
    s.classList.remove('esperando');
    if (!animar || movimientoReducido()) continue;
    s.animate(
      s === destino
        ? [{ scale: 1.14 }, { scale: 1 }]
        : [{ opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1 }],
      { duration: s === destino ? 240 : 300, easing: 'cubic-bezier(0.2, 1.5, 0.4, 1)' },
    );
  }
  pintarCuenta();
}

/** Un sello grande para el momento, con el mismo giro que tendrá donde aterriza. */
function selloQueCae(p: Persona, destino: HTMLElement | null): HTMLElement {
  const giro = parseFloat(destino?.style.getPropertyValue('--giro') ?? '') || -6;
  const s = sello(p, iniciales(), false, giro);
  s.classList.remove('esperando');
  return s;
}

const nombres = (ps: Persona[]) =>
  ps.length === 1
    ? ps[0].nombre
    : ps.length > 3
      ? `${ps[0].nombre}, ${ps[1].nombre} y ${ps.length - 2} más`
      : `${ps.slice(0, -1).map((p) => p.nombre).join(', ')} y ${ps.at(-1)!.nombre}`;

function poner(t: string, c: string, v: number, alternar = true) {
  if (!E.yo) return;
  const yo = E.yo.id;
  const actual = valorDe(yo, t, c);
  const nuevo = alternar && actual === v ? null : v;
  const resto = E.marcas.filter((m) => !(m.p === yo && m.t === t && m.c === c));
  const antes = E;
  E = { ...E, marcas: nuevo === null ? resto : [...resto, { p: yo, t, c, v: nuevo }] };
  pintar(true);
  // mientras mi cambio viaja al servidor, se ignoran las consultas de fondo: traerían el estado viejo
  version++;
  escribiendo++;
  return api('marca', { tipo: t, clave: c, valor: nuevo })
    .catch(() => cargar(antes)) // no quedó guardado: se devuelve el sello
    .finally(() => {
      escribiendo--;
      version++;
    });
}

/**
 * Trae el estado del servidor. Si no se puede (sin red, servidor caído) se queda con
 * `respaldo`: un tropiezo de conexión no cierra la sesión ni borra lo que ya se veía.
 */
async function cargar(respaldo: Estado = E) {
  let fresco = false;
  try {
    E = await api('estado');
    fresco = true;
  } catch {
    E = respaldo;
  }
  // los nuevos solo cuentan con el estado fresco: la copia local puede estar vieja
  const nuevos = fresco && enInicio ? llegaronDesdeMiVisita() : [];
  for (const p of nuevos) esperando.add(p.id);
  pintar();
  avisarLugaresNuevos();
  if (nuevos.length) presentar(nuevos);
}

// ───── llegadas en el Inicio: los que entraron desde mi última visita ─────
const enInicio = !!document.querySelector('[data-pasajeros]');

const llegaronDesdeMiVisita = () =>
  E.yo && E.visto !== undefined ? E.personas.filter((p) => p.id > E.visto!) : [];

// Si la persona ya está haciendo otra cosa (un clic, una tecla que no es de scroll), no se le
// impone el golpe. Un poco de scroll no cuenta: lo que importa es si el titular sigue a la vista.
const TECLAS_SCROLL = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
let hizoOtraCosa = false;
if (enInicio)
  for (const ev of ['click', 'keydown'])
    addEventListener(
      ev,
      (e) => {
        if (document.documentElement.dataset.intro === 'si') return; // saltar la intro no cuenta
        if (e instanceof KeyboardEvent && TECLAS_SCROLL.includes(e.key)) return;
        if (e.target instanceof Element && e.target.closest('.llegada')) return;
        hizoOtraCosa = true;
      },
      { capture: true },
    );

/**
 * Cuándo puede arrancar: después de la intro (si la hay) y de que 計画中 termine de caer, más
 * un respiro. Así nunca se pisan dos sellos. Se mide desde que abre la página, en paralelo con
 * la consulta al servidor.
 */
let portadaLista = 0;
const portada: Promise<void> = enInicio
  ? (async () => {
      const raiz = document.documentElement;
      if (raiz.dataset.intro === 'si')
        await new Promise<void>((listo) => {
          const mo = new MutationObserver(() => {
            if (raiz.dataset.intro !== 'si') {
              mo.disconnect();
              listo();
            }
          });
          mo.observe(raiz, { attributes: true, attributeFilter: ['data-intro'] });
        });
      await new Promise(requestAnimationFrame); // que el navegador aplique los estilos de la entrada
      const sello = document.querySelector('[data-llegadas-despues]');
      const cayendo = sello?.getAnimations().filter((a) => a.playState !== 'finished') ?? [];
      if (cayendo.length)
        await Promise.race([
          Promise.all(cayendo.map((a) => a.finished.catch(() => {}))),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      await new Promise((r) => setTimeout(r, 600));
      portadaLista = performance.now();
    })()
  : Promise.resolve();

async function presentar(nuevos: Persona[]) {
  await portada;
  // el estado llegó más de 2 s tarde: ya no se interrumpe con el golpe
  const tarde = performance.now() - portadaLista > 2000;
  if (document.hidden)
    await new Promise<void>((listo) => {
      const f = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', f);
        listo();
      };
      document.addEventListener('visibilitychange', f);
    });
  const titulo = `${nombres(nuevos)} ${nuevos.length > 1 ? 'se montaron' : 'se montó'} al viaje`;
  // «ya bajó del titular»: menos de la mitad del titular a la vista (un poco de scroll no cuenta)
  const portadaEl = document.querySelector('[data-portada]');
  const titular = portadaEl?.querySelector('h1') ?? portadaEl;
  const r = titular?.getBoundingClientRect();
  const aLaVista = !r || r.bottom > r.height / 2;
  if (movimientoReducido() || tarde || hizoOtraCosa || !aLaVista || hayMomento()) return enLinea(nuevos, titulo);

  const destino = (id: number) => () =>
    document.querySelector<HTMLElement>(`[data-pasajeros] .sello-p[data-de="${id}"]`);
  const llegadas: Llegada[] = nuevos.map((p) => ({
    sello: selloQueCae(p, destino(p.id)()),
    destino: destino(p.id),
    aterriza: () => mostrar(p.id, destino(p.id)()),
  }));
  await momento(llegadas, titulo, `Desde tu última visita · van ${E.personas.length}`, { bajar: true });
  guardarVisto(nuevos);
}

/** Sin golpe: los sellos caen en el boleto cuando se ve, y abajo dice quiénes son nuevos. */
function enLinea(nuevos: Persona[], titulo: string) {
  anunciar(titulo);
  const celda = document.querySelector('[data-pasajeros]');
  if (!celda) return;
  const obs = new IntersectionObserver(
    async ([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      avisoPasajeros = `Nuevos: ${nombres(nuevos)}`;
      for (const [i, p] of nuevos.entries()) {
        if (!movimientoReducido()) await new Promise((r) => setTimeout(r, i ? 160 : 300));
        mostrar(p.id, null);
      }
      guardarVisto(nuevos);
      await new Promise((r) => setTimeout(r, 6000));
      avisoPasajeros = null;
      pintarCuenta();
    },
    { threshold: 0.9 },
  );
  obs.observe(celda);
}

/** Ya se mostraron: no se vuelven a anunciar, ni aquí ni en mis otros aparatos. */
function guardarVisto(nuevos: Persona[]) {
  const hasta = Math.max(...nuevos.map((p) => p.id));
  E = { ...E, visto: Math.max(E.visto ?? 0, hasta) };
  recordar();
  api('visto', { hasta }).catch(() => {}); // si falla, sale otra vez la próxima: mejor que perderlo
}

// ───── en vivo: se consulta el estado cada pocos segundos mientras la pestaña está a la vista ─────
// Solo en páginas que muestran sellos del grupo. En el Inicio, por ejemplo, no hay nada que
// actualizar: ahí basta la consulta única al cargar, que confirma la sesión para la cabecera.
const enVivo = !!document.querySelector('[data-marca], [data-sello-de]');
const CADA_MS = 6000;
// Si nadie toca la página en un rato, se deja de consultar: una pestaña olvidada abierta
// todo el día gastaría sola buena parte del cupo gratis de Vercel y Turso.
const DESCANSO_MS = 5 * 60 * 1000;
let actividad = Date.now();
function hayAlguien() {
  const dormida = Date.now() - actividad > DESCANSO_MS;
  actividad = Date.now();
  if (dormida) refrescar(); // al volver, se pone al día de una
}
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'])
  window.addEventListener(ev, hayAlguien, { passive: true });
let escribiendo = 0; // cambios míos en camino
let version = 0; // sube con cada cambio mío; descarta respuestas que salieron antes
let reloj: number | undefined;

const huella = (e: Estado) =>
  JSON.stringify([e.yo, e.personas, e.marcas.map((m) => `${m.p}|${m.t}|${m.c}|${m.v}`).sort()]);

async function refrescar() {
  if (!enVivo || !E.yo || escribiendo || document.hidden) return;
  if (Date.now() - actividad > DESCANSO_MS) return;
  const alSalir = version;
  let nuevo: Estado;
  try {
    nuevo = await api('estado');
  } catch {
    return; // sin red: se intenta en la próxima vuelta
  }
  if (escribiendo || alSalir !== version) return;
  if (huella(nuevo) === huella(E)) return;
  const seguia = !!nuevo.yo;
  E = nuevo;
  pintar(true); // los sellos que llegan de otros caen con animación
  if (!seguia) avisarSesion(); // me sacaron o cambió la clave
  avisarLugaresNuevos();
}

function latir() {
  clearInterval(reloj);
  if (!enVivo || document.hidden) return;
  refrescar();
  reloj = window.setInterval(refrescar, CADA_MS);
}
document.addEventListener('visibilitychange', latir);

/** Si alguien selló un lugar propuesto que esta página aún no muestra, se avisa para recargar. */
function avisarLugaresNuevos() {
  if (!document.querySelector('[data-marca^="lugar:"]')) return;
  const falta = E.marcas.some(
    (m) => m.t === 'lugar' && m.c.startsWith('u') && !document.querySelector(`[data-marca="lugar:${m.c}"]`),
  );
  if (falta) document.dispatchEvent(new CustomEvent('grupo:lugares-nuevos'));
}

// Escape cierra el registro igual que «Cerrar»: también se olvida el voto que lo abrió
dlg?.addEventListener('cancel', () => (pendiente = null));

/** Desde dónde se abrió el registro: ahí aterriza el sello de quien llega. */
type Origen = { voto: HTMLElement } | 'boleto' | 'cabecera';
let origen: Origen = 'cabecera';

const confirma = dlg?.querySelector<HTMLElement>('[data-confirma]') ?? null;
/** Muestra (o esconde) la pregunta «¿eres tú?» del registro. */
function preguntar(existe: string | null) {
  if (!form || !confirma) return;
  form.toggleAttribute('data-confirmando', !!existe);
  confirma.hidden = !existe;
  const quien = confirma.querySelector('[data-existe]');
  if (quien) quien.textContent = existe ?? '';
  if (existe) confirma.querySelector<HTMLElement>('[data-soy-yo]')?.focus();
}

function abrir(desde: Origen = 'cabecera') {
  if (!dlg) return;
  origen = desde;
  preguntar(null);
  if (aviso) aviso.textContent = '';
  // la clave siempre arranca oculta
  const ojo = dlg.querySelector<HTMLElement>('[data-ver-clave]');
  if (ojo) verClave(ojo, false);
  dlg.showModal();
}

/** Muestra u oculta lo escrito en el campo de la clave. */
function verClave(boton: HTMLElement, ver: boolean) {
  const campo = boton.parentElement?.querySelector('input');
  if (!campo) return;
  campo.type = ver ? 'text' : 'password';
  boton.setAttribute('aria-pressed', String(ver));
  boton.setAttribute('aria-label', ver ? 'Ocultar la clave' : 'Mostrar la clave');
}

document.addEventListener('click', (ev) => {
  const el = ev.target as Element;

  const ojo = el.closest<HTMLElement>('[data-ver-clave]');
  if (ojo) {
    verClave(ojo, ojo.getAttribute('aria-pressed') !== 'true');
    ojo.parentElement?.querySelector('input')?.focus();
    return;
  }

  const entrar = el.closest<HTMLElement>('[data-entrar]');
  if (entrar) return abrir(entrar.closest('.pasajeros') ? 'boleto' : 'cabecera');

  if (el.closest('[data-soy-yo]')) return entrarAlViaje(true);
  if (el.closest('[data-soy-otro]')) {
    preguntar(null);
    if (aviso) aviso.textContent = 'Escoge otro nombre: tu segundo nombre o la inicial del apellido sirven.';
    const campo = form?.querySelector<HTMLInputElement>('[name=nombre]');
    campo?.focus();
    campo?.select();
    return;
  }

  if (el.closest('[data-perfil]') && perfil && E.yo) {
    const campo = perfil.querySelector('input[name=nombre]') as HTMLInputElement;
    campo.value = E.yo.nombre;
    pintarKana(campo);
    pintarFormas();
    if (avisoPerfil) avisoPerfil.textContent = '';
    desarmarBorrado();
    perfil.showModal();
    return;
  }

  if (el.closest('[data-salir]')) {
    api('salir', {}).finally(fuera);
    return;
  }

  // borrarse pide dos toques: el primero solo avisa
  const borrar = el.closest<HTMLElement>('[data-borrarme]');
  if (borrar) {
    if (!borrar.classList.contains('seguro')) {
      borrar.classList.add('seguro');
      borrar.textContent = '¿Seguro? Se borran tus marcas';
      return;
    }
    api('borrarme', {})
      .then(fuera)
      .catch((e) => {
        if (avisoPerfil) avisoPerfil.textContent = (e as Error).message;
      });
    return;
  }

  if (el.closest('[data-cerrar]')) {
    pendiente = null;
    el.closest('dialog')?.close();
    return;
  }

  const b = el.closest<HTMLElement>('[data-poner]');
  const caja = b?.closest<HTMLElement>('[data-marca]');
  if (b && caja) {
    const [t, c] = caja.dataset.marca!.split(':');
    const v = Number(b.dataset.poner);
    if (E.yo) poner(t, c, v);
    else {
      // se guarda la intención y se aplica apenas entre
      pendiente = () => poner(t, c, v, false);
      abrir({ voto: caja });
    }
  }
});

// cambiar el nombre después de la pregunta «¿eres tú?» la quita: ya es otro nombre
form?.querySelector('[name=nombre]')?.addEventListener('input', () => preguntar(null));

form?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  entrarAlViaje(false);
});

/**
 * Entra con lo que hay en el registro. Si el nombre ya está en el viaje, el servidor no deja
 * entrar de una: se pregunta «¿eres tú?», y solo con `soyYo` se entra como esa persona.
 */
async function entrarAlViaje(soyYo: boolean) {
  if (!form) return;
  const datos = new FormData(form);
  const botones = form.querySelectorAll<HTMLButtonElement>('button[type=submit], [data-soy-yo]');
  for (const b of botones) b.disabled = true;
  try {
    const r = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: datos.get('nombre'), clave: datos.get('clave'), soyYo }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.existe) {
      if (aviso) aviso.textContent = '';
      return preguntar(j.existe);
    }
    if (!r.ok) throw new Error(j.error ?? 'Algo falló. Intenta de nuevo.');

    E = j;
    const yo = E.yo!;
    // se guarda ya: si el voto pendiente falla, el estado se recarga del servidor y ese no lo trae
    const nuevo = !!E.nuevo;
    // a quien llega le cae su sello: mientras vuela, sus sellos ocupan el puesto sin verse
    const conMomento = nuevo && !movimientoReducido();
    if (conMomento) esperando.add(yo.id);
    dlg?.close();
    pintar();
    await pendiente?.();
    pendiente = null;
    form.reset();
    preguntar(null);
    if (nuevo) await bienvenida(yo, conMomento);
    // después de la bienvenida: hay páginas que se recargan al cambiar la sesión (Lugares)
    avisarSesion();
  } catch (e) {
    if (aviso) aviso.textContent = (e as Error).message;
  } finally {
    for (const b of botones) b.disabled = false;
  }
}

/** «Ya vas a bordo»: el sello de quien llega cae y aterriza donde hizo clic. */
async function bienvenida(yo: Persona, conMomento: boolean) {
  const titulo = `Ya vas a bordo, ${yo.nombre}`;
  const enKana = kana(yo.nombre);
  const sub = `Asiento ${E.personas.findIndex((p) => p.id === yo.id) + 1}${enKana ? ` · ${enKana}` : ''}`;
  if (!conMomento) return anunciar(`${titulo}. ${sub}`);

  const mio = `.sello-p[data-de="${yo.id}"]:not(.fantasma)`;
  const enCabecera = () => document.querySelector<HTMLElement>(`#quien ${mio}`);
  const desde = origen;
  // el voto que abrió el registro (si se guardó), el boleto o, si no, la cabecera
  const destino = () =>
    (typeof desde === 'object'
      ? desde.voto.querySelector<HTMLElement>(mio)
      : desde === 'boleto'
        ? document.querySelector<HTMLElement>(`[data-pasajeros] ${mio}`)
        : null) ?? enCabecera();
  await momento([{ sello: selloQueCae(yo, destino()), destino, aterriza: () => mostrar(yo.id, destino()) }], titulo, sub);
}

formPerfil?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = formPerfil.querySelector<HTMLButtonElement>('button[type=submit]');
  if (boton) boton.disabled = true;
  try {
    const datos = new FormData(formPerfil);
    const tinta = datos.get('tinta');
    E = await api('renombrar', {
      nombre: datos.get('nombre'),
      forma: datos.get('forma') ?? undefined,
      tinta: tinta === null ? undefined : Number(tinta),
    });
    perfil?.close();
    pintar();
  } catch (e) {
    if (avisoPerfil) avisoPerfil.textContent = (e as Error).message;
  } finally {
    if (boton) boton.disabled = false;
  }
});

pintar();
cargar().then(latir);
