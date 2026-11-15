// La API completa, sin navegador: sesión, marcas, lugares propuestos y privacidad.

import { FORMAS } from '../src/data/formas';
import { SEMILLAS } from '../src/data/lugares';
import { CLAVE, expect, test, type Estado } from './ayudas';

const VACIO: Estado = { yo: null, personas: [], marcas: [] };
const LUGAR = { nombre: 'Mirador de prueba', tema: 'raro', zona: 'tokio' };

test.describe('entrar', () => {
  test('con la clave buena crea al viajero y abre sesión', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const r = await api.post('/api/entrar', { data: { nombre: 'Ana', clave: CLAVE } });
    expect(r.status()).toBe(200);
    const e: Estado = await r.json();
    expect(e.yo?.nombre).toBe('Ana');
    expect(e.personas).toEqual([e.yo]);
    expect(e.marcas).toEqual([]);

    const cookie = r.headers()['set-cookie'];
    expect(cookie).toMatch(/^viajero=\d+\.[\w-]+;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(r.headers()['cache-control']).toBe('no-store');

    // la sesión sirve para la siguiente consulta
    expect((await (await api.get('/api/estado')).json()).yo.nombre).toBe('Ana');
  });

  test('clave mala, vacía o que no es texto: 401 y no crea a nadie', async ({ grupo }) => {
    const api = await grupo.anonimo();
    for (const clave of ['otra', '', ' ', CLAVE + 'x', CLAVE.toUpperCase(), null, 123, true, [CLAVE], { a: 1 }]) {
      const r = await api.post('/api/entrar', { data: { nombre: 'Ana', clave } });
      expect(r.status(), JSON.stringify(clave)).toBe(401);
      expect((await r.json()).error).toBeTruthy();
      expect(r.headers()['set-cookie']).toBeUndefined();
    }
    const ana = await grupo.entrar('Testigo');
    expect((await ana.estado()).personas.map((p) => p.nombre)).toEqual(['Testigo']);
  });

  test('la clave se acepta con espacios alrededor (pegada desde el chat)', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const r = await api.post('/api/entrar', { data: { nombre: 'Ana', clave: `  ${CLAVE}\n` } });
    expect(r.status()).toBe(200);
  });

  test('cuerpo que no es JSON o no es un objeto: responde 401, no se cae', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const cuerpos = ['', 'no soy json', 'null', '"texto"', '[]', '42', '{"clave":'];
    for (const cuerpo of cuerpos) {
      const r = await api.post('/api/entrar', {
        data: cuerpo,
        headers: { 'content-type': 'application/json' },
      });
      expect(r.status(), JSON.stringify(cuerpo)).toBe(401);
    }
  });

  test('nombre inválido: 400', async ({ grupo }) => {
    const api = await grupo.anonimo();
    for (const nombre of ['', ' ', 'A', ' A ', 'x'.repeat(21), null, 12, ['Ana'], { n: 'Ana' }, undefined]) {
      const r = await api.post('/api/entrar', { data: { nombre, clave: CLAVE } });
      expect(r.status(), JSON.stringify(nombre)).toBe(400);
    }
  });

  test('nombres en el borde: 2 y 20 letras sirven', async ({ grupo }) => {
    expect((await grupo.entrar('Al')).nombre).toBe('Al');
    expect((await grupo.entrar('x'.repeat(20))).nombre).toBe('x'.repeat(20));
  });

  test('el nombre se guarda limpio: sin espacios de sobra', async ({ grupo }) => {
    expect((await grupo.entrar('   Juan    Camilo  ')).nombre).toBe('Juan Camilo');
  });

  test('el mismo nombre entra como la misma persona, sin importar mayúsculas ni espacios', async ({ grupo }) => {
    const a = await grupo.entrar('Camilo');
    const b = await grupo.entrar('camilo');
    const c = await grupo.entrar('  CAMILO ');
    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    // se conserva como se escribió la primera vez
    expect(c.nombre).toBe('Camilo');
    expect((await a.estado()).personas).toHaveLength(1);
  });

  test('con tilde también: «Ángela» desde el celular y «ángela» desde el computador son la misma', async ({ grupo }) => {
    const a = await grupo.entrar('Ángela');
    const b = await grupo.entrar('ángela');
    const c = await grupo.entrar('ÁNGELA');
    expect([b.id, c.id]).toEqual([a.id, a.id]);
    const n = await grupo.entrar('Toño');
    expect((await grupo.entrar('TOÑO')).id).toBe(n.id);
    expect((await a.estado()).personas).toHaveLength(2);
  });

  test('sin tilde también es la misma persona: «Andres» entra como «Andrés»', async ({ grupo }) => {
    const a = await grupo.entrar('Andrés');
    const b = await grupo.entrar('andres');
    expect(b.id).toBe(a.id);
    expect(b.nombre).toBe('Andrés');
    const s = await grupo.entrar('Sofia');
    expect((await grupo.entrar('SOFÍA')).id).toBe(s.id);
  });

  test('la ñ sí distingue: «Toño» y «Tono» son dos personas', async ({ grupo }) => {
    const a = await grupo.entrar('Toño');
    const b = await grupo.entrar('Tono');
    expect(b.id).not.toBe(a.id);
  });

  test('entrar de nuevo conserva las marcas', async ({ grupo }) => {
    const a = await grupo.entrar('Ana');
    await a.marcar('mes', 'oct', 1);
    const otraVez = await grupo.entrar('Ana');
    expect((await otraVez.estado()).marcas).toEqual([{ p: a.id, t: 'mes', c: 'oct', v: 1 }]);
  });

  test('el grupo se llena a los 12: el 13 no entra, los de antes sí', async ({ grupo }) => {
    const api = await grupo.anonimo();
    for (let i = 1; i <= 12; i++) {
      const r = await api.post('/api/entrar', { data: { nombre: `Viajero ${i}`, clave: CLAVE } });
      expect(r.status(), `viajero ${i}`).toBe(200);
    }
    const r = await api.post('/api/entrar', { data: { nombre: 'Colado', clave: CLAVE } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/completo/);

    const viejo = await api.post('/api/entrar', { data: { nombre: 'viajero 3', clave: CLAVE, soyYo: true } });
    expect(viejo.status()).toBe(200);
    expect((await viejo.json()).personas).toHaveLength(12);
  });

  test('si alguien se borra, queda cupo otra vez', async ({ grupo }) => {
    const api = await grupo.anonimo();
    for (let i = 1; i <= 12; i++)
      await api.post('/api/entrar', { data: { nombre: `Viajero ${i}`, clave: CLAVE } });
    expect((await api.post('/api/borrarme')).status()).toBe(200);
    expect((await api.post('/api/entrar', { data: { nombre: 'Nuevo', clave: CLAVE } })).status()).toBe(200);
  });

  test('dos registros simultáneos con el mismo nombre: uno entra y al otro se le pregunta', async ({ grupo }) => {
    const [a, b] = await Promise.all([grupo.anonimo(), grupo.anonimo()]);
    const rs = await Promise.all(
      [a, b].map((api) => api.post('/api/entrar', { data: { nombre: 'Gemelo', clave: CLAVE } })),
    );
    expect(rs.map((r) => r.status()).sort()).toEqual([200, 409]);
    const otro = await rs.find((r) => r.status() === 409)!.json();
    expect(otro.existe).toBe('Gemelo');
    const e = await rs.find((r) => r.status() === 200)!.json();
    expect(e.personas).toHaveLength(1);
  });
});

