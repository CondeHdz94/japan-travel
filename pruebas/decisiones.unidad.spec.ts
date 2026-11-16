// Las cuentas de Decisiones (src/lib/decisiones.ts): funciones puras, sin servidor ni navegador.

import { expect, test } from '@playwright/test';
import { SEMILLAS } from '../src/data/lugares';
import { PAPELES, VENTANAS } from '../src/data/claves';
import { VENTANAS_VIAJE } from '../src/data/ventanas';
import {
  contarLugares,
  contarMeses,
  contarPapeles,
  contarVentanas,
  lider,
  miParte,
  noCuadran,
  papelUrgente,
  quorum,
  repartirDias,
  temprano,
  type Marca,
  type Persona,
} from '../src/lib/decisiones';
import { giroFijo, iniciales } from '../src/scripts/sello';

const grupo = (...nombres: string[]): Persona[] => nombres.map((nombre, i) => ({ id: i + 1, nombre }));
const [A, B, C, D] = grupo('Ana', 'Beto', 'Caro', 'Dani');
const cuatro = [A, B, C, D];
const m = (p: Persona, t: string, c: string, v = 1): Marca => ({ p: p.id, t, c, v });
const ventana = (p: Persona, c: string, v: number) => m(p, 'ventana', c, v);

test.describe('ventanas', () => {
  test('los datos de las ventanas son los mismos ids que acepta la API, en el mismo orden', () => {
    expect(VENTANAS_VIAJE.map((v) => v.id)).toEqual(VENTANAS);
    for (const v of VENTANAS_VIAJE) {
      expect(v.meses.length, v.id).toBeGreaterThan(0);
      for (const n of v.meses) expect(n >= 1 && n <= 12, `${v.id}: ${n}`).toBe(true);
    }
  });

  test('好 vale 2 y 可 vale 1; se ordenan por agrado entre quienes votaron', () => {
    const r = contarVentanas(cuatro, [
      ventana(A, 'otono', 2),
      ventana(B, 'otono', 2),
      ventana(A, 'primavera', 1),
      ventana(B, 'primavera', 1),
      ventana(C, 'primavera', 2),
      ventana(D, 'primavera', 2),
    ]);
    const otono = r.find((v) => v.id === 'otono')!;
    const primavera = r.find((v) => v.id === 'primavera')!;
    expect(otono.puntos).toBe(4);
    expect(primavera.puntos).toBe(6);
    // otoño tiene menos puntos pero todos los que votaron la aman: no se castiga por votos pendientes
    expect(otono.agrado).toBe(1);
    expect(primavera.agrado).toBe(0.75);
    expect(r[0].id).toBe('otono');
    expect(otono.faltan.map((p) => p.nombre)).toEqual(['Caro', 'Dani']);
  });

  test('un solo «No puedo» tacha la ventana y la manda al final, aunque tenga más puntos', () => {
    const r = contarVentanas(cuatro, [
      ventana(A, 'cerezos', 2),
      ventana(B, 'cerezos', 2),
      ventana(C, 'cerezos', 2),
      ventana(D, 'cerezos', 0),
      ventana(A, 'invierno', 1),
    ]);
    const cerezos = r.find((v) => v.id === 'cerezos')!;
    expect(cerezos.tachada).toBe(true);
    expect(cerezos.votos[0]).toEqual([D]);
    expect(r.at(-1)!.id).toBe('cerezos');
    expect(lider(r).primera!.id).toBe('invierno');
  });

  test('si falta un voto en la que va adelante, se dice cuál pasaría adelante', () => {
    const r = contarVentanas(cuatro, [
      ...cuatro.slice(0, 3).map((p) => ventana(p, 'otono', 2)),
      ...cuatro.map((p) => ventana(p, 'primavera', 1)),
    ]);
    const l = lider(r);
    expect(l.primera!.id).toBe('otono');
    expect(l.siFalla!.id).toBe('primavera');
    expect(l.empatadas).toEqual([]);
  });

  test('empate: las que comparten el primer puesto, sin «si falla»', () => {
    const r = contarVentanas(cuatro, [
      ...cuatro.map((p) => ventana(p, 'otono', 1)),
      ...cuatro.map((p) => ventana(p, 'primavera', 1)),
    ]);
    const l = lider(r);
    expect(l.empatadas.map((v) => v.id).sort()).toEqual(['otono', 'primavera']);
    expect(l.siFalla).toBeNull();
  });

  test('si todas las que tienen votos están tachadas, no hay ninguna adelante', () => {
    const r = contarVentanas(cuatro, [ventana(A, 'otono', 2), ventana(B, 'otono', 0), ventana(A, 'verano', 0)]);
    const l = lider(r);
    expect(l.primera).toBeNull();
    expect(l.todasTachadas).toBe(true);
    expect(lider(contarVentanas(cuatro, [])).todasTachadas).toBe(false);
  });

  test('es temprano mientras vote menos de la mitad del grupo', () => {
    expect(temprano(1, 5)).toBe(true);
    expect(temprano(2, 5)).toBe(true);
    expect(temprano(3, 5)).toBe(false);
    expect(temprano(2, 4)).toBe(false);
    expect(temprano(1, 1)).toBe(false);
    expect(temprano(0, 1)).toBe(true);
  });

  test('quórum: quién marcó algo de un tipo y quién no', () => {
    const q = quorum(cuatro, [ventana(A, 'otono', 0), m(B, 'mes', 'oct')], 'ventana');
    expect(q.votaron).toEqual([A]);
    expect(q.faltan).toEqual([B, C, D]);
  });
});

