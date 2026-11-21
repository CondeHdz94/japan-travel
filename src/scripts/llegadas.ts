// El momento de una llegada al viaje: los sellos caen grandes en la mitad de la pantalla, se
// anuncian y vuelan a su puesto. Lo usa grupo.ts para dos cosas:
//   · la bienvenida de quien se acaba de registrar («Ya vas a bordo»)
//   · en el Inicio, los que entraron desde mi última visita («Santi se montó al viaje»)
//
// Reglas de diseño:
//   · Solo se salta a propósito: «Saltar», un toque o clic, o Escape. El scroll no lo salta
//     (nadie se lo pierde sin querer): mientras dura, la página se queda quieta, sin esconder la
//     barra de scroll para que nada salte.
//   · El destino se mide en cada cuadro: si la página se repinta o baja, el sello lo sigue.
//   · Con movimiento reducido no se llama: quien lo usa pone los sellos sin animación.

export interface Llegada {
  /** El sello grande que cae (un `.sello-p` ya armado). */
  sello: HTMLElement;
  /** Dónde aterriza; se busca en cada cuadro porque la página se puede repintar. */
  destino: () => HTMLElement | null;
  /** Se llama cuando aterriza (o al saltar): ahí se muestra el sello de verdad. */
  aterriza: () => void;
  /** Acompaña al protagonista (p. ej. los que ya iban a bordo): cae más pequeño y primero. */
  chico?: boolean;
}

const TECLAS_SCROLL = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

export const movimientoReducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Anuncia un texto a los lectores de pantalla. */
export function anunciar(texto: string) {
  let zona = document.getElementById('aviso-llegadas');
  if (!zona) {
    zona = document.createElement('p');
    zona.id = 'aviso-llegadas';
    zona.className = 'solo-lector';
    zona.setAttribute('aria-live', 'polite');
    document.body.append(zona);
  }
  zona.textContent = '';
  const z = zona;
  setTimeout(() => (z.textContent = texto), 50);
}

let enCurso = false;
/** ¿Hay un momento en pantalla? (mientras tanto no se arranca otro) */
export const hayMomento = () => enCurso;

/**
 * Corre el momento completo. Termina cuando todos aterrizaron o cuando se salta.
 * Con `bajar`, si los destinos no se ven, la página baja lo justo mientras vuelan.
 */