test.describe('nombre repetido: «¿eres tú?»', () => {
  test('un nombre que ya está no entra de una: se pregunta, y no se crea nadie', async ({ grupo }) => {
    await grupo.entrar('Juan');
    const api = await grupo.anonimo();
    for (const nombre of ['Juan', 'juan', '  JUÁN ']) {
      const r = await api.post('/api/entrar', { data: { nombre, clave: CLAVE } });
      expect(r.status(), nombre).toBe(409);
      const j = await r.json();
      // se responde con el nombre como lo escribió esa persona
      expect(j.existe).toBe('Juan');
      expect(j.error).toMatch(/Ya hay alguien llamado Juan/);
    }
    // no quedó sesión ni otro viajero
    expect(await (await api.get('/api/estado')).json()).toEqual(VACIO);
    const juan = await grupo.entrar('Juan');
    expect((await juan.estado()).personas).toHaveLength(1);
  });

  test('«sí, soy yo» entra como esa persona, sin bienvenida', async ({ grupo }) => {
    const juan = await grupo.entrar('Juan');
    await juan.marcar('mes', 'oct', 1);
    const api = await grupo.anonimo();
    const r = await api.post('/api/entrar', { data: { nombre: 'juan', clave: CLAVE, soyYo: true } });
    expect(r.status()).toBe(200);
    const e = await r.json();
    expect(e.yo.id).toBe(juan.id);
    expect(e.nuevo).toBe(false);
    expect(e.marcas).toHaveLength(1);
  });

  test('nombres parecidos son personas distintas: Juan, Juan Camilo y Juan Pablo', async ({ grupo }) => {
    await grupo.entrar('Juan');
    const api = await grupo.anonimo();
    for (const nombre of ['Juan Camilo', 'Juan Pablo']) {
      const r = await api.post('/api/entrar', { data: { nombre, clave: CLAVE } });
      expect(r.status(), nombre).toBe(200);
      expect((await r.json()).nuevo).toBe(true);
    }
    const e = await (await api.get('/api/estado')).json();
    expect(e.personas.map((p: { nombre: string }) => p.nombre)).toEqual(['Juan', 'Juan Camilo', 'Juan Pablo']);
  });

  test('un soyYo con un nombre que no existe simplemente registra', async ({ grupo }) => {
    const r = await (await grupo.anonimo()).post('/api/entrar', { data: { nombre: 'Nueva', clave: CLAVE, soyYo: true } });
    expect(r.status()).toBe(200);
    expect((await r.json()).nuevo).toBe(true);
  });
});

