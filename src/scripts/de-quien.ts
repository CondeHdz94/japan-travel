// De quién es un sello: al tocarlo (o hacerle clic) sale una etiqueta encima con el nombre y su
// katakana. En celular no hay `title`, y en muchos sitios el sello va sin nombre al lado.
//
// Flota sobre la página (no mueve nada), sigue al sello si hay scroll y se cierra al tocar fuera,
// con Escape, si el sello deja de verse o al cambiar el tamaño. Nunca queda encima de una barra
// pegada a la pantalla (los filtros de Lugares): sale debajo del sello o se cierra. Los sellos que ya hacen otra cosa al tocarlos no la muestran: el mío en
// la cabecera (abre el perfil), las muestras del perfil (escogen forma o color) y los que caen
// en una llegada.

const NO_APLICA = 'button, label, a, .llegada';

let etiqueta: HTMLElement | null = null;
let de: HTMLElement | null = null;

function cerrar() {
  etiqueta?.remove();
  etiqueta = null;
  de = null;
}

function abrir(sello: HTMLElement) {
  cerrar();
  const nombre = sello.dataset.nombre;
  if (!nombre) return;
  de = sello;
  etiqueta = document.createElement('div');
  etiqueta.className = 'de-quien';
  etiqueta.setAttribute('role', 'status');
  const n = document.createElement('strong');
  n.textContent = nombre;
  etiqueta.append(n);
  if (sello.dataset.katakana) {
    const k = document.createElement('span');
    k.lang = 'ja';
    k.textContent = sello.dataset.katakana;
    etiqueta.append(k);
  }
  if (sello.classList.contains('fantasma')) {
    const f = document.createElement('small');
    f.textContent = 'Falta';
    etiqueta.append(f);
  }
  document.body.append(etiqueta);
  ubicar();
}

/** ¿En ese punto hay algo pegado a la pantalla (una barra sticky o fixed, como los filtros de Lugares)? */
function pegado(x: number, y: number): boolean {
  for (let el = document.elementFromPoint(x, y); el && el !== document.body; el = el.parentElement) {
    const p = getComputedStyle(el).position;
    if (p === 'sticky' || p === 'fixed') return true;
  }
  return false;
}

/** ¿Se ve el sello? Fuera de la pantalla, debajo de una barra o recortado por su franja: no. */
function seVe(sello: HTMLElement): boolean {
  const s = sello.getBoundingClientRect();
  const x = s.left + s.width / 2;
  const y = s.top + s.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  // la etiqueta no recibe el puntero, así que no estorba la consulta; otro sello montado encima
  // del mío sí cuenta como visible (es el mismo grupo de sellos)
  return !!document.elementFromPoint(x, y)?.closest('.sello-p');
}

/**
 * Encima del sello y centrada; si arriba no cabe o hay una barra pegada (los filtros de Lugares),
 * debajo. Nunca se sale por los lados.
 */
function ubicar() {
  if (!etiqueta || !de) return;
  const s = de.getBoundingClientRect();
  const e = etiqueta.getBoundingClientRect();
  const margen = 12;
  const centro = s.left + s.width / 2;
  const x = Math.min(Math.max(centro - e.width / 2, margen), innerWidth - e.width - margen);
  const techo = s.top - e.height - 10;
  const arriba = techo >= margen && !pegado(x + e.width / 2, techo) && !pegado(x + 4, techo) && !pegado(x + e.width - 4, techo);
  const y = arriba ? s.top - e.height - 10 : s.bottom + 10;
  etiqueta.style.left = `${x + scrollX}px`;
  etiqueta.style.top = `${y + scrollY}px`;
  // la flecha apunta al sello aunque la etiqueta se haya corrido para caber
  etiqueta.style.setProperty('--flecha', `${centro - x}px`);
  etiqueta.dataset.lado = arriba ? 'arriba' : 'abajo';
}

document.addEventListener('click', (ev) => {
  const sello = (ev.target as Element).closest<HTMLElement>('.sello-p');
  if (sello && !sello.closest(NO_APLICA) && sello.dataset.nombre) {
    if (sello === de) cerrar();
    else abrir(sello);
    return;
  }
  if (!etiqueta?.contains(ev.target as Node)) cerrar();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') cerrar();
});
// Al hacer scroll (la página o una franja que se desliza, como los meses) la etiqueta sigue al
// sello; si el sello deja de verse (sale de la pantalla o pasa debajo de una barra pegada, como
// los filtros de Lugares), se cierra. No se cierra con cualquier scroll: en el
// celular el dedo sigue moviendo un poco la página justo después de tocar.
addEventListener(
  'scroll',
  () => {
    if (!de) return;
    if (seVe(de)) ubicar();
    else cerrar();
  },
  { passive: true, capture: true },
);
addEventListener('resize', cerrar);
// si el sello se va (llegan votos y se repinta), la etiqueta no se queda flotando sola
new MutationObserver(() => {
  if (de && !de.isConnected) cerrar();
}).observe(document.body, { childList: true, subtree: true });
