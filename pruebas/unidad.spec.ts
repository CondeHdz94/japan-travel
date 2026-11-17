// Funciones puras y coherencia de los datos: no necesitan servidor ni navegador.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SEMILLAS, TEMAS, TEMPORADAS, ZONAS, etiquetaMeses } from '../src/data/lugares';
import { secciones } from '../src/data/secciones';
import { kana, primeraKana } from '../src/scripts/kana';
import { ESCENAS, momento, resumenTarjeta } from '../src/data/escenas';
import { escribirDireccion, leerDireccion, pasa, queDejaVacio, sinFiltros, textoMenu } from '../src/scripts/filtros';

const fotos: Record<string, { archivo: string; autor: string; licencia: string; fuente: string }> =
  JSON.parse(readFileSync('src/data/fotos.json', 'utf8'));

test.describe('kana: nombres en katakana', () => {
  const casos: [string, string][] = [
    ['Ana', 'アナ'],
    ['Camilo', 'カミロ'],
    ['Juan', 'フアン'],
    ['José', 'ホセ'],
    ['Sofía', 'ソフィア'],
    ['Andrés', 'アンドレス'],
    ['Chucho', 'チュチョ'],
    ['Quique', 'キケ'],
    ['Guillermo', 'ギイェルモ'],
    ['Gina', 'ヒナ'],
    ['Hugo', 'ウゴ'],
    ['Ximena', 'ヒメナ'],
    ['Álex', 'アレクス'],
    ['Valentina', 'バレンティナ'],
    ['Zulma', 'スルマ'],
    ['Wilson', 'ウィルソン'],
    ['Yeison', 'イェイソン'],
    ['Philip', 'フィリプ'],
    ['Anna', 'アナ'],
  ];
  for (const [nombre, esperado] of casos)
    test(`${nombre} → ${esperado}`, () => expect(kana(nombre)).toBe(esperado));

  test('la ñ suena a ñ, no a n', () => {
    expect(kana('Ñoño')).toBe('ニョニョ');
    expect(kana('Toño')).toBe('トニョ');
    expect(kana('Begoña')).toBe('ベゴニャ');
    expect(primeraKana('Ñato')).toBe('ニャ');
  });

  test('da igual mayúsculas, tildes o espacios de sobra', () => {
    expect(kana('JOSÉ')).toBe(kana('jose'));
    expect(kana('  Ana   María ')).toBe('アナ・マリア');
  });

  test('varias palabras van separadas por punto medio', () => {
    expect(kana('Juan Camilo')).toBe('フアン・カミロ');
  });

  test('lo que no se puede transcribir queda vacío, sin romperse', () => {
    for (const raro of ['', '   ', '123', '李', '🙂', '<>', '--']) {
      expect(kana(raro), JSON.stringify(raro)).toBe('');
      expect(primeraKana(raro), JSON.stringify(raro)).toBe('');
    }
  });

  test('mezcla de letras y símbolos: se queda con las letras', () => {
    expect(kana('Ana2')).toBe('アナ');
    expect(kana('123 Ana')).toBe('アナ');
  });

  test('primeraKana es la primera sílaba del primer nombre', () => {
    expect(primeraKana('Camilo')).toBe('カ');
    expect(primeraKana('Juan Camilo')).toBe('フ');
    expect(primeraKana('Andrés')).toBe('ア');
    expect(primeraKana('Chucho')).toBe('チュ');
    expect(primeraKana('Tito')).toBe('ティ');
  });

  test('todo nombre con letras latinas tiene sello en kana', () => {
    for (const n of ['Al', 'Bo', 'Cy', 'Xi', 'Ng', 'Sr', 'Ll', 'Ch', 'Hh', 'Ty'])
      expect(kana(n).length > 0 || primeraKana(n) === '', n).toBeTruthy();
  });
});

test.describe('etiquetaMeses', () => {
  const casos: [number[], string][] = [
    [[], 'Todo el año'],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'Todo el año'],
    [[7], 'Jul'],
    [[3, 4, 5], 'Mar–May'],
    [[10, 11], 'Oct–Nov'],
    [[12, 1, 2], 'Dic–Feb'],
    [[11, 12, 1, 2, 3], 'Nov–Mar'],
    [[2, 1, 12], 'Dic–Feb'],
    [[1, 5, 9], 'Ene · May · Sep'],
    [[9, 1, 5], 'Ene · May · Sep'],
    [[1, 3, 5, 7, 9], 'Varias fechas'],
    [[4, 4], 'Abr'],
  ];
  for (const [meses, esperado] of casos)
    test(`[${meses}] → ${esperado}`, () => expect(etiquetaMeses(meses)).toBe(esperado));

  test('las temporadas del filtro dan etiquetas de rango', () => {
    expect(TEMPORADAS.map((t) => etiquetaMeses(t.meses))).toEqual([
      'Mar–May',
      'Jun–Sep',
      'Oct–Nov',
      'Dic–Feb',
    ]);
  });
});