test.describe('meses', () => {
  test('cuenta por mes y marca los meses en que pueden todos los que marcaron', () => {
    const r = contarMeses(cuatro, [m(A, 'mes', 'oct'), m(A, 'mes', 'nov'), m(B, 'mes', 'oct'), m(C, 'mes', 'nov')]);
    expect(r.marcaron).toEqual([A, B, C]);
    expect(r.faltan).toEqual([D]);
    expect(r.porMes[9]).toBe(2);
    expect(r.porMes[10]).toBe(2);
    expect(r.todos.filter(Boolean)).toEqual([]); // nadie tiene un mes en que puedan los tres
    const todos = contarMeses(cuatro, [m(A, 'mes', 'may'), m(B, 'mes', 'may')]);
    expect(todos.todos[4]).toBe(true);
  });

  test('sin marcas no hay «todos»', () => {
    expect(contarMeses(cuatro, []).todos.some(Boolean)).toBe(false);
  });

  test('no cuadra: votó una ventana sin marcar ninguno de sus meses (y quien no ha marcado no cuenta)', () => {
    const r = noCuadran(cuatro, [
      m(A, 'mes', 'may'),
      ventana(A, 'verano', 2), // julio y agosto: no los marcó
      ventana(A, 'primavera', 1), // mayo sí
      ventana(A, 'cerezos', 0), // «No puedo» no es contradicción
      ventana(B, 'verano', 2), // B no ha marcado meses: le falta, no se contradice
    ]);
    expect(r.map((x) => [x.persona.nombre, x.ventana])).toEqual([['Ana', 'verano']]);
    expect(r[0].meses).toEqual([7, 8]);
  });
});

test.describe('lugares', () => {
  const ids = SEMILLAS.slice(0, 4).map((l) => l.id);
  const votos = [
    ...cuatro.map((p) => m(p, 'lugar', ids[0])), // 4: fijo
    ...[A, B, C].map((p) => m(p, 'lugar', ids[1])), // 3: fijo (todos menos uno)
    ...[A, B].map((p) => m(p, 'lugar', ids[2])), // 2: con fuerza
    m(D, 'lugar', ids[3]), // 1: personal
  ];

  test('fijos (todos o todos menos uno), con fuerza (dos o más) y personales (uno solo)', () => {
    const r = contarLugares(cuatro, votos);
    expect(r.umbralFijo).toBe(3);
    expect(r.fijos.map((c) => c.lugar.id)).toEqual([ids[0], ids[1]]);
    expect(r.fuerza.map((c) => c.lugar.id)).toEqual([ids[2]]);
    expect(r.personales.map((x) => [x.persona.nombre, x.lugares.map((c) => c.lugar.id)])).toEqual([['Dani', [ids[3]]]]);
  });

  test('en un grupo de dos, fijo es que lo quieran los dos', () => {
    expect(contarLugares([A, B], [m(A, 'lugar', ids[0])]).umbralFijo).toBe(2);
  });

  test('frente a la ventana que va adelante: de temporada, o no se da en esas fechas', () => {
    const hanami = SEMILLAS.find((l) => l.id === 'hanami')!; // marzo y abril
    const momiji = SEMILLAS.find((l) => l.id === 'momiji-kioto')!; // noviembre y diciembre
    const sinFecha = SEMILLAS.find((l) => !l.meses)!;
    const marcas = [hanami, momiji, sinFecha].flatMap((l) => [A, B].map((p) => m(p, 'lugar', l.id)));
    const r = contarLugares(cuatro, marcas, SEMILLAS, 'otono');
    const de = (id: string) => [...r.fijos, ...r.fuerza].find((c) => c.lugar.id === id)!.temporada;
    expect(de('hanami')).toBe('no');
    expect(de('momiji-kioto')).toBe('si');
    expect(de(sinFecha.id)).toBeNull();
    expect(r.fueraDeFecha.map((c) => c.lugar.id)).toEqual(['hanami']);
    // sin ventana no se compara
    expect(contarLugares(cuatro, marcas).fueraDeFecha).toEqual([]);
  });

  test('los días se reparten completos entre zonas, en orden de ruta, sin lo que está fuera de fecha', () => {
    const tokio = SEMILLAS.filter((l) => l.zona === 'tokio' && !l.meses).slice(0, 2);
    const kansai = SEMILLAS.filter((l) => l.zona === 'kansai' && !l.meses).slice(0, 1);
    const hanami = SEMILLAS.find((l) => l.id === 'hanami')!;
    const marcas = [
      ...tokio.flatMap((l) => cuatro.map((p) => m(p, 'lugar', l.id))), // 8 votos
      ...kansai.flatMap((l) => cuatro.map((p) => m(p, 'lugar', l.id))), // 4 votos
      ...cuatro.map((p) => m(p, 'lugar', hanami.id)), // fuera de fecha en otoño
    ];
    const r = contarLugares(cuatro, marcas, SEMILLAS, 'otono');
    const dias = repartirDias([...r.fijos, ...r.fuerza], 15);
    expect(dias.map((z) => z.zona)).toEqual(['tokio', 'kansai']);
    expect(dias.reduce((s, z) => s + z.dias, 0)).toBe(15);
    expect(dias.map((z) => z.dias)).toEqual([10, 5]);
  });

  test('sin nada que quieran dos, no hay reparto', () => {
    expect(repartirDias(contarLugares(cuatro, [m(A, 'lugar', ids[0])]).fuerza, 15)).toEqual([]);
  });
});

