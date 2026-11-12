export interface Seccion {
  n: string;
  kanji: string;
  lectura: string;
  titulo: string;
  desc: string;
  href?: string;
}

export const secciones: Seccion[] = [
  {
    n: '01',
    kanji: '時',
    lectura: 'toki',
    titulo: 'Cuándo ir',
    desc: 'Cerezos, otoño, calor, tifones y precios: el año japonés mes a mes para escoger fecha.',
    href: '/cuando-ir',
  },
  {
    n: '02',
    kanji: '書',
    lectura: 'sho',
    titulo: 'Requisitos',
    desc: 'Visa, pasaporte, rutas de vuelo sin visa americana y los papeles que hay que tener listos.',
    href: '/requisitos',
  },
  {
    n: '03',
    kanji: '所',
    lectura: 'tokoro',
    titulo: 'Lugares',
    desc: 'La lista de sitios que cada uno propone, para votar y armar la ruta.',
    href: '/lugares',
  },
  {
    n: '04',
    kanji: '道',
    lectura: 'michi',
    titulo: 'Itinerario',
    desc: 'Día por día: ciudades, trenes, hospedajes y reservas.',
  },
  {
    n: '05',
    kanji: '金',
    lectura: 'kane',
    titulo: 'Presupuesto',
    desc: 'Cuánto vale la vuelta, en pesos y en yenes, y quién le debe a quién.',
  },
  {
    n: '06',
    kanji: '具',
    lectura: 'gu',
    titulo: 'Apps y equipaje',
    desc: 'Lo que hay que instalar y empacar antes de salir de Cali.',
  },
];
