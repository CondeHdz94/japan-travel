// Estado compartido del grupo en el navegador: quién soy, quiénes somos y qué marcó cada uno.
//
// Las páginas declaran lo interactivo con atributos:
//   data-marca="tipo:clave"   contenedor de algo que se puede marcar
//   data-poner="valor"        botón que pone (o quita) ese valor para mí
//   data-sellos               aquí se pintan los sellos de quienes marcaron
//     data-valor="n"            …solo los que marcaron ese valor
//     data-fantasmas            …y los que faltan, en tenue
//   data-entrar               abre el registro

import { kana, primeraKana } from './kana';

interface Persona {
  id: number;
  nombre: string;
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
}

const VACIO: Estado = { yo: null, personas: [], marcas: [] };
const TINTAS = 6;

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

/** Giro estable para un sello ya puesto: el mismo en cada visita. */
function giroFijo(clave: string): number {
  // FNV-1a: mezcla bien claves casi iguales (personas con ids seguidos)
  let h = 0x811c9dc5;
  for (const ch of clave) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h ^= h >>> 15;
  return ((h >>> 0) % 21) - 10;
}
/** Giro al azar para un sello recién puesto: entre 3° y 13°, a un lado o al otro. */
const giroNuevo = () => (Math.random() < 0.5 ? -1 : 1) * Math.round(3 + Math.random() * 10);

let E: Estado = recordado();
let pendiente: (() => void) | null = null;

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
  pintar();
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

/** Inicial de cada persona; si dos comparten inicial, se alarga hasta distinguirlas. */
function iniciales(): Map<number, string> {
  const m = new Map<number, string>();
  for (const p of E.personas) {
    const yo = p.nombre.toLowerCase();
    let n = 1;
    while (
      n < 3 &&
      E.personas.some((o) => o.id !== p.id && o.nombre.toLowerCase().startsWith(yo.slice(0, n)))
    )
      n++;
    m.set(p.id, yo.charAt(0).toUpperCase() + yo.slice(1, n));
  }
  return m;
}

function sello(p: Persona, ini: Map<number, string>, fantasma = false, giro = -6): HTMLElement {
  const s = document.createElement('span');
  s.className = fantasma ? 'sello-p fantasma' : 'sello-p';
  s.style.setProperty('--giro', `${giro}deg`);
  s.dataset.tinta = String(E.personas.findIndex((x) => x.id === p.id) % TINTAS);
  const enKana = kana(p.nombre);
  const nombre = enKana ? `${p.nombre} · ${enKana}` : p.nombre;
  s.title = fantasma ? `${nombre}: pendiente` : nombre;
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
      E.personas.forEach((p, i) => {
        const v = valorDe(p.id, t, c);
        const cuenta = v !== undefined && (filtro === undefined || v === Number(filtro));
        const fantasma = !cuenta;
        if (fantasma && !('fantasmas' in zona.dataset)) return;
        const k = [p.id, fantasma ? 'f' : 's', p.nombre, ini.get(p.id), i % TINTAS].join('|');
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
}

function poner(t: string, c: string, v: number, alternar = true) {
  if (!E.yo) return;
  const yo = E.yo.id;
  const actual = valorDe(yo, t, c);
  const nuevo = alternar && actual === v ? null : v;
  const resto = E.marcas.filter((m) => !(m.p === yo && m.t === t && m.c === c));
  E = { ...E, marcas: nuevo === null ? resto : [...resto, { p: yo, t, c, v: nuevo }] };
  pintar(true);
  api('marca', { tipo: t, clave: c, valor: nuevo }).catch(cargar);
}

async function cargar() {
  try {
    E = await api('estado');
  } catch {
    E = VACIO;
  }
  pintar();
}

function abrir() {
  if (!dlg) return;
  if (aviso) aviso.textContent = '';
  dlg.showModal();
}

document.addEventListener('click', (ev) => {
  const el = ev.target as Element;

  if (el.closest('[data-entrar]')) return abrir();

  if (el.closest('[data-perfil]') && perfil && E.yo) {
    const campo = perfil.querySelector('input[name=nombre]') as HTMLInputElement;
    campo.value = E.yo.nombre;
    pintarKana(campo);
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
      abrir();
    }
  }
});

form?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const datos = new FormData(form);
  const boton = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (boton) boton.disabled = true;
  try {
    E = await api('entrar', { nombre: datos.get('nombre'), clave: datos.get('clave') });
    dlg?.close();
    pintar();
    pendiente?.();
    pendiente = null;
    form.reset();
  } catch (e) {
    if (aviso) aviso.textContent = (e as Error).message;
  } finally {
    if (boton) boton.disabled = false;
  }
});

formPerfil?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = formPerfil.querySelector<HTMLButtonElement>('button[type=submit]');
  if (boton) boton.disabled = true;
  try {
    E = await api('renombrar', { nombre: new FormData(formPerfil).get('nombre') });
    perfil?.close();
    pintar();
  } catch (e) {
    if (avisoPerfil) avisoPerfil.textContent = (e as Error).message;
  } finally {
    if (boton) boton.disabled = false;
  }
});

pintar();
cargar();