test.describe('papeles y mi parte', () => {
  test('quién tiene cada papel, en el orden de la lista', () => {
    const r = contarPapeles(cuatro, [m(A, 'papel', 'pasaporte'), m(B, 'papel', 'plata')]);
    expect(r[0].id).toBe('pasaporte');
    expect(r[0].tienen).toEqual([A]);
    expect(r[0].faltan).toEqual([B, C, D]);
  });

  test('papel urgente: el que el grupo ya empezó; si todos tienen ese, el siguiente que falte; si nada falta, ninguno', () => {
    const empezado = contarPapeles(cuatro, [m(A, 'papel', 'visa')]);
    expect(papelUrgente(empezado)?.id).toBe('visa');
    // todos tienen el pasaporte: no se puede decir «listos», falta la visa
    const conPasaporte = contarPapeles(cuatro, cuatro.map((p) => m(p, 'papel', 'pasaporte')));
    expect(papelUrgente(conPasaporte)?.id).toBe('visa');
    const nada = contarPapeles(cuatro, []);
    expect(papelUrgente(nada)?.id).toBe('pasaporte');
    const todo = contarPapeles(cuatro, cuatro.flatMap((p) => PAPELES.map((c) => m(p, 'papel', c))));
    expect(papelUrgente(todo)).toBeNull();
  });

  test('mi parte: ventanas, meses, lugares y el papel urgente que me faltan', () => {
    const marcas = [ventana(A, 'otono', 2), m(B, 'papel', 'pasaporte'), m(B, 'mes', 'oct')];
    const r = miParte(A, cuatro, marcas);
    expect(r.ventanas).toEqual(VENTANAS.filter((v) => v !== 'otono'));
    expect(r.meses).toBe(true);
    expect(r.lugares).toBe(true);
    expect(r.papel).toBe('pasaporte');
    expect(miParte(B, cuatro, marcas).papel).toBeNull();
    // con pasaporte, solo me recuerda lo que otro del grupo ya tiene
    const conPasaporte = [m(A, 'papel', 'pasaporte'), m(B, 'papel', 'pasaporte'), m(B, 'papel', 'seguro')];
    expect(miParte(A, cuatro, conPasaporte).papel).toBe('seguro');
    expect(miParte(B, cuatro, conPasaporte).papel).toBeNull();
  });

  test('mi voto decide cuando falto yo en la que va adelante', () => {
    const marcas = [
      ...[A, B, C].map((p) => ventana(p, 'otono', 2)),
      ...cuatro.map((p) => ventana(p, 'primavera', 1)),
    ];
    expect(miParte(D, cuatro, marcas).decido).toEqual({ ventana: 'otono', siNo: 'primavera' });
    expect(miParte(A, cuatro, marcas).decido).toBeNull();
  });
});

test.describe('sellos', () => {
  test('iniciales: una por palabra, y se alargan si chocan', () => {
    const r = iniciales(grupo('Juan', 'Juan Camilo', 'Ana', 'Andrés'));
    expect([...r.values()]).toEqual(['J', 'JC', 'Ana', 'And']);
  });

  test('el giro fijo es estable y va de -10° a 10°', () => {
    expect(giroFijo('3:lugar:x')).toBe(giroFijo('3:lugar:x'));
    for (let i = 0; i < 200; i++) {
      const g = giroFijo(`${i}:k`);
      expect(g >= -10 && g <= 10).toBe(true);
    }
  });
});