test.describe('catálogo de lugares', () => {
  test('el README dice 116 lugares', () => {
    expect(SEMILLAS.length).toBe(116);
  });

  test('ids únicos y con forma que la API de marcas acepta', () => {
    const ids = SEMILLAS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9-]{1,32}$/);
  });

  test('ningún id se confunde con el de un lugar propuesto (u + número)', () => {
    expect(SEMILLAS.filter((l) => /^u\d+$/.test(l.id)).map((l) => l.id)).toEqual([]);
  });

  test('ningún id choca con otro id de la página (temas, diálogos, filtros)', () => {
    const reservados = [
      ...TEMAS.map((t) => t.id),
      ...['quien', 'registro', 'perfil', 'proponer', 'vacio', 'limpiar', 'novedad', 'intro'],
      ...['f-zona', 'f-temp', 'f-mios', 'f-total', 'registro-t', 'perfil-t', 'proponer-t'],
    ];
    expect(new Set(reservados).size).toBe(reservados.length);
    expect(SEMILLAS.filter((l) => reservados.includes(l.id)).map((l) => l.id)).toEqual([]);
  });

  test('cada lugar tiene tema y zona que existen, nombre y descripción', () => {
    const temas = new Set(TEMAS.map((t) => t.id));
    const zonas = new Set(ZONAS.map((z) => z.id));
    for (const l of SEMILLAS) {
      expect(temas.has(l.tema), `${l.id}: tema ${l.tema}`).toBe(true);
      expect(zonas.has(l.zona), `${l.id}: zona ${l.zona}`).toBe(true);
      expect(l.nombre.trim().length, `${l.id}: nombre`).toBeGreaterThan(1);
      expect(l.desc.trim().length, `${l.id}: descripción`).toBeGreaterThan(10);
    }
  });

  test('los meses son de 1 a 12, sin repetir y nunca una lista vacía', () => {
    for (const l of SEMILLAS) {
      if (!l.meses) continue;
      expect(l.meses.length, l.id).toBeGreaterThan(0);
      expect(new Set(l.meses).size, l.id).toBe(l.meses.length);
      for (const m of l.meses) expect(Number.isInteger(m) && m >= 1 && m <= 12, `${l.id}: ${m}`).toBe(true);
    }
  });

  test('todos los temas tienen lugares y todas las zonas se usan', () => {
    for (const t of TEMAS) expect(SEMILLAS.some((l) => l.tema === t.id), t.id).toBe(true);
    for (const z of ZONAS) expect(SEMILLAS.some((l) => l.zona === z.id), z.id).toBe(true);
  });

  test('temas, zonas y temporadas: ids únicos', () => {
    for (const lista of [TEMAS, ZONAS, TEMPORADAS]) {
      const ids = lista.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('las temporadas cubren los doce meses sin pisarse', () => {
    const todos = TEMPORADAS.flatMap((t) => t.meses).sort((a, b) => a - b);
    expect(todos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

test.describe('fotos del catálogo', () => {
  const enDisco = existsSync('public/lugares') ? readdirSync('public/lugares') : [];

  // Pendientes conocidos: el script no encontró foto libre para estos. Si aparece otro, avisa.
  const SIN_FOTO = ['fuji-speedway', 'nagoro'];

  test('cada lugar del catálogo tiene foto y crédito (salvo los pendientes conocidos)', () => {
    expect(SEMILLAS.filter((l) => !fotos[l.id]).map((l) => l.id)).toEqual(SIN_FOTO);
  });

  test('cada crédito apunta a un archivo que existe', () => {
    const faltan = Object.entries(fotos)
      .filter(([, f]) => !enDisco.includes(f.archivo))
      .map(([id]) => id);
    expect(faltan).toEqual([]);
  });

  test('cada crédito trae autor, licencia y fuente https', () => {
    for (const [id, f] of Object.entries(fotos)) {
      expect(f.autor?.trim().length, `${id}: autor`).toBeGreaterThan(0);
      expect(f.licencia?.trim().length, `${id}: licencia`).toBeGreaterThan(0);
      expect(f.fuente, `${id}: fuente`).toMatch(/^https:\/\//);
    }
  });

  test('no hay créditos ni archivos huérfanos', () => {
    const ids = new Set(SEMILLAS.map((l) => l.id));
    expect(Object.keys(fotos).filter((id) => !ids.has(id))).toEqual([]);
    const usados = new Set(Object.values(fotos).map((f) => f.archivo));
    expect(enDisco.filter((a) => !usados.has(a))).toEqual([]);
  });
});

test.describe('secciones', () => {
  test('siete, numeradas en orden, cuatro abiertas', () => {
    expect(secciones.map((s) => s.n)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
    expect(secciones.filter((s) => s.href).map((s) => s.href)).toEqual([
      '/cuando-ir',
      '/requisitos',
      '/lugares',
      '/decisiones',
    ]);
  });
});

test.describe('escenas de anime', () => {
  const lugares = Object.entries(ESCENAS);
  const escenas = lugares.flatMap(([, l]) => l.obras.flatMap((o) => o.escenas));

  test('cada lugar con escenas existe en el catálogo y tiene al menos una obra', () => {
    const ids = new Set(SEMILLAS.map((l) => l.id));
    for (const [id, l] of lugares) {
      expect(ids.has(id), `${id} no está en el catálogo`).toBe(true);
      expect(l.obras.length, id).toBeGreaterThan(0);
    }
  });

  test('ningún nombre de obra va en letra japonesa', () => {
    const japones = /[぀-ヿ㐀-鿿]/;
    for (const [, l] of lugares)
      for (const o of l.obras) {
        expect(o.nombre, o.nombre).not.toMatch(japones);
        if (o.romaji) expect(o.romaji, o.romaji).not.toMatch(japones);
      }
  });

  test('las obras van de la que más escenas tiene en el lugar a la que menos', () => {
    for (const [id, l] of lugares) {
      const n = l.obras.map((o) => o.escenas.length);
      expect(n, id).toEqual([...n].sort((a, b) => b - a));
    }
  });

  test('dentro de cada obra van primero las más verificadas: confirmada, validada, por confirmar', () => {
    const nivel = { confirmada: 2, validada: 1, 'por-confirmar': 0 } as const;
    const fijadas: Record<string, string> = JSON.parse(readFileSync('src/data/escenas-revision.json', 'utf8')).principal ?? {};
    for (const [id, l] of lugares)
      for (const o of l.obras) {
        // una escena fijada a mano como principal va primera aunque esté menos verificada
        const desde = fijadas[`${id}/${o.serie}`] === o.escenas[0].id ? 1 : 0;
        const n = o.escenas.slice(desde).map((e) => nivel[e.estado]);
        expect(n, `${id}: ${o.nombre}`).toEqual([...n].sort((a, b) => b - a));
      }
  });

  test('una obra no se repite en un mismo lugar, y el rōmaji solo va si es distinto', () => {
    for (const [id, l] of lugares) {
      expect(new Set(l.obras.map((o) => o.serie)).size, id).toBe(l.obras.length);
      for (const o of l.obras) expect(o.romaji, `${id}: ${o.nombre}`).not.toBe(o.nombre);
    }
  });

  test('cada escena trae su fuente con enlace https y un id único', () => {
    for (const e of escenas) {
      expect(e.fuente.autor.trim().length, e.id).toBeGreaterThan(0);
      expect(e.fuente.enlace, e.id).toMatch(/^https:\/\//);
      expect(e.id).toMatch(/^\d+-\w+$/);
    }
    expect(new Set(escenas.map((e) => e.id)).size).toBe(escenas.length);
  });

  test('cada obra tiene estudio, salvo las marcadas como dudosas', () => {
    for (const [, l] of lugares) for (const o of l.obras) if (!o.dudoso) expect(o.estudio, o.nombre).toBeTruthy();
  });

  test('una escena confirmada trae el enlace que la confirma', () => {
    for (const e of escenas.filter((x) => x.estado === 'confirmada')) expect(e.confirmacion, e.id).toMatch(/^https:\/\//);
  });

  test('resumen de la tarjeta y momento de la escena', () => {
    const r = resumenTarjeta(lugares[0][0])!;
    expect(r.obras).toBe(lugares[0][1].obras.length);
    expect(r.nombres.length).toBe(Math.min(2, r.obras));
    expect(resumenTarjeta('no-existe')).toBeNull();
    expect(momento({ ep: '7', s: 946 })).toBe('Ep 7 · 15:46');
    expect(momento({ ep: 'ED2', s: 45 })).toBe('ED2 · 0:45');
    expect(momento({ ep: null, s: null })).toBeNull();
  });
});

test('escenas: cada imagen es una dirección de anitabi sin tamaño (la ventana le pone ?plan=)', () => {
  for (const l of Object.values(ESCENAS))
    for (const o of l.obras)
      for (const e of o.escenas) {
        expect(e.original, e.id).toMatch(/^https:\/\/image\.anitabi\.cn\/[^?&#]+$/);
      }
});

test.describe('filtros de Lugares', () => {
  const lugar = (zona: string, meses: number[] | null = null, mio = false, escenas = false) => ({ zona, meses, mio, escenas });
  const f = (cambios: Partial<ReturnType<typeof sinFiltros>>) => ({ ...sinFiltros(), ...cambios });

  test('dentro de un filtro se suman las opciones', () => {
    const filtro = f({ zona: ['tokio', 'norte'] });
    expect(pasa(lugar('tokio'), filtro)).toBe(true);
    expect(pasa(lugar('norte'), filtro)).toBe(true);
    expect(pasa(lugar('kansai'), filtro)).toBe(false);
    const temporadas = f({ temp: ['verano', 'invierno'] });
    expect(pasa(lugar('tokio', [7]), temporadas)).toBe(true);
    expect(pasa(lugar('tokio', [2]), temporadas)).toBe(true);
    expect(pasa(lugar('tokio', [4]), temporadas)).toBe(false);
  });

  test('entre filtros se cruzan, y un lugar de todo el año no se esconde por la temporada', () => {
    const filtro = f({ zona: ['tokio', 'norte'], temp: ['verano'], anime: true });
    expect(pasa(lugar('tokio', null, false, true), filtro)).toBe(true);
    expect(pasa(lugar('tokio', null, false, false), filtro)).toBe(false);
    expect(pasa(lugar('tokio', [4], false, true), filtro)).toBe(false);
    expect(pasa(lugar('kansai', null, false, true), filtro)).toBe(false);
    expect(pasa(lugar('tokio'), f({ mios: true }))).toBe(false);
    expect(pasa(lugar('tokio', null, true), f({ mios: true }))).toBe(true);
    expect(pasa(lugar('sur', [1]), sinFiltros())).toBe(true);
  });

  test('la dirección: listas, enlaces viejos de un valor y valores desconocidos', () => {
    expect(leerDireccion('?zona=norte,tokio&t=invierno,verano&mios=1&anime=1')).toEqual({
      // en el orden del catálogo, no en el de la dirección
      zona: ['tokio', 'norte'], temp: ['verano', 'invierno'], mios: true, anime: true,
    });
    expect(leerDireccion('?t=otono')).toEqual(f({ temp: ['otono'] }));
    expect(leerDireccion('?zona=marte,tokio,tokio&t=nunca&mios=si&otra=<script>')).toEqual(f({ zona: ['tokio'] }));
    expect(leerDireccion('')).toEqual(sinFiltros());
    expect(escribirDireccion(f({ zona: ['tokio', 'norte'], temp: ['verano'], anime: true }))).toBe('?zona=tokio,norte&t=verano&anime=1');
    expect(escribirDireccion(sinFiltros())).toBe('');
    const ida = f({ zona: ['kanto', 'sur'], temp: ['primavera'], mios: true });
    expect(leerDireccion(escribirDireccion(ida))).toEqual(ida);
  });

  test('sin resultados dice qué filtros dejan la lista vacía', () => {
    expect(queDejaVacio(f({ anime: true, zona: ['norte'] }))).toBe('Ningún lugar que salga en anime en Norte.');
    expect(queDejaVacio(f({ zona: ['tokio', 'kanto', 'norte'], temp: ['verano', 'invierno'] }))).toBe(
      'Ningún lugar en Tokio, Cerca de Tokio o Norte en verano o invierno.',
    );
    expect(queDejaVacio(f({ mios: true }))).toBe('Ningún lugar con tu sello.');
    expect(queDejaVacio(sinFiltros())).toBe('No hay nada con ese filtro.');
  });

  test('el texto de los menús', () => {
    expect(textoMenu('zona', [])).toBe('Todas las zonas');
    expect(textoMenu('zona', ['kansai'])).toBe('Kioto y Osaka');
    expect(textoMenu('zona', ['tokio', 'norte'])).toBe('Zona · 2');
    expect(textoMenu('temp', [])).toBe('Todo el año');
    expect(textoMenu('temp', ['otono'])).toBe('En otoño');
    expect(textoMenu('temp', ['otono', 'verano'])).toBe('Temporada · 2');
  });
});