export async function momento(llegadas: Llegada[], titulo: string, sub: string, { bajar = false } = {}) {
  if (enCurso || !llegadas.length) {
    for (const l of llegadas) l.aterriza();
    return;
  }
  enCurso = true;
  anunciar(`${titulo}. ${sub}`);

  const capa = document.createElement('div');
  capa.className = 'llegada';
  capa.setAttribute('aria-hidden', 'true');
  // cuántas veces el tamaño de un sello normal (16 px de base); entre más sellos, más pequeños
  const base = Math.min(136, Math.max(60, innerWidth * 0.105));
  // el tamaño lo deciden los protagonistas: los chicos no achican al que llega
  const grandes = Math.max(1, llegadas.filter((l) => !l.chico).length);
  const tam = base * [1, 0.8, 0.66, 0.56][Math.min(grandes, 4) - 1];
  capa.style.setProperty('--k', String(tam / 16));
  const velo = document.createElement('div');
  velo.className = 'velo';
  const fila = document.createElement('div');
  fila.className = 'caen';
  const unos = llegadas.map((l) => {
    const u = document.createElement('span');
    u.className = l.chico ? 'cae chico' : 'cae';
    l.sello.removeAttribute('title');
    u.append(l.sello);
    fila.append(u);
    return u;
  });
  const txt = document.createElement('p');
  txt.className = 'dice';
  const t1 = document.createElement('strong');
  t1.textContent = titulo;
  const t2 = document.createElement('span');
  t2.className = 'mono';
  t2.textContent = sub;
  txt.append(t1, t2);
  const saltar = document.createElement('button');
  saltar.type = 'button';
  saltar.className = 'saltar mono';
  saltar.textContent = 'Saltar →';
  saltar.removeAttribute('aria-hidden');
  capa.append(velo, fila, txt, saltar);
  document.body.append(capa);

  let saltado = false;
  const aterrizados = new Set<number>();
  const aterrizar = (i: number) => {
    if (aterrizados.has(i)) return;
    aterrizados.add(i);
    llegadas[i].aterriza();
  };
  const salta = () => {
    if (saltado) return;
    saltado = true;
    llegadas.forEach((_, i) => aterrizar(i));
  };

  // la página se queda quieta mientras dura: se frena el gesto, sin esconder la barra de scroll
  const frenar = (e: Event) => e.preventDefault();
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return salta();
    if (TECLAS_SCROLL.includes(e.key) && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
  };
  addEventListener('wheel', frenar, { passive: false });
  addEventListener('touchmove', frenar, { passive: false });
  addEventListener('keydown', tecla);
  capa.addEventListener('click', salta);

  try {
    const GOLPE = 260, PASO = 120, PAUSA = 260;
    // cuándo cae cada uno: al pasar de los chicos al protagonista hay una pausa corta
    const cuando = llegadas.map((l, i) => i * PASO + (!l.chico && llegadas.slice(0, i).some((o) => o.chico) ? PAUSA : 0));
    // el velo y el primer sello arrancan juntos: no hay un instante de página gris y vacía
    velo.animate([{ opacity: 0 }, { opacity: 0.96 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    unos.forEach((u, i) => {
      u.animate([{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: GOLPE,
        delay: cuando[i],
        easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)',
        fill: 'backwards',
      });
      // cada sello que cae hunde la fila un poquito
      fila.animate([{ translate: '0 0' }, { translate: '0 3px' }, { translate: '0 0' }], { duration: 170, delay: GOLPE + cuando[i] });
    });
    const impacto = GOLPE + Math.max(...cuando);
    txt.animate([{ opacity: 0, transform: 'translateY(0.5rem)' }, { opacity: 1, transform: 'none' }], {
      duration: 320,
      delay: impacto + 60,
      fill: 'both',
    });
    saltar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500, fill: 'both' });

    await esperarO(impacto + 1400 + (llegadas.length > 1 ? 350 : 0), () => saltado);
    if (saltado) return;

    txt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    saltar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    velo.animate([{ opacity: 0.96 }, { opacity: 0 }], { duration: 600, delay: 120, easing: 'ease-in-out', fill: 'forwards' });
    await volar(unos, llegadas, aterrizar, () => saltado, bajar);
  } finally {
    salta(); // pase lo que pase, todos quedan en su puesto
    removeEventListener('wheel', frenar);
    removeEventListener('touchmove', frenar);
    removeEventListener('keydown', tecla);
    capa.remove();
    enCurso = false;
  }
}

/** Espera `ms`, o menos si `corta()` se vuelve verdadero. */
async function esperarO(ms: number, corta: () => boolean) {
  const fin = performance.now() + ms;
  while (performance.now() < fin && !corta()) await espera(50);
}

/** Cada sello vuela a su destino, que se mide en cada cuadro. */
function volar(
  unos: HTMLElement[],
  llegadas: Llegada[],
  aterrizar: (i: number) => void,
  saltado: () => boolean,
  bajar: boolean,
) {
  return new Promise<void>((listo) => {
    const D = 650, ESC = 80;
    const desde = unos.map((u) => {
      const r = u.firstElementChild!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    });
    // si el destino no se ve, la página baja lo justo, al mismo ritmo del vuelo
    let delta = 0;
    if (bajar) {
      const rs = llegadas.map((l) => l.destino()?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      if (rs.length) {
        const arriba = 16, abajo = innerHeight - 24;
        const tope = Math.min(...rs.map((r) => r.top)), fondo = Math.max(...rs.map((r) => r.bottom));
        if (fondo > abajo) delta = Math.min(fondo - abajo + 32, tope - arriba);
        else if (tope < arriba) delta = tope - arriba - 32;
      }
    }
    const y0 = scrollY, t0 = performance.now();
    const llegaron = new Set<number>();
    function cuadro(ahora: number) {
      if (saltado()) return listo();
      const t = ahora - t0;
      // 'instant': el scroll suave de la página haría que cada cuadro arranque una animación nueva
      if (delta) scrollTo({ top: y0 + delta * suave(Math.min(1, t / D)), behavior: 'instant' });
      unos.forEach((u, i) => {
        if (llegaron.has(i)) return;
        const k = Math.min(1, Math.max(0, (t - i * ESC) / D)), e = suave(k);
        const meta = llegadas[i].destino();
        if (meta) {
          const r = meta.getBoundingClientRect();
          const dx = r.left + r.width / 2 - desde[i].x, dy = r.top + r.height / 2 - desde[i].y;
          const s = 1 + ((r.width || desde[i].w) / desde[i].w - 1) * e;
          u.style.transform = `translate(${dx * e}px, ${dy * e}px) scale(${s})`;
        } else u.style.opacity = String(1 - e); // sin destino: se desvanece donde está
        if (k >= 1) {
          llegaron.add(i);
          u.style.visibility = 'hidden';
          aterrizar(i);
        }
      });
      if (llegaron.size < unos.length) requestAnimationFrame(cuadro);
      else listo();
    }
    requestAnimationFrame(cuadro);
  });
}
