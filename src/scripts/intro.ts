// Entrada del cuaderno. Una sola línea de tiempo (ms) mueve tres capas:
// la ruta en SVG, la tinta bermellón en WebGL y el kanji 旅 en DOM.

const KM = 14400;

// tiempos, en ms desde que arranca
const SOL = [200, 1000]; // el sol sale en el destino
const RUTA = [450, 2050]; // se entinta la ruta y corre el contador
const LLENA = [2150, 2950]; // el sol se riega hasta cubrir la pantalla
const KANJI = [2700, 3200]; // aparece 旅
const CIERRA = [3750, 4700]; // la tinta se recoge en el sello de la cabecera

const FRAG = `
precision highp float;
uniform vec2 u_res, u_c, u_half;
uniform float u_round, u_rot, u_amp, u_t, u_dpr;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr; // px de CSS, y hacia abajo
  vec2 q = p - u_c;
  float cs = cos(u_rot), sn = sin(u_rot);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);

  // caja redondeada: con u_round == u_half es un círculo
  vec2 b = abs(q) - u_half + u_round;
  float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - u_round;

  // el borde sangra como tinta en papel: una onda ancha y fibra fina
  float ancho = fbm(p * 0.011 + u_t * 0.12) - 0.5;
  float fino = fbm(p * 0.07 - u_t * 0.08) - 0.5;
  d += (ancho * 1.7 + fino * 0.45) * u_amp;

  float a = smoothstep(0.75, -0.75, d);
  // la tinta se carga un poco en la orilla
  float orilla = smoothstep(-16.0, 0.0, d) * min(u_amp / 8.0, 1.0);
  vec3 shu = vec3(0.8235, 0.2235, 0.1216);
  vec3 col = mix(shu, shu * 0.8, orilla * 0.55);
  gl_FragColor = vec4(col * a, a);
}`;

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const tramo = (t: number, [a, b]: number[]) => clamp01((t - a) / (b - a));
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const outBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const mix = (a: number, b: number, x: number) => a + (b - a) * x;
const mixExp = (a: number, b: number, x: number) => Math.exp(mix(Math.log(a), Math.log(b), x));
const suave = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function prepararGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const prog = gl.createProgram()!;
  for (const [tipo, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const sh = gl.createShader(tipo)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  return {
    gl,
    res: u('u_res'),
    c: u('u_c'),
    half: u('u_half'),
    round: u('u_round'),
    rot: u('u_rot'),
    amp: u('u_amp'),
    t: u('u_t'),
    dpr: u('u_dpr'),
  };
}

export async function reproducir(el: HTMLElement) {
  const raiz = document.documentElement;
  const canvas = el.querySelector('canvas')!;
  const hanko = document.querySelector<HTMLElement>('.top .hanko');
  const g = prepararGL(canvas);

  let acabado = false;
  const acabar = () => {
    if (acabado) return;
    acabado = true;
    raiz.dataset.intro = 'sale';
    try {
      sessionStorage.setItem('intro', '1');
    } catch {}
    g?.gl.getExtension('WEBGL_lose_context')?.loseContext();
    el.remove();
    removeEventListener('resize', medir);
    removeEventListener('keydown', tecla);
  };
  if (!g || !hanko) return acabar();

  const papel = el.querySelector<HTMLElement>('.papel')!;
  const guia = el.querySelector<SVGPathElement>('.guia')!;
  const trazo = el.querySelector<SVGPathElement>('.trazo')!;
  const origen = el.querySelector<SVGCircleElement>('.origen')!;
  const punta = el.querySelector<SVGCircleElement>('.punta')!;
  const km = el.querySelector<HTMLElement>('.km strong')!;
  const tabi = el.querySelector<HTMLElement>('.tabi')!;

  // geometría, en px de CSS
  let w = 0, h = 0, dpr = 1, largo = 0;
  let O = { x: 0, y: 0 }, S = { x: 0, y: 0 }, H = { x: 0, y: 0 };
  let R = 0, cubre = 0, hMedio = 0, hLetra = 0, F = 0;

  function medir() {
    // sin la barra de scroll: es el área que de verdad cubre la capa fija
    w = raiz.clientWidth;
    h = raiz.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const alto = h > w;
    O = { x: w * (alto ? 0.18 : 0.17), y: h * 0.66 };
    S = { x: w * (alto ? 0.68 : 0.74), y: h * (alto ? 0.27 : 0.34) };
    R = Math.min(w, h) * (alto ? 0.15 : 0.13);
    cubre = Math.max(...[0, w].flatMap((x) => [0, h].map((y) => Math.hypot(x - S.x, y - S.y)))) + 80;
    F = Math.min(w, h) * 0.36;

    const r = hanko!.getBoundingClientRect();
    H = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    hMedio = hanko!.offsetWidth / 2;
    hLetra = parseFloat(getComputedStyle(hanko!).fontSize);

    // un arco de vuelo: sube por encima del sol y cae sobre él
    const C = { x: mix(O.x, S.x, 0.38), y: Math.min(O.y, S.y) - h * 0.2 };
    const d = `M${O.x} ${O.y} Q${C.x} ${C.y} ${S.x} ${S.y}`;
    guia.setAttribute('d', d);
    trazo.setAttribute('d', d);
    origen.setAttribute('cx', `${O.x}`);
    origen.setAttribute('cy', `${O.y}`);
    largo = trazo.getTotalLength();
    trazo.style.strokeDasharray = `${largo}`;

    el.style.setProperty('--ox', `${O.x}px`);
    el.style.setProperty('--oy', `${O.y}px`);
    el.style.setProperty('--sx', `${S.x}px`);
    el.style.setProperty('--sy', `${S.y}px`);
    el.style.setProperty('--r', `${R}px`);
    el.style.setProperty('--f', `${F}px`);
    tabi.style.fontSize = `${F}px`;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g!.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function pintar(c: { x: number; y: number }, mx: number, round: number, rot: number, amp: number, t: number) {
    const { gl } = g!;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (mx < 0.5) return;
    gl.uniform2f(g!.res, canvas.width, canvas.height);
    gl.uniform2f(g!.c, c.x, c.y);
    gl.uniform2f(g!.half, mx, mx);
    gl.uniform1f(g!.round, round);
    gl.uniform1f(g!.rot, rot);
    gl.uniform1f(g!.amp, amp);
    gl.uniform1f(g!.t, t / 1000);
    gl.uniform1f(g!.dpr, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let saltando = false;
  function saltar() {
    if (saltando || acabado || el.classList.contains('cierra')) return;
    saltando = true;
    raiz.dataset.intro = 'sale';
    el.classList.add('viva');
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(acabar, 360);
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') saltar();
  }

  medir();
  trazo.style.strokeDashoffset = `${largo}`;
  punta.style.opacity = '0';
  addEventListener('resize', medir);
  addEventListener('keydown', tecla);
  el.querySelector('.saltar')!.addEventListener('click', saltar);

  // sin la Mincho cargada el kanji y los rótulos saltarían a mitad de la entrada
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  medir();
  el.classList.add('ya');

  const t0 = performance.now();
  function cuadro(ahora: number) {
    if (acabado || saltando) return;
    const t = ahora - t0;

    if (t >= CIERRA[0] && !el.classList.contains('cierra')) {
      el.classList.add('viva', 'cierra');
      raiz.dataset.intro = 'sale'; // la portada empieza a entrar debajo de la tinta
      medir(); // volvió la barra de scroll: el sello pudo correrse
    }

    // ── ruta y contador
    const p = inOut(tramo(t, RUTA));
    trazo.style.strokeDashoffset = `${largo * (1 - p)}`;
    if (p > 0 && p < 1) {
      const pt = trazo.getPointAtLength(largo * p);
      punta.setAttribute('cx', `${pt.x}`);
      punta.setAttribute('cy', `${pt.y}`);
      punta.style.opacity = '1';
    } else punta.style.opacity = '0';
    // punto de miles a mano: Intl en español no agrupa los números de cuatro cifras
    km.textContent = `${Math.round((KM * p) / 10) * 10}`.replace(/\B(?=(\d{3})+$)/g, '.');

    // ── tinta
    const llena = inOut(tramo(t, LLENA));
    const cierra = inOut(tramo(t, CIERRA));
    let c = S, mx: number, round: number, rot = 0, amp: number;
    if (t < CIERRA[0]) {
      const sale = outBack(tramo(t, SOL));
      // un latido cuando la ruta toca el sol
      const toque = Math.sin(Math.PI * tramo(t, [RUTA[1] - 80, RUTA[1] + 260])) * 0.06;
      mx = llena > 0 ? mixExp(R, cubre, llena) : R * sale * (1 + toque);
      round = mx;
      amp = mix(2.2, 46, Math.sin(Math.PI * Math.min(llena, 0.5)));
    } else {
      c = { x: mix(S.x, H.x, cierra), y: mix(S.y, H.y, cierra) };
      mx = mixExp(cubre, hMedio, cierra);
      round = mx * mix(1, 3 / hMedio, suave(0.35, 1, cierra));
      rot = (-4 * Math.PI) / 180 * suave(0.4, 1, cierra);
      amp = mix(46, 0, suave(0, 0.85, cierra));
    }
    pintar(c, mx, round, rot, amp, t);

    // ── fases
    if (llena === 1 && papel.style.visibility !== 'hidden') papel.style.visibility = 'hidden';
    el.classList.toggle('roja', llena > 0.6);

    // ── 旅: nace grande en el centro y viaja hasta el sello
    const nace = outCubic(tramo(t, KANJI));
    const sigue = suave(0, 0.55, cierra);
    const tx = mix(w / 2, c.x, sigue);
    const ty = mix(h / 2, c.y, sigue);
    const esc = mixExp(1, hLetra / F, cierra) * mix(1.12, 1, nace);
    tabi.style.opacity = `${nace}`;
    tabi.style.transform = `translate(${tx}px, ${ty}px) rotate(${(rot * 180) / Math.PI}deg) scale(${esc})`;

    if (t >= CIERRA[1]) return acabar();
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
}