test.describe('llegadas: lo que ya se me anunció («visto»)', () => {
  test('a quien llega no se le anuncian los de antes; a los de antes, sí el que llega', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    // el «visto» de cada quien arranca en su propio id
    expect((await ana.estado()).visto).toBe(ana.id);
    const eb = await beto.estado();
    expect(eb.visto).toBe(beto.id);
    expect(eb.personas.filter((p) => p.id > eb.visto!)).toEqual([]);
    // Ana entró primero: para ella, Beto es nuevo
    const ea = await ana.estado();
    expect(ea.personas.filter((p) => p.id > ea.visto!).map((p) => p.nombre)).toEqual(['Beto']);
  });

  test('visto solo sube, nunca más allá del último que existe, y vale en todos los aparatos', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const otroAparato = await grupo.entrar('Ana');
    expect((await ana.api.post('/api/visto', { data: { hasta: beto.id } })).status()).toBe(200);
    expect((await otroAparato.estado()).visto).toBe(beto.id);
    // bajar no se puede
    await ana.api.post('/api/visto', { data: { hasta: 1 } });
    expect((await ana.estado()).visto).toBe(beto.id);
    // ni dar por visto a alguien que no ha llegado
    await ana.api.post('/api/visto', { data: { hasta: beto.id + 50 } });
    expect((await ana.estado()).visto).toBe(beto.id);
    const caro = await grupo.entrar('Caro');
    const e = await ana.estado();
    expect(e.personas.filter((p) => p.id > e.visto!).map((p) => p.id)).toEqual([caro.id]);
  });

  test('visto: sin sesión 401; con un valor raro 400', async ({ grupo }) => {
    const anonimo = await grupo.anonimo();
    expect((await anonimo.post('/api/visto', { data: { hasta: 1 } })).status()).toBe(401);
    const ana = await grupo.entrar('Ana');
    for (const hasta of [0, -3, 1.5, '2', null]) expect((await ana.api.post('/api/visto', { data: { hasta } })).status(), String(hasta)).toBe(400);
  });

  test('cambiar de nombre no es una llegada; salirse y volver sí (con otro id)', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    await ana.api.post('/api/visto', { data: { hasta: beto.id } });
    await beto.api.post('/api/renombrar', { data: { nombre: 'Roberto' } });
    let e = await ana.estado();
    expect(e.personas.filter((p) => p.id > e.visto!)).toEqual([]);
    await beto.api.post('/api/borrarme');
    const otraVez = await grupo.entrar('Roberto');
    e = await ana.estado();
    expect(e.personas.filter((p) => p.id > e.visto!).map((p) => p.id)).toEqual([otraVez.id]);
  });
});

test.describe('color del sello', () => {
  test('cada quien recibe el primer color libre y lo conserva aunque se salga alguien de antes', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const caro = await grupo.entrar('Caro');
    expect((await caro.estado()).personas.map((p) => p.tinta)).toEqual([0, 1, 2]);
    await ana.api.post('/api/borrarme');
    expect((await caro.estado()).personas.map((p) => [p.nombre, p.tinta])).toEqual([['Beto', 1], ['Caro', 2]]);
    // quien llega después toma el color que quedó libre
    const diana = await grupo.entrar('Diana');
    expect((await diana.estado()).yo?.tinta).toBe(0);
    expect((await beto.estado()).yo?.tinta).toBe(1);
  });
});

test.describe('estado y sesión', () => {
  test('sin sesión no se ve nada del grupo', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('mes', 'oct', 1);
    const r = await (await grupo.anonimo()).get('/api/estado');
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual(VACIO);
    expect(r.headers()['cache-control']).toBe('no-store');
  });

  test('con sesión se ven todos los viajeros y todas las marcas', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    await ana.marcar('mes', 'oct', 1);
    await beto.marcar('ventana', 'otono', 2);
    const e = await beto.estado();
    expect(e.yo).toEqual({ id: beto.id, nombre: 'Beto', forma: 'maru', tinta: 1 });
    expect(e.personas).toEqual([
      { id: ana.id, nombre: 'Ana', forma: 'koban', tinta: 0 },
      { id: beto.id, nombre: 'Beto', forma: 'maru', tinta: 1 },
    ]);
    expect(e.marcas).toHaveLength(2);
    expect(e.marcas).toContainEqual({ p: ana.id, t: 'mes', c: 'oct', v: 1 });
    expect(e.marcas).toContainEqual({ p: beto.id, t: 'ventana', c: 'otono', v: 2 });
  });

  test('una cookie inventada o dañada no abre sesión', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const buena = await ana.cookie();
    const [id, firma] = buena.split('.');
    const otro = await grupo.entrar('Beto');
    const malas = [
      `${id}.`,
      `${id}`,
      `.${firma}`,
      `${id}.${firma.slice(0, -1)}`,
      `${id}.${firma}x`,
      `${id}.${firma.split('').reverse().join('')}`,
      `${otro.id}.${firma}`, // la firma de Ana con el id de Beto
      `0.${firma}`,
      `-${id}.${firma}`,
      `${id}.5.${firma}`,
      `abc.${firma}`,
      'undefined.undefined',
      `999999.${firma}`,
    ];
    for (const mala of malas) {
      const api = await grupo.anonimo({ cookie: `viajero=${mala}` });
      expect(await (await api.get('/api/estado')).json(), mala).toEqual(VACIO);
      expect((await api.post('/api/marca', { data: { tipo: 'mes', clave: 'ene', valor: 1 } })).status(), mala).toBe(401);
    }
    // y la buena sí
    const api = await grupo.anonimo({ cookie: `viajero=${buena}` });
    expect((await (await api.get('/api/estado')).json()).yo.id).toBe(ana.id);
  });

  test('salir borra la cookie de este dispositivo, pero no al viajero', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const r = await ana.api.post('/api/salir');
    expect(r.status()).toBe(200);
    expect(await ana.estado()).toEqual(VACIO);
    const otraVez = await grupo.entrar('Ana');
    expect(otraVez.id).toBe(ana.id);
  });

  test('salir sin sesión no falla', async ({ grupo }) => {
    expect((await (await grupo.anonimo()).post('/api/salir')).status()).toBe(200);
  });

  test('todas las rutas que escriben piden sesión', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const rutas: [string, unknown][] = [
      ['marca', { tipo: 'mes', clave: 'ene', valor: 1 }],
      ['renombrar', { nombre: 'Otro' }],
      ['borrarme', {}],
      ['lugares', LUGAR],
      ['quitar-lugar', { id: 'u1' }],
    ];
    for (const [ruta, data] of rutas) {
      const r = await api.post(`/api/${ruta}`, { data });
      expect(r.status(), ruta).toBe(401);
      expect((await r.json()).error, ruta).toMatch(/Entra primero/);
    }
  });

  test('las rutas de escritura no responden a GET', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const ruta of ['entrar', 'salir', 'marca', 'renombrar', 'borrarme', 'lugares', 'quitar-lugar']) {
      const r = await ana.api.get(`/api/${ruta}`);
      expect(r.status(), ruta).toBeGreaterThanOrEqual(400);
      expect(r.status(), ruta).toBeLessThan(500);
    }
    // y nadie quedó borrado ni por fuera
    expect((await ana.estado()).yo?.id).toBe(ana.id);
  });
});

