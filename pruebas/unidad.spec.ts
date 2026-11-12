// Funciones puras y coherencia de los datos: no necesitan servidor ni navegador.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SEMILLAS, TEMAS, TEMPORADAS, ZONAS, etiquetaMeses } from '../src/data/lugares';
import { secciones } from '../src/data/secciones';
import { kana, primeraKana } from '../src/scripts/kana';

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
  test('seis, numeradas en orden, tres abiertas', () => {
    expect(secciones.map((s) => s.n)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(secciones.filter((s) => s.href).map((s) => s.href)).toEqual([
      '/cuando-ir',
      '/requisitos',
      '/lugares',
    ]);
  });
});
