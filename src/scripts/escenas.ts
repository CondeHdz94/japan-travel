// La ventana de escenas de anime de Lugares (el <dialog> lo pone src/components/Escenas.astro).
//
//   data-abrir-escenas="<id del lugar>"   botón que la abre («Ver escenas →» en la tarjeta)
//
// Las escenas de cada lugar se piden a /escenas/<id>.json al abrir (no van en la página).
// Las imágenes se muestran desde anitabi, como indica su documentación: la mediana (?plan=h360) para la
// escena grande y la pequeña (?plan=h160) para las miniaturas, con la fuente al lado. No se guardan
// copias. Sin sesión se ve todo menos las imágenes; si una no carga, el marco lleva a verla en anitabi.
// La ventana vive en la dirección (#escenas-<id>): se puede compartir, y «atrás» o Esc la cierran.

import { momento } from '../lib/momento';

interface Escena {
  id: string;
  punto: string;
  ep: string | null;
  s: number | null;
  parte: string | null;
  fuente: { autor: string; enlace: string };
  /** la captura en anitabi (sin tamaño: se pide con ?plan=) */
  imagen: string;
  estado: 'confirmada' | 'validada' | 'por-confirmar';
  confirmacion?: string;
  queda?: string;
}
interface Obra {
  serie: string;
  nombre: string;
  romaji?: string;
  estudio: string | null;
  dudoso?: boolean;
  escenas: Escena[];
}
interface Datos {
  lugar: { id: string; nombre: string; foto: string | null };
  aparte: string | null;
  obras: Obra[];
}

const PREFIJO = '#escenas-';
/** miniaturas que se ven de entrada en cada obra; el resto con «Ver las N escenas» */
const VISIBLES = 6;

const dlg = document.getElementById('escenas') as HTMLDialogElement | null;
if (dlg) iniciar(dlg);