test.describe('marca', () => {
  test('mes, papel y lugar: solo vale 1', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const lugar = SEMILLAS[0].id;
    for (const [tipo, clave] of [['mes', 'oct'], ['papel', 'visa'], ['lugar', lugar]]) {
      expect((await ana.marcar(tipo, clave, 1)).status(), tipo).toBe(200);
      for (const malo of [0, 2, -1, 1.5, '1', true, [1], {}, undefined])
        expect((await ana.marcar(tipo, clave, malo)).status(), `${tipo} ${JSON.stringify(malo)}`).toBe(400);
    }
    const e = await ana.estado();
    expect(e.marcas).toHaveLength(3);
    expect(e.marcas.every((m) => m.v === 1 && m.p === ana.id)).toBe(true);
  });

  test('ventana: 0, 1 o 2, y votar de nuevo reemplaza', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const v of [2, 1, 0, 2]) {
      expect((await ana.marcar('ventana', 'otono', v)).status()).toBe(200);
      expect((await ana.estado()).marcas).toEqual([{ p: ana.id, t: 'ventana', c: 'otono', v }]);
    }
    for (const malo of [3, -1, '2', 0.5]) expect((await ana.marcar('ventana', 'otono', malo)).status()).toBe(400);
  });

  test('valor null quita la marca; quitar lo que no hay no falla', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('mes', 'oct', 1);
    await ana.marcar('mes', 'nov', 1);
    expect((await ana.marcar('mes', 'oct', null)).status()).toBe(200);
    expect((await ana.estado()).marcas).toEqual([{ p: ana.id, t: 'mes', c: 'nov', v: 1 }]);
    expect((await ana.marcar('mes', 'oct', null)).status()).toBe(200);
    expect((await ana.marcar('mes', 'dic', null)).status()).toBe(200);
    expect((await ana.estado()).marcas).toHaveLength(1);
  });

  test('marcar dos veces lo mismo no duplica', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await Promise.all([1, 2, 3, 4].map(() => ana.marcar('mes', 'oct', 1)));
    expect((await ana.estado()).marcas).toHaveLength(1);
  });

  test('cada quien solo toca sus marcas', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    await ana.marcar('mes', 'oct', 1);
    await beto.marcar('mes', 'oct', 1);
    await beto.marcar('mes', 'oct', null);
    expect((await ana.estado()).marcas).toEqual([{ p: ana.id, t: 'mes', c: 'oct', v: 1 }]);
  });

  test('tipo desconocido: 400', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const tipo of ['', 'otro', 'MES', 'mes ', null, 1, ['mes'], undefined])
      expect((await ana.marcar(tipo as string, 'oct', 1)).status(), JSON.stringify(tipo)).toBe(400);
  });

  test('tipo con nombre de propiedad interna de JavaScript: 400, no un error 500', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const tipo of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect((await ana.marcar(tipo, 'oct', 1)).status(), tipo).toBe(400);
      expect((await ana.marcar(tipo, 'oct', null)).status(), `${tipo} (quitar)`).toBe(400);
    }
    expect((await ana.estado()).marcas).toEqual([]);
  });

  test('clave con forma rara: 400', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const malas = ['', 'OCT', 'oct ', 'o c', 'ñu', 'a:b', 'a/b', "x'--", 'x'.repeat(33), null, 5, ['oct'], undefined];
    for (const clave of malas)
      expect((await ana.marcar('mes', clave as string, 1)).status(), JSON.stringify(clave)).toBe(400);
    expect((await ana.estado()).marcas).toEqual([]);
  });

  test('clave que no existe en el sitio: no se guarda', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const inventadas = [
      ['mes', 'xyz'],
      ['mes', 'octubre'],
      ['ventana', 'navidad'],
      ['papel', 'cedula'],
      ['lugar', 'no-existe'],
    ];
    for (const [tipo, clave] of inventadas)
      expect((await ana.marcar(tipo, clave, 1)).status(), `${tipo}:${clave}`).toBe(400);
    expect((await ana.estado()).marcas).toEqual([]);
  });

  test('todas las claves que usan las páginas se aceptan', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const ventanas = ['cerezos', 'abril', 'primavera', 'verano', 'otono', 'invierno'];
    const papeles = ['pasaporte', 'visa', 'tiquetes', 'hospedajes', 'seguro', 'vjw', 'plata'];
    for (const c of meses) expect((await ana.marcar('mes', c, 1)).status(), c).toBe(200);
    for (const c of ventanas) expect((await ana.marcar('ventana', c, 2)).status(), c).toBe(200);
    for (const c of papeles) expect((await ana.marcar('papel', c, 1)).status(), c).toBe(200);
    for (const l of SEMILLAS) expect((await ana.marcar('lugar', l.id, 1)).status(), l.id).toBe(200);
    expect((await ana.estado()).marcas).toHaveLength(12 + 6 + 7 + SEMILLAS.length);
  });

  test('no se puede sellar un lugar propuesto que no existe (o que ya quitaron)', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    expect((await ana.marcar('lugar', 'u999', 1)).status()).toBeGreaterThanOrEqual(400);

    const id = await beto.proponer(LUGAR);
    expect((await ana.marcar('lugar', id, 1)).status()).toBe(200);
    await beto.api.post('/api/quitar-lugar', { data: { id } });
    // Ana todavía tiene la tarjeta en pantalla y la toca
    const r = await ana.marcar('lugar', id, 1);
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
    expect((await ana.estado()).marcas).toEqual([]);
  });

  test('cuerpo que no es JSON: 400', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const cuerpo of ['', 'x', 'null', '[]', '"mes"']) {
      const r = await ana.api.post('/api/marca', { data: cuerpo, headers: { 'content-type': 'application/json' } });
      expect(r.status(), JSON.stringify(cuerpo)).toBe(400);
    }
  });

  test('quien ya se borró desde otro dispositivo no deja marcas huérfanas', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const cookie = await ana.cookie();
    const otroDispositivo = await grupo.anonimo({ cookie: `viajero=${cookie}` });
    await ana.api.post('/api/borrarme');
    await otroDispositivo.post('/api/marca', { data: { tipo: 'mes', clave: 'oct', valor: 1 } });
    const testigo = await grupo.entrar('Testigo');
    expect((await testigo.estado()).marcas).toEqual([]);
    expect(await (await otroDispositivo.get('/api/estado')).json()).toEqual(VACIO);
  });
});

