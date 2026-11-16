// Las seis ventanas candidatas para el viaje. Las usan Cuándo ir (los papelitos para votar) y
// Decisiones (la tabla de posiciones). Sus ids son los de VENTANAS en claves.ts.

export interface Ventana {
  id: string;
  nombre: string;
  /** Nombre de una palabra, para donde no cabe el largo. */
  corto: string;
  fechas: string;
  /** Los meses que tocan esas fechas (1 = enero). */
  meses: number[];
  /** El sello de la época: un kanji distinto en cada ventana para reconocerla de un vistazo. */
  kanji: string;
  /** Qué significa el kanji. */
  dice: string;
  pro: string;
  contra: string;
  veredicto: string;
  estado: 'ok' | 'warn' | 'soft';
  etiqueta: string;
}

export const VENTANAS_VIAJE: Ventana[] = [
  {
    id: 'cerezos',
    nombre: 'Cerezos',
    corto: 'Cerezos',
    fechas: '25 mar – 10 abr',
    meses: [3, 4],
    kanji: '桜',
    dice: 'cerezo',
    pro: 'La postal de Japón. Clima fresco y agradable.',
    contra:
      'Lo más caro y lo más lleno del año. La floración dura una semana y se mueve según el clima: se puede fallar por días.',
    veredicto: 'Para 2027 ya va muy justo: quedan unos cuatro meses para visa, vuelos y ahorro de 5 personas.',
    estado: 'warn',
    etiqueta: 'Apretado',
  },
  {
    id: 'abril',
    nombre: 'Abril tardío',
    corto: 'Abril',
    fechas: '11 – 28 abr',
    meses: [4],
    kanji: '藤',
    dice: 'glicina',
    pro: 'Ya pasó el pico de los cerezos en Tokio y Kioto, pero en el norte y en la montaña siguen. Coincide con el Festival de Takayama (14 y 15 de abril), las flores azules de Hitachi y el arranque de las glicinas de Ashikaga.',
    contra:
      'No es la postal de los cerezos en Kioto. Si se corre unos días choca con Golden Week, y las glicinas pueden quedar a medio abrir.',
    veredicto: 'Primavera con menos pelea. Da unos cinco meses para organizarse: más holgado que los cerezos, pero igual toca moverse ya.',
    estado: 'ok',
    etiqueta: 'Alternativa',
  },
  {
    id: 'primavera',
    nombre: 'Primavera tardía',
    corto: 'Primavera',
    fechas: '10 may – 5 jun',
    meses: [5, 6],
    kanji: '緑',
    dice: 'verde',
    pro: 'Templado (15–25 °C), verde, menos gente y precios normales apenas pasa Golden Week.',
    contra: 'Sin cerezos ni hojas rojas. A principios de junio arrancan las lluvias.',
    veredicto: 'La opción cómoda y económica. Da seis meses para organizarse.',
    estado: 'ok',
    etiqueta: 'Buena opción',
  },
  {
    id: 'verano',
    nombre: 'Verano de festivales',
    corto: 'Verano',
    fechas: '20 jul – 10 ago',
    meses: [7, 8],
    kanji: '祭',
    dice: 'festival',
    pro: 'La temporada de los grandes festivales: Gion Matsuri en Kioto (todo julio; el último desfile es el 24), fuegos artificiales del Sumida (último sábado de julio) y Nebuta en Aomori (2 al 7 de agosto). Y es la única época en que se puede subir el Fuji.',
    contra:
      'Calor húmedo de más de 30 °C, más pesado que el de Cali. Agosto es de los meses con más tifones y en la mitad viene Obon; el Awa Odori (11 al 15 de agosto) cae justo ahí.',
    veredicto: 'Solo si al grupo le pica el Fuji o los festivales. Da unos ocho meses para organizarse.',
    estado: 'soft',
    etiqueta: 'Para fiesteros',
  },
  {
    id: 'otono',
    nombre: 'Otoño',
    corto: 'Otoño',
    fechas: '20 oct – 7 dic',
    meses: [10, 11, 12],
    kanji: '紅葉',
    dice: 'hojas rojas',
    pro: 'Hojas rojas (momiji), cielo despejado, clima seco y fresco. Tan bonito como los cerezos y dura más.',
    contra: 'Kioto se llena, y allá el rojo llega tarde: el promedio oficial es el 5 de diciembre. Hace frío en la noche para alguien de Cali (5–10 °C).',
    veredicto: 'El mejor balance, y da casi un año para ahorrar, sacar visa y cazar tiquetes.',
    estado: 'ok',
    etiqueta: 'Recomendada',
  },
  {
    id: 'invierno',
    nombre: 'Invierno',
    corto: 'Invierno',
    fechas: '15 ene – 28 feb 2028',
    meses: [1, 2],
    kanji: '雪',
    dice: 'nieve',
    pro: 'Lo más barato y vacío. Nieve, onsen, monos en aguas termales, Fuji despejado.',
    contra: 'Frío de verdad (0–10 °C), días cortos, hay que comprar ropa de invierno.',
    veredicto: 'Solo si el plan es nieve o el presupuesto manda. Sería ya para 2028.',
    estado: 'soft',
    etiqueta: 'De nicho',
  },
];

export const ventanaDe = (id: string) => VENTANAS_VIAJE.find((v) => v.id === id)!;