function iniciar(dlg: HTMLDialogElement) {
  const angosto = matchMedia('(max-width: 640px)');
  const cache = new Map<string, Promise<Datos>>();
  let actual: Datos | null = null;
  let pedido = '';
  let quienAbrio: HTMLElement | null = null;
  // si la ventana la abrió un clic (y no la dirección), al cerrar se vuelve atrás en el historial
  let empujado = false;
  let cerrandoPorAtras = false;

  const conSesion = () => document.documentElement.dataset.sesion === 'si';
  const disponibles = () => new Set([...document.querySelectorAll<HTMLElement>('[data-abrir-escenas]')].map((b) => b.dataset.abrirEscenas!));
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const nEsc = (n: number) => `${n} ${n === 1 ? 'escena' : 'escenas'}`;
  const mapa = (punto: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(punto)}`;
  const suave = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // ── piezas ──
  const falta = (texto: string, chica: boolean) =>
    chica
      ? '<span class="es-falta es-miniatura"><b aria-hidden="true">聖</b></span>'
      : `<span class="es-falta"><b aria-hidden="true">聖</b><span>${texto}</span></span>`;

  /** La imagen de una escena; sin sesión, un marco que invita a entrar. Nada cambia de tamaño. */
  function imagen(e: Escena, chica: boolean, alt: string) {
    if (!conSesion())
      return chica
        ? falta('', true)
        : '<span class="es-falta"><b aria-hidden="true">聖</b><span>Las escenas se ven con sesión.</span><button type="button" data-entrar>Entra para verla</button></span>';
    return `<img src="${esc(e.imagen)}?plan=${chica ? 'h160' : 'h360'}" alt="${esc(alt)}" loading="lazy" decoding="async" data-enlace="${esc(e.fuente.enlace)}">`;
  }

  function bloque(o: Obra, oi: number, ei: number) {
    const e = o.escenas[ei];
    const cuando = momento(e);
    const estado =
      e.estado === 'confirmada' && e.confirmacion
        ? ` <a class="chip ok" href="${esc(e.confirmacion)}" target="_blank" rel="noopener noreferrer">Confirmada ↗</a>`
        : ' <span class="chip warn">Por confirmar</span>';
    const fila =
      o.escenas.length < 2
        ? ''
        : `<div class="es-fila">${o.escenas
            .map((x, j) => `<button type="button"${j >= VISIBLES ? ' class="oculta"' : ''} data-accion="cambia" data-oi="${oi}" data-ei="${j}" aria-current="${j === ei}" aria-label="Escena ${j + 1} de ${o.escenas.length}">${imagen(x, true, '')}</button>`)
            .join('')}</div>${o.escenas.length > VISIBLES ? `<button type="button" class="es-ver-todas" data-accion="ver-todas">Ver las ${o.escenas.length} escenas</button>` : ''}`;
    return `<div class="es-escena" data-oi="${oi}">
      <figure class="es-grande">${imagen(e, false, `Escena de ${o.nombre}`)}<figcaption><b>${esc(e.parte ?? o.nombre)}</b><span>${esc(cuando ?? '')}</span></figcaption></figure>
      <dl class="es-datos">
        <dt>Punto exacto</dt><dd><span lang="ja">${esc(e.punto)}</span>${estado} · <a href="${mapa(e.punto)}" target="_blank" rel="noopener noreferrer">Mapa ↗</a></dd>
        ${e.queda ? `<dt>Queda</dt><dd>${esc(e.queda)}</dd>` : ''}
      </dl>
      ${fila}
      <p class="es-fuente">Fuente: <a href="${esc(e.fuente.enlace)}" target="_blank" rel="noopener noreferrer">anitabi · ${esc(e.fuente.autor)} ↗</a> · ${o.estudio ? `Animación: ${esc(o.estudio)}` : 'Estudio por confirmar'}</p>
    </div>`;
  }

  const seccion = (o: Obra, oi: number) => `<section class="es-obra" data-oi="${oi}">
      <h3 tabindex="-1">${esc(o.nombre)}<small>${nEsc(o.escenas.length)}</small></h3>
      ${o.romaji ? `<p class="es-romaji">${esc(o.romaji)}</p>` : ''}
      ${o.dudoso ? '<p class="es-romaji"><span class="chip warn">Obra por confirmar</span></p>' : ''}
      ${bloque(o, oi, 0)}
    </section>`;

  const hoy = (d: Datos) =>
    d.lugar.foto
      ? `<div class="es-hoy"><img src="${esc(d.lugar.foto)}" alt=""><p><b>Hoy.</b> La foto del lugar. La de cada escena, desde el mismo ángulo, se toma en el viaje y aparecerá al lado de su escena.</p></div>`
      : '';

  const filaIndice = (o: Obra, oi: number, actualIdx: number | null) =>
    `<button type="button" data-accion="ir" data-oi="${oi}"${actualIdx === null ? '' : ` aria-current="${oi === actualIdx}"`}>${conSesion() ? imagen(o.escenas[0], true, '') : ''}<span><b>${esc(o.nombre)}</b><small>${nEsc(o.escenas.length)}</small></span></button>`;

  function pintar(d: Datos) {
    const n = d.obras.length;
    const total = d.obras.reduce((s, o) => s + o.escenas.length, 0);
    const sinFotos = conSesion() ? '' : ' sin-fotos';
    const arriba = `<div class="es-arriba"><span class="mono">聖地 · ${esc(d.lugar.nombre)}</span><button type="button" class="es-cerrar" data-accion="cerrar">Cerrar ✕</button></div>`;
    const titulo = `<h2 id="es-titulo">${n} ${n === 1 ? 'obra' : 'obras'}<small>${nEsc(total)}</small></h2>`;
    const secciones = d.obras.map(seccion).join('');
    let html: string;
    if (n < 2) html = arriba + titulo + hoy(d) + secciones;
    else if (!angosto.matches)
      html = `${arriba}${titulo}<div class="es-recorrido"><nav class="es-indice${sinFotos}" aria-label="Obras">${d.obras.map((o, i) => filaIndice(o, i, 0)).join('')}</nav><div class="es-feed">${hoy(d)}${secciones}</div></div>`;
    else
      html = `${arriba}${titulo}
        <div class="es-salto"><button type="button" class="es-salto-b" data-accion="indice" aria-expanded="false"><span><small>Viendo</small><b data-viendo>${esc(d.obras[0].nombre)}</b></span><span class="mono" data-n>1 de ${n} · Índice ▾</span></button></div>
        <nav class="es-indice es-emergente${sinFotos}" aria-label="Obras" hidden>${d.obras.map((o, i) => filaIndice(o, i, null)).join('')}</nav>
        ${hoy(d)}${secciones}`;
    dlg.innerHTML = `<div class="es-ficha">${html}</div>`;
    dlg.setAttribute('aria-labelledby', 'es-titulo');
    dlg.querySelector('.es-ficha')!.addEventListener('scroll', espiar, { passive: true });
  }

  // ── la obra que se está viendo: la marca el índice (escritorio) y la nombra la barra (celular) ──
  function espiar() {
    const ficha = dlg.querySelector<HTMLElement>('.es-ficha');
    if (!ficha || !actual || ficha.classList.contains('indice-abierto')) return;
    const salto = ficha.querySelector<HTMLElement>('.es-salto');
    const linea = (salto ? salto.getBoundingClientRect().bottom : ficha.getBoundingClientRect().top) + 24;
    const secs = [...ficha.querySelectorAll<HTMLElement>('.es-obra')];
    let i = 0;
    secs.forEach((s, j) => {
      if (s.getBoundingClientRect().top <= linea) i = j;
    });
    // al llegar al final, la última obra queda marcada aunque sea corta y no alcance a subir
    if (ficha.scrollTop + ficha.clientHeight >= ficha.scrollHeight - 4) i = secs.length - 1;
    // la obra que se escogió en el índice manda hasta que la persona vuelva a deslizar
    if (ficha.dataset.destino) i = Number(ficha.dataset.destino);
    const marcas = ficha.querySelectorAll<HTMLElement>('.es-recorrido > .es-indice [data-accion="ir"]');
    marcas.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    const marca = marcas[i];
    const indice = marca?.parentElement;
    if (marca && indice) {
      if (marca.offsetTop < indice.scrollTop) indice.scrollTop = marca.offsetTop;
      else if (marca.offsetTop + marca.offsetHeight > indice.scrollTop + indice.clientHeight)
        indice.scrollTop = marca.offsetTop + marca.offsetHeight - indice.clientHeight;
    }
    const viendo = ficha.querySelector('[data-viendo]');
    if (viendo) {
      viendo.textContent = actual.obras[i].nombre;
      ficha.querySelector('[data-n]')!.textContent = `${i + 1} de ${actual.obras.length} · Índice ▾`;
    }
  }

  // ── abrir y cerrar ──
  function cargar(id: string) {
    if (!cache.has(id))
      cache.set(
        id,
        fetch(`/escenas/${id}.json`).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<Datos>;
        }),
      );
    return cache.get(id)!;
  }

  async function abrir(id: string, desde: HTMLElement | null, empujar: boolean) {
    pedido = id;
    quienAbrio = desde;
    if (empujar) {
      history.pushState(null, '', `${location.pathname}${location.search}${PREFIJO}${id}`);
      empujado = true;
    }
    dlg.innerHTML = '<div class="es-ficha"><p class="es-cargando">Cargando las escenas…</p></div>';
    if (!dlg.open) dlg.showModal();
    try {
      const d = await cargar(id);
      if (pedido !== id || !dlg.open) return;
      actual = d;
      pintar(d);
      dlg.querySelector<HTMLElement>('.es-cerrar')?.focus();
    } catch {
      cache.delete(id);
      dlg.innerHTML = '<div class="es-ficha"><div class="es-arriba"><span class="mono">聖地</span><button type="button" class="es-cerrar" data-accion="cerrar">Cerrar ✕</button></div><p class="es-cargando">No se pudieron cargar las escenas. Revisa la conexión e intenta de nuevo.</p></div>';
    }
  }

  dlg.addEventListener('close', () => {
    pedido = '';
    actual = null;
    if (location.hash.startsWith(PREFIJO) && !cerrandoPorAtras) {
      // si la abrió un clic, «cerrar» es volver atrás; si llegó por la dirección, solo se limpia
      if (empujado) history.back();
      else history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    empujado = false;
    cerrandoPorAtras = false;
    quienAbrio?.focus();
    quienAbrio = null;
  });

  // «atrás» y «adelante» del navegador
  addEventListener('popstate', () => {
    const id = location.hash.startsWith(PREFIJO) ? location.hash.slice(PREFIJO.length) : '';
    if (id && disponibles().has(id)) {
      empujado = false;
      void abrir(id, null, false);
    } else if (dlg.open) {
      cerrandoPorAtras = true;
      dlg.close();
    }
  });

  // un enlace que ya trae #escenas-<id> abre la ventana de una
  {
    const id = location.hash.startsWith(PREFIJO) ? location.hash.slice(PREFIJO.length) : '';
    if (id && disponibles().has(id)) void abrir(id, null, false);
  }

  document.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>('[data-abrir-escenas]');
    if (b) void abrir(b.dataset.abrirEscenas!, b, true);
  });

  // ── lo que se toca dentro de la ventana ──
  dlg.addEventListener('click', (ev) => {
    const el = ev.target as Element;
    // clic en el fondo oscuro: cierra
    if (el === dlg) return dlg.close();
    // «Entra para verla»: se cierra la ventana y el registro (src/scripts/grupo.ts) se abre solo
    if (el.closest('[data-entrar]')) return dlg.close();
    const b = el.closest<HTMLElement>('[data-accion]');
    if (!b || !actual) {
      if (b?.dataset.accion === 'cerrar') dlg.close();
      return;
    }
    const ficha = dlg.querySelector<HTMLElement>('.es-ficha')!;
    switch (b.dataset.accion) {
      case 'cerrar':
        dlg.close();
        break;
      case 'cambia': {
        // otra escena de la misma obra, en el mismo sitio: no se redibuja nada más
        const oi = Number(b.dataset.oi);
        const viejo = b.closest<HTMLElement>('.es-escena')!;
        const todas = viejo.querySelector('.es-fila')?.classList.contains('todas');
        viejo.outerHTML = bloque(actual.obras[oi], oi, Number(b.dataset.ei));
        if (todas) {
          const fila = ficha.querySelector(`.es-escena[data-oi="${oi}"] .es-fila`);
          fila?.classList.add('todas');
          const ver = fila?.nextElementSibling;
          if (ver?.matches('.es-ver-todas')) ver.textContent = 'Ver menos';
        }
        break;
      }
      case 'ver-todas': {
        const fila = b.previousElementSibling!;
        const abierta = fila.classList.toggle('todas');
        b.textContent = abierta ? 'Ver menos' : `Ver las ${fila.children.length} escenas`;
        break;
      }
      case 'indice': {
        // celular: el índice reemplaza al recorrido mientras está abierto
        const lista = ficha.querySelector<HTMLElement>('.es-emergente')!;
        const abrirlo = lista.hidden;
        if (abrirlo) ficha.dataset.volver = String(ficha.scrollTop);
        lista.hidden = !abrirlo;
        ficha.classList.toggle('indice-abierto', abrirlo);
        b.setAttribute('aria-expanded', String(abrirlo));
        if (abrirlo) {
          ficha.querySelector('[data-n]')!.textContent = 'Cerrar índice ▴';
          ficha.scrollTop = ficha.querySelector<HTMLElement>('.es-salto')!.offsetTop;
        } else {
          ficha.scrollTop = Number(ficha.dataset.volver ?? 0);
          espiar();
        }
        break;
      }
      case 'ir': {
        const oi = Number(b.dataset.oi);
        const lista = ficha.querySelector<HTMLElement>('.es-emergente');
        if (lista && !lista.hidden) {
          lista.hidden = true;
          ficha.classList.remove('indice-abierto');
          ficha.querySelector('.es-salto-b')?.setAttribute('aria-expanded', 'false');
        }
        const sec = ficha.querySelector<HTMLElement>(`.es-obra[data-oi="${oi}"]`)!;
        const salto = ficha.querySelector<HTMLElement>('.es-salto');
        const borde = salto
          ? Math.max(salto.getBoundingClientRect().bottom, ficha.getBoundingClientRect().top + salto.offsetHeight)
          : ficha.getBoundingClientRect().top;
        ficha.dataset.destino = String(oi);
        const soltar = () => delete ficha.dataset.destino;
        for (const t of ['wheel', 'touchmove', 'keydown']) ficha.addEventListener(t, soltar, { once: true, passive: true });
        ficha.scrollTo({ top: ficha.scrollTop + sec.getBoundingClientRect().top - borde - 8, behavior: suave() });
        espiar();
        sec.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
        break;
      }
    }
  });

  // una imagen que no carga (anitabi no responde o la quitó): un marco del mismo tamaño que lleva a verla allá
  dlg.addEventListener(
    'error',
    (ev) => {
      const im = ev.target;
      if (!(im instanceof HTMLImageElement) || !im.closest('.es-ficha') || im.closest('.es-hoy')) return;
      const chica = !!im.closest('.es-fila, .es-indice');
      const t = document.createElement('template');
      const enlace = im.dataset.enlace ?? '';
      t.innerHTML = chica
        ? falta('', true)
        : `<span class="es-falta"><b aria-hidden="true">聖</b><span>No se pudo cargar la imagen.</span><a href="${esc(enlace)}" target="_blank" rel="noopener noreferrer">Ver la escena en anitabi ↗</a></span>`;
      im.replaceWith(t.content);
    },
    true,
  );

  // si cambia el ancho (girar el celular), se vuelve a pintar con la forma que toca
  angosto.addEventListener('change', () => {
    if (dlg.open && actual) pintar(actual);
  });

  // abierta desde un enlace, la ventana puede pintarse antes de que se sepa si hay sesión: cuando se
  // sabe, se vuelve a pintar (con imágenes o con «Entra para verla»), en la misma obra
  new MutationObserver(() => {
    if (!dlg.open || !actual) return;
    const ficha = dlg.querySelector<HTMLElement>('.es-ficha');
    const donde = ficha?.scrollTop ?? 0;
    pintar(actual);
    const nueva = dlg.querySelector<HTMLElement>('.es-ficha');
    if (nueva) nueva.scrollTop = donde;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sesion'] });
}