test.describe('renombrar', () => {
  test('cambia el nombre y conserva id y marcas', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('mes', 'oct', 1);
    const r = await ana.api.post('/api/renombrar', { data: { nombre: '  Ana   María ' } });
    expect(r.status()).toBe(200);
    const e: Estado = await r.json();
    expect(e.yo).toEqual({ id: ana.id, nombre: 'Ana María', forma: 'koban', tinta: 0 });
    expect(e.marcas).toEqual([{ p: ana.id, t: 'mes', c: 'oct', v: 1 }]);
    // el nombre viejo queda libre y sería otra persona
    expect((await grupo.entrar('Ana')).id).not.toBe(ana.id);
  });

  test('nombre inválido: 400 y no cambia', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const nombre of ['', 'A', 'x'.repeat(21), null, 7])
      expect((await ana.api.post('/api/renombrar', { data: { nombre } })).status(), JSON.stringify(nombre)).toBe(400);
    expect((await ana.estado()).yo?.nombre).toBe('Ana');
  });

  test('no se puede tomar el nombre de otro, tampoco cambiando mayúsculas o tildes', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await grupo.entrar('Ángela');
    for (const nombre of ['Ángela', 'ángela', 'ÁNGELA', ' ángela ']) {
      const r = await ana.api.post('/api/renombrar', { data: { nombre } });
      expect(r.status(), nombre).toBe(409);
      expect((await r.json()).error).toMatch(/Ya hay alguien/);
    }
    expect((await ana.estado()).yo?.nombre).toBe('Ana');
  });

  test('sí puedo cambiar las mayúsculas de mi propio nombre', async ({ grupo }) => {
    const ana = await grupo.entrar('ana');
    const r = await ana.api.post('/api/renombrar', { data: { nombre: 'Ana' } });
    expect(r.status()).toBe(200);
    expect((await r.json()).yo.nombre).toBe('Ana');
  });

  test('guardar el mismo nombre no falla', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    expect((await ana.api.post('/api/renombrar', { data: { nombre: 'Ana' } })).status()).toBe(200);
  });

  test('quien ya no está en el grupo no puede renombrarse', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const otro = await grupo.anonimo({ cookie: `viajero=${await ana.cookie()}` });
    await ana.api.post('/api/borrarme');
    const r = await otro.post('/api/renombrar', { data: { nombre: 'Fantasma' } });
    expect(r.status()).toBe(401);
  });
});

