// Transcripción aproximada de un nombre en español a katakana, por sonido.
// No es perfecta (el japonés no tiene todos nuestros sonidos), pero es como se
// escribiría el nombre en un hanko.

const V = 'aiueo';
const VOCAL = ['ア', 'イ', 'ウ', 'エ', 'オ'];

// consonante → sílabas con a, i, u, e, o
const FILAS: Record<string, string[]> = {
  k: ['カ', 'キ', 'ク', 'ケ', 'コ'],
  s: ['サ', 'シ', 'ス', 'セ', 'ソ'],
  t: ['タ', 'ティ', 'トゥ', 'テ', 'ト'],
  n: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  h: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  m: ['マ', 'ミ', 'ム', 'メ', 'モ'],
  y: ['ヤ', 'イ', 'ユ', 'イェ', 'ヨ'],
  r: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  l: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  g: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  d: ['ダ', 'ディ', 'ドゥ', 'デ', 'ド'],
  b: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  p: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  f: ['ファ', 'フィ', 'フ', 'フェ', 'フォ'],
  w: ['ワ', 'ウィ', 'ウ', 'ウェ', 'ウォ'],
  C: ['チャ', 'チ', 'チュ', 'チェ', 'チョ'], // ch
  N: ['ニャ', 'ニ', 'ニュ', 'ニェ', 'ニョ'], // ñ
};

// consonante suelta (sin vocal después)
const SUELTA: Record<string, string> = {
  n: 'ン', m: 'ン', N: 'ン', t: 'ト', d: 'ド', C: 'チ',
  k: 'ク', s: 'ス', h: 'フ', r: 'ル', l: 'ル', g: 'グ', b: 'ブ', p: 'プ', f: 'フ', w: 'ウ', y: 'イ',
};

/** Pasa la ortografía española a una cadena de sonidos simples. */
function sonidos(palabra: string): string {
  return palabra
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'N') // ñ
    .replace(/[̀-ͯ]/g, '') // tildes
    .replace(/[^a-zN]/g, '')
    .replace(/ch/g, 'C')
    .replace(/ph/g, 'f')
    .replace(/h/g, '') // la h es muda
    .replace(/ll/g, 'y')
    .replace(/rr/g, 'r')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/q/g, 'k')
    .replace(/gu(?=[ei])/g, 'G') // gue, gui: g dura
    .replace(/g(?=[ei])/g, 'h') // ge, gi: suena a j
    .replace(/G/g, 'g')
    .replace(/j/g, 'h')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/^x/, 'h') // Ximena suena a Jimena
    .replace(/x/g, 'ks')
    .replace(/y(?![aiueo])/g, 'i') // y final o antes de consonante
    .replace(/([^aiueo])\1/g, '$1'); // consonantes dobles
}

/** Sílabas en katakana de una palabra. */
function silabas(palabra: string): string[] {
  const s = sonidos(palabra);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const v = V.indexOf(ch);
    if (v >= 0) {
      out.push(VOCAL[v]);
      continue;
    }
    const sig = i + 1 < s.length ? V.indexOf(s[i + 1]) : -1;
    if (sig >= 0 && FILAS[ch]) {
      out.push(FILAS[ch][sig]);
      i++;
    } else if (SUELTA[ch]) {
      out.push(SUELTA[ch]);
    }
  }
  return out;
}

/** Nombre completo en katakana; las palabras se separan con un punto medio. */
export function kana(nombre: string): string {
  return nombre
    .split(/\s+/)
    .map((p) => silabas(p).join(''))
    .filter(Boolean)
    .join('・');
}

/** Primera sílaba en katakana, para el sello. Vacío si el nombre no se puede transcribir. */
export function primeraKana(nombre: string): string {
  return silabas(nombre.split(/\s+/)[0] ?? '')[0] ?? '';
}