test.describe('forma del sello', () => {
  test('a cada viajero nuevo le toca una forma que nadie tiene, en el orden del catálogo', async ({ grupo }) => {
    const formas: string[] = [];
    for (const n of ['Ana', 'Beto', 'Carla', 'Dario']) await grupo.entrar(n);
    const e = await (await grupo.entrar('Elena')).estado();
    for (const p of e.personas) formas.push(p.forma);
    expect(formas).toEqual(FORMAS.slice(0, 5).map((f) => f.id));
  });

  test('la forma que deja libre alguien que se va es la que recibe el siguiente', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    await ana.api.post('/api/borrarme');
    const carla = await grupo.entrar('Carla');
    const e = await carla.estado();
    expect(e.personas.find((p) => p.id === beto.id)?.forma).toBe(FORMAS[1].id);
    expect(e.yo?.forma).toBe(FORMAS[0].id);
  });

  test('se cambia junto con el nombre, y sin mandarla se queda la que había', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const r = await ana.api.post('/api/renombrar', { data: { nombre: 'Ana', forma: 'ema' } });
    expect(r.status()).toBe(200);
    expect((await r.json()).yo).toEqual({ id: ana.id, nombre: 'Ana', forma: 'ema', tinta: 0 });
    await ana.api.post('/api/renombrar', { data: { nombre: 'Anita' } });
    expect((await ana.estado()).yo).toEqual({ id: ana.id, nombre: 'Anita', forma: 'ema', tinta: 0 });
    // volver a entrar no la cambia
    expect((await (await grupo.entrar('Anita')).estado()).yo?.forma).toBe('ema');
  });

  test('dos pueden escoger la misma forma', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    expect((await beto.api.post('/api/renombrar', { data: { nombre: 'Beto', forma: 'koban' } })).status()).toBe(200);
    expect((await ana.estado()).personas.map((p) => p.forma)).toEqual(['koban', 'koban']);
  });

  test('una forma que no existe: 400 y no cambia nada', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const forma of ['estrella', '', 7, {}, 'KOBAN']) {
      const r = await ana.api.post('/api/renombrar', { data: { nombre: 'Otra', forma } });
      expect(r.status(), JSON.stringify(forma)).toBe(400);
      expect((await r.json()).error).toMatch(/forma/);
    }
    expect((await ana.estado()).yo).toEqual({ id: ana.id, nombre: 'Ana', forma: 'koban', tinta: 0 });
  });
});

test.describe('borrarme', () => {
  test('se lleva a la persona, sus marcas, sus lugares y los sellos de esos lugares', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const deAna = await ana.proponer(LUGAR);
    const deBeto = await beto.proponer({ ...LUGAR, nombre: 'El de Beto' });
    await ana.marcar('mes', 'oct', 1);
    await ana.marcar('lugar', deBeto, 1);
    await beto.marcar('lugar', deAna, 1);
    await beto.marcar('mes', 'oct', 1);

    const r = await ana.api.post('/api/borrarme');
    expect(r.status()).toBe(200);
    expect(await ana.estado()).toEqual(VACIO);

    const e = await beto.estado();
    // Beto conserva su color aunque Ana, que estaba antes, ya no esté
    expect(e.personas).toEqual([{ id: beto.id, nombre: 'Beto', forma: 'maru', tinta: 1 }]);
    expect(e.marcas).toHaveLength(2);
    expect(e.marcas).toContainEqual({ p: beto.id, t: 'lugar', c: deBeto, v: 1 });
    expect(e.marcas).toContainEqual({ p: beto.id, t: 'mes', c: 'oct', v: 1 });

    const html = await (await beto.api.get('/lugares')).text();
    expect(html).toContain('El de Beto');
    expect(html).not.toContain('Mirador de prueba');
  });

  test('la cookie vieja deja de servir en todos los dispositivos', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const otro = await grupo.anonimo({ cookie: `viajero=${await ana.cookie()}` });
    await ana.api.post('/api/borrarme');
    expect(await (await otro.get('/api/estado')).json()).toEqual(VACIO);
    expect((await otro.post('/api/lugares', { data: LUGAR })).status()).toBe(401);
  });

  test('volver con el mismo nombre es empezar de cero, con otro id', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('mes', 'oct', 1);
    const cookieVieja = await ana.cookie();
    await ana.api.post('/api/borrarme');
    const nueva = await grupo.entrar('Ana');
    expect(nueva.id).not.toBe(ana.id);
    expect((await nueva.estado()).marcas).toEqual([]);
    // la cookie de la Ana anterior no entra como la nueva
    const vieja = await grupo.anonimo({ cookie: `viajero=${cookieVieja}` });
    expect(await (await vieja.get('/api/estado')).json()).toEqual(VACIO);
  });
});

test.describe('proponer lugar', () => {
  test('lo crea, devuelve su id y quien lo propone ya queda con sello', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer({
      ...LUGAR,
      nota: 'Vale la pena',
      temporada: 'otono',
      enlace: 'https://example.com/a?b=1',
      imagen: 'https://example.com/foto.jpg',
    });
    expect(id).toMatch(/^u\d+$/);
    expect((await ana.estado()).marcas).toEqual([{ p: ana.id, t: 'lugar', c: id, v: 1 }]);

    const html = await (await ana.api.get('/lugares')).text();
    const tarjeta = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</article>', html.indexOf(`id="${id}"`)));
    expect(tarjeta).toContain('Mirador de prueba');
    expect(tarjeta).toContain('Vale la pena');
    expect(tarjeta).toContain('data-meses="10,11"');
    expect(tarjeta).toContain('Oct–Nov');
    expect(tarjeta).toContain('data-zona="tokio"');
    expect(tarjeta).toContain('href="https://example.com/a?b=1"');
    expect(tarjeta).toContain('src="https://example.com/foto.jpg"');
    expect(tarjeta).toContain(`data-sello-de="${ana.id}"`);
    expect(tarjeta).toContain(`data-quitar="${id}"`);
  });

  test('faltan datos o no son válidos: 400 con mensaje', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const malos: [Record<string, unknown>, RegExp][] = [
      [{ ...LUGAR, nombre: '' }, /nombre/],
      [{ ...LUGAR, nombre: ' A ' }, /nombre/],
      [{ ...LUGAR, nombre: 55 }, /nombre/],
      [{ ...LUGAR, nombre: undefined }, /nombre/],
      [{ ...LUGAR, tema: 'no-existe' }, /tema/],
      [{ ...LUGAR, tema: undefined }, /tema/],
      [{ ...LUGAR, tema: ['raro'] }, /tema/],
      [{ ...LUGAR, zona: 'marte' }, /zona/],
      [{ ...LUGAR, zona: undefined }, /zona/],
      [{ ...LUGAR, enlace: 'http://example.com' }, /https/],
      [{ ...LUGAR, enlace: 'javascript:alert(1)' }, /https/],
      [{ ...LUGAR, enlace: 'data:text/html,<script>alert(1)</script>' }, /https/],
      [{ ...LUGAR, enlace: 'example.com' }, /https/],
      [{ ...LUGAR, enlace: 'https://' }, /https/],
      [{ ...LUGAR, enlace: 7 }, /https/],
      [{ ...LUGAR, imagen: 'http://example.com/a.jpg' }, /foto/],
      [{ ...LUGAR, imagen: 'javascript:alert(1)' }, /foto/],
    ];
    for (const [datos, mensaje] of malos) {
      const r = await ana.api.post('/api/lugares', { data: datos });
      expect(r.status(), JSON.stringify(datos)).toBe(400);
      expect((await r.json()).error, JSON.stringify(datos)).toMatch(mensaje);
    }
    for (const cuerpo of ['', 'x', 'null', '[]']) {
      const r = await ana.api.post('/api/lugares', { data: cuerpo, headers: { 'content-type': 'application/json' } });
      expect(r.status(), JSON.stringify(cuerpo)).toBe(400);
    }
    const html = await (await ana.api.get('/lugares')).text();
    expect(html).not.toContain('data-sello-de');
  });

  test('nombre y nota largos se recortan; los opcionales pueden faltar', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer({ ...LUGAR, nombre: 'N'.repeat(100), nota: 'd'.repeat(500), temporada: 'no-existe', enlace: '', imagen: '' });
    const html = await (await ana.api.get('/lugares')).text();
    const tarjeta = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</article>', html.indexOf(`id="${id}"`)));
    expect(tarjeta).toContain(`>${'N'.repeat(60)}<`);
    expect(tarjeta).toContain(`>${'d'.repeat(240)}<`);
    expect(tarjeta).not.toContain('data-meses');
    expect(tarjeta).toContain('google.com/maps/search');
    expect(tarjeta).toContain('sin-foto');
  });

  test('lo que escriba la gente sale como texto, nunca como HTML', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.proponer({
      ...LUGAR,
      nombre: '<img src=x onerror=alert(1)>',
      nota: '"><script>alert(2)</script>',
      enlace: 'https://example.com/"><script>alert(3)</script>',
    });
    const html = await (await ana.api.get('/lugares')).text();
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('quien ya no está en el grupo no puede proponer', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const otro = await grupo.anonimo({ cookie: `viajero=${await ana.cookie()}` });
    await ana.api.post('/api/borrarme');
    expect((await otro.post('/api/lugares', { data: LUGAR })).status()).toBe(401);
  });
});

test.describe('quitar lugar', () => {
  test('solo quien lo propuso; se van también los sellos de los demás', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const id = await ana.proponer(LUGAR);
    await beto.marcar('lugar', id, 1);

    const ajeno = await beto.api.post('/api/quitar-lugar', { data: { id } });
    expect(ajeno.status()).toBe(403);
    expect((await beto.estado()).marcas).toHaveLength(2);

    const r = await ana.api.post('/api/quitar-lugar', { data: { id } });
    expect(r.status()).toBe(200);
    expect((await beto.estado()).marcas).toEqual([]);
    expect(await (await beto.api.get('/lugares')).text()).not.toContain('Mirador de prueba');

    // quitarlo dos veces no rompe nada
    const otraVez = await ana.api.post('/api/quitar-lugar', { data: { id } });
    expect(otraVez.status()).toBeGreaterThanOrEqual(400);
    expect(otraVez.status()).toBeLessThan(500);
  });

  test('id con forma rara: 400; los del catálogo no se pueden quitar', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    for (const id of ['', 'u', 'ux', '1', 'u-1', 'u1 ', 'U1', 'u1.5', 'u1234567890', SEMILLAS[0].id, null, 1, ['u1'], undefined]) {
      const r = await ana.api.post('/api/quitar-lugar', { data: { id } });
      expect(r.status(), JSON.stringify(id)).toBe(400);
    }
  });

  test('los ids no se reutilizan: un sello viejo no cae en un lugar nuevo', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const a = await ana.proponer(LUGAR);
    await ana.api.post('/api/quitar-lugar', { data: { id: a } });
    const b = await ana.proponer({ ...LUGAR, nombre: 'Otro distinto' });
    expect(b).not.toBe(a);
  });
});

test.describe('página de lugares en el servidor', () => {
  test('sin sesión: solo el catálogo, sin nombres ni lugares del grupo, y sin caché', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana Secreta');
    await ana.proponer({ ...LUGAR, nombre: 'Lugar privado del grupo' });
    const r = await (await grupo.anonimo()).get('/lugares');
    expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toBe('private, no-store');
    const html = await r.text();
    expect(html).not.toContain('Lugar privado del grupo');
    expect(html).not.toContain('Ana Secreta');
    expect(html).not.toContain('data-sello-de');
    expect(html).not.toContain('data-quitar');
    expect((html.match(/<article/g) ?? []).length).toBe(SEMILLAS.length);
    expect(html).toContain(`${SEMILLAS.length} sitios y eventos`);
  });

  test('con una cookie inventada tampoco se ven los lugares del grupo', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.proponer({ ...LUGAR, nombre: 'Lugar privado del grupo' });
    const api = await grupo.anonimo({ cookie: `viajero=${ana.id}.firmafalsa` });
    expect(await (await api.get('/lugares')).text()).not.toContain('Lugar privado del grupo');
  });

  test('con sesión: suma los del grupo; «Quitar» solo le sale a quien propuso', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const id = await ana.proponer(LUGAR);
    const deAna = await (await ana.api.get('/lugares')).text();
    const deBeto = await (await beto.api.get('/lugares')).text();
    for (const html of [deAna, deBeto]) {
      expect((html.match(/<article/g) ?? []).length).toBe(SEMILLAS.length + 1);
      expect(html).toContain(`${SEMILLAS.length + 1} sitios y eventos`);
      expect(html).toContain(`data-sello-de="${ana.id}"`);
    }
    expect(deAna).toContain(`data-quitar="${id}"`);
    expect(deBeto).not.toContain('data-quitar');
  });

  test('dentro de cada tema van primero los más sellados; sin sesión, el orden del catálogo', async ({ grupo }) => {
    const ana = await grupo.entrar('Ana');
    const beto = await grupo.entrar('Beto');
    const otaku = SEMILLAS.filter((l) => l.tema === 'otaku').map((l) => l.id);
    const [, , tercero, , quinto] = otaku;
    await ana.marcar('lugar', quinto, 1);
    await beto.marcar('lugar', quinto, 1);
    await ana.marcar('lugar', tercero, 1);

    const orden = (html: string) => {
      const sec = html.slice(html.indexOf('<section class="tema'), html.indexOf('</section>', html.indexOf('<section class="tema')));
      return [...sec.matchAll(/data-marca="lugar:([^"]+)"/g)].map((m) => m[1]);
    };
    const esperado = [quinto, tercero, ...otaku.filter((id) => id !== quinto && id !== tercero)];
    expect(orden(await (await ana.api.get('/lugares')).text())).toEqual(esperado);
    expect(orden(await (await (await grupo.anonimo()).get('/lugares')).text())).toEqual(otaku);
  });
});

test.describe('páginas y archivos', () => {
  test('las cuatro páginas responden 200 con su título', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const paginas: [string, string][] = [
      ['/', 'Inicio'],
      ['/cuando-ir', 'Cuándo ir'],
      ['/requisitos', 'Requisitos'],
      ['/lugares', 'Lugares'],
    ];
    for (const [ruta, titulo] of paginas) {
      const r = await api.get(ruta);
      expect(r.status(), ruta).toBe(200);
      const html = await r.text();
      expect(html, ruta).toContain(`<title>${titulo} · Cali → Japón</title>`);
      expect(html, ruta).toContain('<html lang="es">');
      expect(html, ruta).toContain('name="robots" content="noindex"');
    }
  });

  test('una ruta que no existe da 404', async ({ grupo }) => {
    const api = await grupo.anonimo();
    for (const ruta of ['/no-existe', '/api/no-existe', '/lugares/akihabara'])
      expect((await api.get(ruta)).status(), ruta).toBe(404);
  });

  test('todas las fotos que usa Lugares existen y son imágenes', async ({ grupo }) => {
    const api = await grupo.anonimo();
    const html = await (await api.get('/lugares')).text();
    const fotos = [...new Set([...html.matchAll(/<img src="(\/lugares\/[^"]+)"/g)].map((m) => m[1]))];
    expect(fotos.length).toBeGreaterThan(100);
    for (const f of fotos) {
      const r = await api.get(f);
      expect(r.status(), f).toBe(200);
      expect(r.headers()['content-type'], f).toMatch(/^image\//);
    }
  });

  test('el favicon existe', async ({ grupo }) => {
    expect((await (await grupo.anonimo()).get('/favicon.svg')).status()).toBe(200);
  });
});
