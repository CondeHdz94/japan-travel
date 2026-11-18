// Catálogo inicial de lugares y eventos. Lo que proponga el grupo vive en la base de datos;
// esto es la base para que la sección no arranque vacía.
//
// `wiki` es el título del artículo de Wikipedia en inglés de donde sale la foto
// (ver scripts/fotos-lugares.mjs) y al que lleva el nombre del lugar, en español si existe
// (ver scripts/articulos-lugares.mjs). `meses` solo va si el lugar depende de la época.

export interface Tema {
  id: string;
  kanji: string;
  nombre: string;
  /** nombre de una palabra, para la barra de temas */
  corto: string;
  desc: string;
}

export const TEMAS: Tema[] = [
  { id: 'otaku', corto: 'Otaku', kanji: '漫', nombre: 'Otaku', desc: 'Anime, manga, videojuegos, figuras y compras geek.' },
  { id: 'tradicion', corto: 'Tradicional', kanji: '寺', nombre: 'Japón tradicional', desc: 'Templos, santuarios, castillos y samuráis.' },
  { id: 'barrios', corto: 'Barrios', kanji: '町', nombre: 'Barrios históricos y aldeas', desc: 'Calles de madera, pueblos de posta y casas con techo de paja.' },
  { id: 'naturaleza', corto: 'Montes', kanji: '山', nombre: 'Montes y rutas', desc: 'El Fuji, bosques, caminatas y rutas en bici.' },
  { id: 'jardines', corto: 'Jardines', kanji: '庭', nombre: 'Jardines, canales y puentes', desc: 'Jardines de paseo, flores de temporada, agua y madera.' },
  { id: 'arte', corto: 'Arte', kanji: '美', nombre: 'Arte y museos', desc: 'Islas de arte, esculturas, museos y memoria.' },
  { id: 'ciudad', corto: 'Ciudad', kanji: '都', nombre: 'Ciudad y neón', desc: 'Cruces, callejones, torres y comida callejera.' },
  { id: 'motor', corto: 'Motor', kanji: '車', nombre: 'Carros y noche', desc: 'Parqueaderos míticos, autopistas, circuitos y museos de marca.' },
  { id: 'raro', corto: 'Raro', kanji: '奇', nombre: 'Raro pero bacano', desc: 'Islas de animales, ruinas, museos absurdos y cosas que solo hay allá.' },
  { id: 'eventos', corto: 'Eventos', kanji: '祭', nombre: 'Eventos y temporada', desc: 'Festivales, torneos y cosas que solo pasan en ciertas fechas.' },
];

export interface Zona {
  id: string;
  nombre: string;
}

export const ZONAS: Zona[] = [
  { id: 'tokio', nombre: 'Tokio' },
  { id: 'kanto', nombre: 'Cerca de Tokio' },
  { id: 'kansai', nombre: 'Kioto y Osaka' },
  { id: 'chubu', nombre: 'Alpes y centro' },
  { id: 'oeste', nombre: 'Hiroshima y Shikoku' },
  { id: 'norte', nombre: 'Norte' },
  { id: 'sur', nombre: 'Sur' },
];

export interface Temporada {
  id: string;
  nombre: string;
  meses: number[];
}

export const TEMPORADAS: Temporada[] = [
  { id: 'primavera', nombre: 'Primavera', meses: [3, 4, 5] },
  { id: 'verano', nombre: 'Verano', meses: [6, 7, 8, 9] },
  { id: 'otono', nombre: 'Otoño', meses: [10, 11] },
  { id: 'invierno', nombre: 'Invierno', meses: [12, 1, 2] },
];

const ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** «Jul–Sep», «Dic–Mar» o «Ene · May · Sep» según los meses sean seguidos o sueltos. */
export function etiquetaMeses(meses: number[]): string {
  const set = new Set(meses);
  if (set.size === 0 || set.size === 12) return 'Todo el año';
  if (set.size === 1) return ABR[meses[0] - 1];
  // seguidos (también cruzando diciembre–enero): hay un solo mes cuyo anterior no está
  const inicios = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1));
  if (inicios.length === 1) {
    const ini = inicios[0];
    const fin = ((ini + set.size - 2) % 12) + 1;
    return `${ABR[ini - 1]}–${ABR[fin - 1]}`;
  }
  const orden = [...set].sort((a, b) => a - b);
  return orden.length <= 4 ? orden.map((m) => ABR[m - 1]).join(' · ') : 'Varias fechas';
}

export interface Lugar {
  id: string;
  nombre: string;
  /** nombre en japonés, cuando aporta */
  jp?: string;
  tema: string;
  zona: string;
  desc: string;
  meses?: number[];
  wiki?: string;
  /** el artículo de `wiki` no es de este lugar (sirvió solo para la foto): el nombre no lleva enlace */
  sinArticulo?: boolean;
  /** búsqueda en Wikimedia Commons, cuando la imagen del artículo es un logo o un mapa */
  foto?: string;
}

export const SEMILLAS: Lugar[] = [
  // ───── otaku ─────
  { id: 'akihabara', nombre: 'Akihabara', jp: '秋葉原', tema: 'otaku', zona: 'tokio', wiki: 'Akihabara', desc: 'El barrio eléctrico: edificios enteros de figuras, arcades, juegos retro y maid cafés.' },
  { id: 'nakano-broadway', nombre: 'Nakano Broadway', jp: '中野ブロードウェイ', tema: 'otaku', zona: 'tokio', wiki: 'Nakano Broadway', desc: 'Centro comercial viejo tomado por Mandarake: manga usado, figuras raras y coleccionismo serio. Menos turístico que Akihabara.' },
  { id: 'super-potato', nombre: 'Super Potato y lo retro', jp: 'スーパーポテト', tema: 'otaku', zona: 'tokio', wiki: 'Super Potato', desc: 'La tienda de videojuegos retro más famosa de Akihabara: Famicom, Game Boy y un arcade viejo en el último piso.' },
  { id: 'ikebukuro', nombre: 'Ikebukuro', jp: '池袋', tema: 'otaku', zona: 'tokio', wiki: 'Ikebukuro', desc: 'Pokémon Center Mega Tokyo, la tienda insignia de Animate, pisos enteros de gashapon y Anime Tokyo Station, un museo del anime gratis.' },
  { id: 'museo-ghibli', nombre: 'Museo Ghibli', jp: '三鷹の森ジブリ美術館', tema: 'otaku', zona: 'tokio', wiki: 'Ghibli Museum', desc: 'El museo de Miyazaki en Mitaka. Las entradas son con fecha y hora y se agotan: hay que comprarlas con mucha anticipación.' },
  { id: 'gundam-odaiba', nombre: 'Gundam Unicornio de Odaiba', jp: 'ユニコーンガンダム', tema: 'otaku', zona: 'tokio', wiki: 'DiverCity Tokyo Plaza', desc: 'Estatua a escala real, de casi 20 metros, que se transforma con luces varias veces al día. Gratis.' },
  { id: 'museo-doraemon', foto: 'Fujiko F. Fujio Museum', nombre: 'Museo Fujiko F. Fujio', jp: '藤子・F・不二雄ミュージアム', tema: 'otaku', zona: 'kanto', wiki: 'Fujiko F. Fujio Museum', sinArticulo: true, desc: 'El museo de Doraemon en Kawasaki. Entrada con reserva previa.' },
  { id: 'pokepark-kanto', foto: 'ProfSekkokuLab 20260205', nombre: 'PokéPark Kanto', jp: 'ポケパーク カントー', tema: 'otaku', zona: 'kanto', wiki: 'PokéPark Kanto', desc: 'El primer parque permanente de Pokémon, dentro de Yomiuriland, a las afueras de Tokio. Entrada con fecha, por sorteo o por orden de compra, desde ¥4.700. Ojo: para comprar piden un celular japonés; cómo conseguirla desde Colombia está por confirmar.' },
  { id: 'ghibli-park', nombre: 'Ghibli Park', jp: 'ジブリパーク', tema: 'otaku', zona: 'chubu', wiki: 'Ghibli Park', desc: 'El parque de Ghibli cerca de Nagoya: la casa de Totoro, el castillo ambulante, el pueblo de Mononoke. Con reserva.' },
  { id: 'museo-nintendo', foto: 'Nintendo Museum Uji', nombre: 'Museo Nintendo', jp: 'ニンテンドーミュージアム', tema: 'otaku', zona: 'kansai', wiki: 'Nintendo Museum', desc: 'La historia de Nintendo en su antigua fábrica de Uji, cerca de Kioto. Las entradas se consiguen por sorteo o reserva anticipada.' },
  { id: 'super-nintendo-world', foto: 'Super Nintendo World Universal Studios Japan', nombre: 'Super Nintendo World', tema: 'otaku', zona: 'kansai', wiki: 'Super Nintendo World', desc: 'El Reino Champiñón de verdad, dentro de Universal Studios Japan en Osaka. Mario Kart, Donkey Kong y pulseras para golpear bloques.' },
  { id: 'nijigen-no-mori', nombre: 'Nijigen no Mori', jp: 'ニジゲンノモリ', tema: 'otaku', zona: 'kansai', wiki: 'Nijigen no Mori', desc: 'Parque en la isla de Awaji con la aldea ninja de Naruto y Boruto, la misión contra Godzilla y la isla de Dragon Quest. A una hora de Osaka en bus directo.' },
  { id: 'den-den-town', nombre: 'Den Den Town', jp: 'でんでんタウン', tema: 'otaku', zona: 'kansai', wiki: 'Nipponbashi', desc: 'El Akihabara de Osaka, en Nipponbashi: figuras, retro y electrónica, con menos gente.' },
  { id: 'museo-manga-kioto', nombre: 'Museo Internacional del Manga', jp: '京都国際マンガミュージアム', tema: 'otaku', zona: 'kansai', wiki: 'Kyoto International Manga Museum', desc: 'Una escuela antigua de Kioto con paredes llenas de manga para sacar y leer tirado en el pasto.' },
  { id: 'one-piece-kumamoto', nombre: 'Estatuas de One Piece en Kumamoto', jp: 'ONE PIECE 麦わらの一味像', tema: 'otaku', zona: 'sur', wiki: 'One Piece', sinArticulo: true, foto: 'One Piece statue Kumamoto', desc: 'Diez estatuas de la tripulación de Luffy por todo Kumamoto, la tierra de Oda, para ayudar a levantar la región después del terremoto de 2016. Chopper está en el zoológico de la ciudad; Zoro, Nami, Robin y Franky, en pueblos como Ōzu o Minamiaso: hace falta carro o un tour. Dónde está Luffy: por confirmar.' },
  { id: 'nu-gundam-fukuoka', nombre: 'ν Gundam de Fukuoka', jp: '実物大νガンダム立像', tema: 'otaku', zona: 'sur', desc: "El ν Gundam de Char's Counterattack a escala real, 24,8 metros hasta la punta, frente al centro comercial LaLaport Fukuoka. Shows cada hora de día y con luces de 19:00 a 21:00. A 9 minutos a pie de la estación JR Takeshita." },
  { id: 'shingeki-hita', nombre: 'Attack on Titan en Hita', jp: '進撃の巨人 in HITA', tema: 'otaku', zona: 'sur', wiki: 'Hita, Ōita', sinArticulo: true, foto: 'Oyama Dam Hita', desc: 'Eren, Mikasa y Armin de niños, en bronce, sobre la represa de Ōyama, y un museo de la serie en la parada de carretera del pueblo. Desde Hita: bus de unos 30 minutos y 20 de caminata.' },

  // ───── tradición ─────
  { id: 'fushimi-inari', nombre: 'Fushimi Inari', jp: '伏見稲荷大社', tema: 'tradicion', zona: 'kansai', wiki: 'Fushimi Inari-taisha', desc: 'Miles de torii naranja montaña arriba. Mejor muy temprano o de noche, cuando se vacía.' },
  { id: 'kinkakuji', nombre: 'Kinkaku-ji, el Pabellón Dorado', jp: '金閣寺', tema: 'tradicion', zona: 'kansai', wiki: 'Kinkaku-ji', desc: 'El templo cubierto de oro reflejado en su estanque. La postal de Kioto.' },
  { id: 'kiyomizudera', nombre: 'Kiyomizu-dera', jp: '清水寺', tema: 'tradicion', zona: 'kansai', wiki: 'Kiyomizu-dera', desc: 'Templo con una terraza de madera colgada sobre el bosque, con vista a todo Kioto.' },
  { id: 'todaiji', nombre: 'Tōdai-ji y los ciervos de Nara', jp: '東大寺', tema: 'tradicion', zona: 'kansai', wiki: 'Tōdai-ji', desc: 'Un Buda de bronce de 15 metros dentro de un salón de madera gigante, rodeado de ciervos que hacen venias por galletas.' },
  { id: 'himeji', nombre: 'Castillo de Himeji', jp: '姫路城', tema: 'tradicion', zona: 'kansai', wiki: 'Himeji Castle', desc: 'El castillo blanco: el mejor conservado de Japón, original, no reconstruido.' },
  { id: 'castillo-osaka', nombre: 'Castillo de Osaka', jp: '大阪城', tema: 'tradicion', zona: 'kansai', wiki: 'Osaka Castle', desc: 'Reconstrucción con museo adentro, fosos enormes y buen parque alrededor.' },
  { id: 'koyasan', nombre: 'Monte Kōya', jp: '高野山', tema: 'tradicion', zona: 'kansai', wiki: 'Mount Kōya', desc: 'Dormir en un templo budista, comer cocina de monjes y caminar de noche por el cementerio de Okunoin, entre cedros.' },
  { id: 'toei-kioto', nombre: 'Toei Kyoto Studio Park', jp: '東映太秦映画村', tema: 'tradicion', zona: 'kansai', wiki: 'Toei Kyoto Studio Park', desc: 'Un pueblo del período Edo que es set de cine de samuráis: shows de ninjas y espadas, y uno se puede disfrazar.' },
  { id: 'sensoji', nombre: 'Sensō-ji', jp: '浅草寺', tema: 'tradicion', zona: 'tokio', wiki: 'Sensō-ji', desc: 'El templo más antiguo de Tokio, en Asakusa, con su linterna roja gigante y la calle de puestos.' },
  { id: 'meiji-jingu', nombre: 'Santuario Meiji', jp: '明治神宮', tema: 'tradicion', zona: 'tokio', wiki: 'Meiji Shrine', desc: 'Un bosque en plena ciudad, al lado de Harajuku, con torii de madera enormes.' },
  { id: 'sengakuji', nombre: 'Sengaku-ji y los 47 rōnin', jp: '泉岳寺', tema: 'tradicion', zona: 'tokio', wiki: 'Sengaku-ji', desc: 'El templo donde están enterrados los 47 samuráis sin amo de la historia de venganza más famosa de Japón.' },
  { id: 'nikko', nombre: 'Nikkō Tōshō-gū', jp: '日光東照宮', tema: 'tradicion', zona: 'kanto', wiki: 'Nikkō Tōshō-gū', desc: 'El mausoleo del shogun Tokugawa Ieyasu, recargado de oro y tallas. Aquí están los tres monos sabios.' },
  { id: 'kamakura', nombre: 'Gran Buda de Kamakura', jp: '鎌倉大仏', tema: 'tradicion', zona: 'kanto', wiki: 'Kōtoku-in', desc: 'Un Buda de bronce al aire libre, de más de 11 metros, en la antigua capital samurái. Paseo de un día desde Tokio.' },
  { id: 'matsumoto', nombre: 'Castillo de Matsumoto', jp: '松本城', tema: 'tradicion', zona: 'chubu', wiki: 'Matsumoto Castle', desc: 'El castillo negro, original, con los Alpes japoneses de fondo.' },
  { id: 'miyajima', nombre: 'Miyajima y el torii flotante', jp: '厳島神社', tema: 'tradicion', zona: 'oeste', wiki: 'Itsukushima Shrine', desc: 'El torii rojo en el mar: con marea alta flota, con marea baja se camina hasta él.' },
  { id: 'kakunodate', nombre: 'Kakunodate', jp: '角館', tema: 'tradicion', zona: 'norte', wiki: 'Kakunodate', desc: 'Barrio de samuráis con casas originales que se pueden visitar por dentro. Famoso por sus cerezos llorones.' },

  // ───── barrios y aldeas ─────
  { id: 'gion', nombre: 'Gion y Higashiyama', jp: '祇園', tema: 'barrios', zona: 'kansai', wiki: 'Gion', desc: 'El barrio de las geishas y las cuestas empedradas de Kioto. Al atardecer se ve alguna maiko camino al trabajo.' },
  { id: 'ine', nombre: 'Ine y sus casas-bote', jp: '伊根の舟屋', tema: 'barrios', zona: 'kansai', wiki: 'Ine, Kyoto', desc: 'Pueblo pesquero al norte de Kioto con casas cuyo primer piso es el garaje del bote.' },
  { id: 'yanaka', nombre: 'Yanaka', jp: '谷中', tema: 'barrios', zona: 'tokio', wiki: 'Yanaka, Tokyo', desc: 'El Tokio viejo que sobrevivió: calle comercial de barrio, templos, cementerio y gatos.' },
  { id: 'kawagoe', nombre: 'Kawagoe', jp: '川越', tema: 'barrios', zona: 'kanto', wiki: 'Kawagoe, Saitama', desc: 'El «pequeño Edo»: bodegas antiguas de paredes negras y una torre de campana, a media hora de Tokio.' },
  { id: 'shirakawa-go', nombre: 'Shirakawa-gō', jp: '白川郷', tema: 'barrios', zona: 'chubu', wiki: 'Shirakawa-gō', desc: 'Aldea de montaña con casas de techo de paja inclinadísimo. En invierno queda enterrada en nieve y algunas noches la iluminan.' },
  { id: 'takayama', nombre: 'Takayama', jp: '高山', tema: 'barrios', zona: 'chubu', wiki: 'Takayama, Gifu', desc: 'Pueblo de madera en los Alpes: casas de mercaderes, sake, mercado matutino y carne de Hida.' },
  { id: 'kanazawa', nombre: 'Kanazawa', jp: '金沢', tema: 'barrios', zona: 'chubu', wiki: 'Kanazawa', desc: 'Barrio de casas de té de Higashi Chaya y barrio samurái de Nagamachi. Un Kioto más tranquilo.' },
  { id: 'nakasendo', nombre: 'Ruta Nakasendō: Magome a Tsumago', jp: '中山道', tema: 'barrios', zona: 'chubu', wiki: 'Tsumago-juku', desc: 'Caminar unos 8 km por el antiguo camino de los samuráis, entre dos pueblos de posta detenidos en el tiempo.' },
  { id: 'kurashiki', nombre: 'Kurashiki', jp: '倉敷', tema: 'barrios', zona: 'oeste', wiki: 'Kurashiki', desc: 'Barrio de canales con sauces y bodegas blancas de mercaderes.' },
  { id: 'ouchi-juku', nombre: 'Ōuchi-juku', jp: '大内宿', tema: 'barrios', zona: 'norte', wiki: 'Ōuchi-juku', desc: 'Una sola calle de casas con techo de paja, antigua parada de viajeros. Se come soba usando un puerro como palillo.' },

  // ───── montes y rutas ─────
  { id: 'kawaguchiko', foto: 'Mount Fuji from Lake Kawaguchiko autumn', nombre: 'Lago Kawaguchi y el Fuji', jp: '河口湖', tema: 'naturaleza', zona: 'kanto', wiki: 'Lake Kawaguchi', desc: 'La mejor vista del Fuji desde abajo. Ojo: el monte se tapa de nubes seguido, sobre todo en verano.' },
  { id: 'chureito', foto: 'Chureito Pagoda', nombre: 'Pagoda Chureito', jp: '忠霊塔', tema: 'naturaleza', zona: 'kanto', wiki: 'Arakurayama Sengen Park', desc: 'La foto: pagoda roja con el Fuji detrás. Casi 400 escalones.' },
  { id: 'hakone', nombre: 'Hakone', jp: '箱根', tema: 'naturaleza', zona: 'kanto', wiki: 'Hakone', desc: 'Aguas termales, teleférico sobre un valle volcánico y barco por el lago Ashi con el Fuji al fondo.' },
  { id: 'takao', nombre: 'Monte Takao', jp: '高尾山', tema: 'naturaleza', zona: 'tokio', wiki: 'Mount Takao', desc: 'Caminata fácil de medio día a una hora del centro de Tokio. Con suerte se ve el Fuji desde la cima.' },
  { id: 'arashiyama', nombre: 'Arashiyama y el bosque de bambú', jp: '嵐山', tema: 'naturaleza', zona: 'kansai', wiki: 'Arashiyama', desc: 'El sendero entre bambúes gigantes al oeste de Kioto. Muy temprano o se vuelve un trancón de gente.' },
  { id: 'kumano-kodo', foto: 'Kumano Kodo Daimonzaka', nombre: 'Kumano Kodō', jp: '熊野古道', tema: 'naturaleza', zona: 'kansai', wiki: 'Kumano Kodō', desc: 'Camino de peregrinación milenario por montañas y bosques, con santuarios y la cascada de Nachi al final.' },
  { id: 'kamikochi', nombre: 'Kamikōchi', jp: '上高地', tema: 'naturaleza', zona: 'chubu', wiki: 'Kamikōchi', meses: [5, 6, 7, 8, 9, 10], desc: 'Valle de los Alpes japoneses con río turquesa y picos de 3.000 metros. Cierra en invierno.' },
  { id: 'alpine-route', nombre: 'Ruta Alpina Tateyama Kurobe', jp: '立山黒部アルペンルート', tema: 'naturaleza', zona: 'chubu', wiki: 'Tateyama Kurobe Alpine Route', meses: [4, 5, 6, 7, 8, 9, 10, 11], desc: 'Cruzar los Alpes en bus, teleférico y funicular. En primavera la carretera pasa entre paredes de nieve de hasta 20 metros.' },
  { id: 'monos-nieve', nombre: 'Monos de Jigokudani', jp: '地獄谷野猿公苑', tema: 'naturaleza', zona: 'chubu', wiki: 'Jigokudani Monkey Park', meses: [12, 1, 2, 3], desc: 'Macacos metidos en aguas termales rodeados de nieve. Vale la pena solo en invierno.' },
  { id: 'shimanami', foto: 'Kurushima Kaikyo Bridge Shimanami', nombre: 'Shimanami Kaidō', jp: 'しまなみ海道', tema: 'naturaleza', zona: 'oeste', wiki: 'Shimanami Kaidō', desc: 'Unos 70 km en bici saltando de isla en isla por puentes sobre el mar interior. Se alquilan bicis y se puede hacer por tramos.' },
  { id: 'yakushima', foto: 'Shiratani Unsuikyo Yakushima forest', nombre: 'Yakushima', jp: '屋久島', tema: 'naturaleza', zona: 'sur', wiki: 'Yakushima', desc: 'Isla de cedros milenarios cubiertos de musgo: el bosque que inspiró La princesa Mononoke.' },

  // ───── jardines, canales y puentes ─────
  { id: 'kenrokuen', nombre: 'Kenroku-en', jp: '兼六園', tema: 'jardines', zona: 'chubu', wiki: 'Kenroku-en', desc: 'Uno de los tres grandes jardines de Japón, en Kanazawa. En invierno amarran los pinos con cuerdas para la nieve.' },
  { id: 'shinjuku-gyoen', nombre: 'Shinjuku Gyoen', jp: '新宿御苑', tema: 'jardines', zona: 'tokio', wiki: 'Shinjuku Gyo-en', desc: 'Jardín enorme en medio de los rascacielos de Shinjuku. De los mejores sitios de Tokio para cerezos y hojas de otoño.' },
  { id: 'rio-meguro', nombre: 'Río Meguro', jp: '目黒川', tema: 'jardines', zona: 'tokio', wiki: 'Meguro River', meses: [3, 4], desc: 'Canal de Nakameguro cubierto por un túnel de cerezos, con faroles de noche. Solo en floración.' },
  { id: 'hitachi', nombre: 'Hitachi Seaside Park', jp: 'ひたち海浜公園', tema: 'jardines', zona: 'kanto', wiki: 'Hitachi Seaside Park', meses: [4, 5, 10], desc: 'Colinas enteras de flores: azules de nemophila en primavera, arbustos rojos de kochia en otoño.' },
  { id: 'ashikaga', nombre: 'Ashikaga Flower Park', jp: 'あしかがフラワーパーク', tema: 'jardines', zona: 'kanto', wiki: 'Ashikaga Flower Park', meses: [4, 5], desc: 'Glicinas centenarias que forman techos morados, iluminadas de noche.' },
  { id: 'camino-filosofia', nombre: 'Camino de la Filosofía', jp: '哲学の道', tema: 'jardines', zona: 'kansai', wiki: "Philosopher's Walk", desc: 'Sendero de piedra junto a un canal bordeado de cerezos, entre templos de Kioto.' },
  { id: 'ritsurin', nombre: 'Jardín Ritsurin', jp: '栗林公園', tema: 'jardines', zona: 'oeste', wiki: 'Ritsurin Garden', desc: 'Jardín de paseo con estanques, puentes y pinos podados uno por uno, en Takamatsu.' },
  { id: 'adachi', nombre: 'Museo de Arte Adachi', jp: '足立美術館', tema: 'jardines', zona: 'oeste', wiki: 'Adachi Museum of Art', desc: 'Un jardín que no se pisa: se mira desde las ventanas como si fuera un cuadro.' },
  { id: 'kintaikyo', nombre: 'Puente Kintai', jp: '錦帯橋', tema: 'jardines', zona: 'oeste', wiki: 'Kintai Bridge', desc: 'Cinco arcos de madera sobre el río, en Iwakuni. Queda de paso entre Hiroshima y Miyajima.' },
  { id: 'iya', nombre: 'Puentes de lianas del valle de Iya', jp: '祖谷のかずら橋', tema: 'jardines', zona: 'oeste', wiki: 'Iya Valley', desc: 'Puentes colgantes hechos de lianas sobre un cañón remoto de Shikoku. Se mueven bastante.' },
  { id: 'yanagawa', nombre: 'Canales de Yanagawa', jp: '柳川', tema: 'jardines', zona: 'sur', wiki: 'Yanagawa, Fukuoka', desc: 'Paseo en bote empujado con pértiga por los canales de un pueblo castillo.' },

  // ───── arte y museos ─────
  { id: 'naoshima', nombre: 'Naoshima', jp: '直島', tema: 'arte', zona: 'oeste', wiki: 'Naoshima, Kagawa', desc: 'La isla del arte: la calabaza de Kusama en el muelle, museos de Tadao Ando bajo tierra y casas viejas convertidas en obras.' },
  { id: 'teshima', nombre: 'Museo de Arte de Teshima', jp: '豊島美術館', tema: 'arte', zona: 'oeste', wiki: 'Teshima Art Museum', desc: 'Una gota de concreto gigante y vacía, donde solo hay agua moviéndose por el piso. Isla vecina de Naoshima.' },
  { id: 'teamlab', foto: 'teamLab Planets Tokyo', nombre: 'teamLab', jp: 'チームラボ', tema: 'arte', zona: 'tokio', wiki: 'TeamLab (art collective)', desc: 'Arte digital inmersivo: en Planets se camina descalzo por agua; Borderless es un laberinto de proyecciones. Con reserva.' },
  { id: 'museo-nacional-tokio', nombre: 'Museo Nacional de Tokio', jp: '東京国立博物館', tema: 'arte', zona: 'tokio', wiki: 'Tokyo National Museum', desc: 'Armaduras de samurái, katanas, biombos y budas. El museo más grande del país, en el parque de Ueno.' },
  { id: 'museo-espadas', nombre: 'Museo de la Espada Japonesa', jp: '刀剣博物館', tema: 'arte', zona: 'tokio', wiki: 'Japanese Sword Museum', desc: 'Pequeño y solo de katanas, en Ryōgoku, al lado del estadio de sumo.' },
  { id: 'hakone-esculturas', nombre: 'Museo al Aire Libre de Hakone', jp: '彫刻の森美術館', tema: 'arte', zona: 'kanto', wiki: 'Hakone Open-Air Museum', desc: 'Esculturas gigantes en una ladera con montañas de fondo, un pabellón de Picasso y un baño de pies termal.' },
  { id: 'museo-siglo-21', nombre: 'Museo del Siglo XXI de Kanazawa', jp: '金沢21世紀美術館', tema: 'arte', zona: 'chubu', wiki: '21st Century Museum of Contemporary Art, Kanazawa', desc: 'Museo circular de vidrio, famoso por la piscina en la que parece que la gente camina bajo el agua.' },
  { id: 'hiroshima', nombre: 'Museo y Parque de la Paz de Hiroshima', jp: '広島平和記念資料館', tema: 'arte', zona: 'oeste', wiki: 'Hiroshima Peace Memorial Museum', desc: 'El museo de la bomba atómica y la cúpula que quedó en pie. Duro y necesario.' },

  // ───── ciudad y neón ─────
  { id: 'shibuya', nombre: 'Cruce de Shibuya', jp: '渋谷スクランブル交差点', tema: 'ciudad', zona: 'tokio', wiki: 'Shibuya Crossing', desc: 'El cruce peatonal más famoso del mundo. Desde el mirador Shibuya Sky se ve desde arriba; se reserva con anticipación.' },
  { id: 'shinjuku', nombre: 'Shinjuku de noche', jp: '新宿', tema: 'ciudad', zona: 'tokio', wiki: 'Shinjuku Golden Gai', desc: 'Neones de Kabukichō, los bares diminutos de Golden Gai y las brasas del callejón Omoide Yokochō.' },
  { id: 'torre-tokio', nombre: 'Torre de Tokio', jp: '東京タワー', tema: 'ciudad', zona: 'tokio', wiki: 'Tokyo Tower', desc: 'La torre roja y blanca. De noche, iluminada, es el fondo de medio anime.' },
  { id: 'harajuku', nombre: 'Harajuku y Takeshita', jp: '原宿', tema: 'ciudad', zona: 'tokio', wiki: 'Takeshita Street', desc: 'La calle de la moda adolescente: crepas, tiendas raras y gente vestida como quiere.' },
  { id: 'tsukiji', nombre: 'Mercado exterior de Tsukiji', jp: '築地場外市場', tema: 'ciudad', zona: 'tokio', wiki: 'Tsukiji', desc: 'Callejones de puestos para desayunar sushi, tamagoyaki y mariscos a la brasa.' },
  { id: 'shimokitazawa', nombre: 'Shimokitazawa', jp: '下北沢', tema: 'ciudad', zona: 'tokio', wiki: 'Shimokitazawa', desc: 'Ropa de segunda, vinilos, cafés y bares de música en vivo. El barrio alternativo de Tokio.' },
  { id: 'yokohama', nombre: 'Yokohama', jp: '横浜', tema: 'ciudad', zona: 'kanto', wiki: 'Minato Mirai 21', desc: 'Bahía con rueda gigante, el barrio chino más grande de Japón y museos de ramen. A media hora de Tokio.' },
  { id: 'dotonbori', nombre: 'Dōtonbori', jp: '道頓堀', tema: 'ciudad', zona: 'kansai', wiki: 'Dōtonbori', desc: 'El canal de neones de Osaka: el letrero de Glico, cangrejos mecánicos y takoyaki en cada esquina.' },
  { id: 'shinsekai', nombre: 'Shinsekai', jp: '新世界', tema: 'ciudad', zona: 'kansai', wiki: 'Shinsekai', desc: 'Barrio retro de Osaka bajo la torre Tsūtenkaku. Aquí se come kushikatsu, pinchos fritos.' },

  // ───── carros y noche ─────
  { id: 'daikoku', nombre: 'Daikoku PA', jp: '大黒PA', tema: 'motor', zona: 'kanto', wiki: 'Daikoku Parking Area', desc: 'El parqueadero de autopista donde se juntan los carros modificados. Solo se llega en carro (taxi o tour), y la policía lo cierra seguido.' },
  { id: 'shuto', foto: 'Shuto Expressway Tokyo night', nombre: 'Autopista Shuto y la Wangan', jp: '首都高', tema: 'motor', zona: 'tokio', wiki: 'Shuto Expressway', desc: 'El anillo elevado entre edificios y la recta de la bahía, de noche. Se hace en tour o alquilando carro.' },
  { id: 'haruna', nombre: 'Monte Haruna', jp: '榛名山', tema: 'motor', zona: 'kanto', wiki: 'Mount Haruna', desc: 'El «Akina» de Initial D: la carretera de curvas es real y está en Gunma.' },
  { id: 'turnpike', nombre: 'Hakone Turnpike', jp: '箱根ターンパイク', tema: 'motor', zona: 'kanto', wiki: 'Hakone Turnpike', desc: 'Carretera de montaña de peaje, clásica para manejar y con vista al Fuji.' },
  { id: 'fuji-speedway', nombre: 'Fuji Speedway', jp: '富士スピードウェイ', tema: 'motor', zona: 'kanto', wiki: 'Fuji Speedway', desc: 'Circuito a los pies del Fuji, con un museo de automovilismo al lado.' },
  { id: 'nissan-heritage', nombre: 'Colección Nissan Heritage', jp: '日産ヘリテージコレクション', tema: 'motor', zona: 'kanto', wiki: 'Nissan Heritage Collection', desc: 'Bodega en Zama con cientos de carros históricos de Nissan, Skyline y GT-R incluidos. Solo con reserva.' },
  { id: 'suzuka', foto: 'Suzuka Circuit ferris wheel', nombre: 'Circuito de Suzuka', jp: '鈴鹿サーキット', tema: 'motor', zona: 'chubu', wiki: 'Suzuka International Racing Course', desc: 'El circuito en forma de ocho donde corre la Fórmula 1. Tiene parque de diversiones al lado.' },
  { id: 'museo-toyota', nombre: 'Museo del Automóvil Toyota', jp: 'トヨタ博物館', tema: 'motor', zona: 'chubu', wiki: 'Toyota Automobile Museum', desc: 'Historia del carro, no solo de Toyota. Queda cerca de Nagoya, al lado de Ghibli Park.' },
  { id: 'museo-mazda', nombre: 'Museo Mazda', jp: 'マツダミュージアム', tema: 'motor', zona: 'oeste', wiki: 'Mazda Museum', desc: 'Dentro de la fábrica en Hiroshima: motores rotativos, el 787B de Le Mans y un tramo de línea de ensamble. Con reserva.' },
  { id: 'ebisu', foto: 'Ebisu Circuit drift', nombre: 'Circuito Ebisu', jp: 'エビスサーキット', tema: 'motor', zona: 'norte', wiki: 'Ebisu Circuit', desc: 'La meca del drift, en las montañas de Fukushima.' },

  // ───── raro pero bacano ─────
  { id: 'kappabashi', nombre: 'Kappabashi', jp: 'かっぱ橋道具街', tema: 'raro', zona: 'tokio', wiki: 'Kappabashi-dori', desc: 'La calle de los implementos de cocina: cuchillos japoneses y la comida de plástico de las vitrinas.' },
  { id: 'museo-parasitos', nombre: 'Museo de Parásitos de Meguro', jp: '目黒寄生虫館', tema: 'raro', zona: 'tokio', wiki: 'Meguro Parasitological Museum', desc: 'Lo que dice el nombre, incluida una tenia de casi 9 metros. Gratis.' },
  { id: 'ushiku', nombre: 'Gran Buda de Ushiku', jp: '牛久大仏', tema: 'raro', zona: 'kanto', wiki: 'Ushiku Daibutsu', desc: 'Una estatua de 120 metros a la que se le sube por dentro en ascensor.' },
  { id: 'cup-noodles', nombre: 'Museo Cup Noodles', jp: 'カップヌードルミュージアム', tema: 'raro', zona: 'kansai', wiki: 'Momofuku Ando Instant Ramen Museum', desc: 'En Ikeda, cerca de Osaka, donde se inventó el ramen instantáneo. Uno diseña y arma su propio vaso.' },
  { id: 'yoro', nombre: 'Parque Yōrō', jp: '養老天命反転地', tema: 'raro', zona: 'chubu', wiki: 'Site of Reversible Destiny', desc: 'Un parque-obra de arte de pisos inclinados y cuartos al revés, hecho para desorientar.' },
  { id: 'okunoshima', nombre: 'Ōkunoshima, la isla de los conejos', jp: '大久野島', tema: 'raro', zona: 'oeste', wiki: 'Ōkunoshima', desc: 'Cientos de conejos sueltos que lo persiguen a uno, en una isla que fue fábrica secreta de gas venenoso.' },
  { id: 'tottori', nombre: 'Dunas de Tottori', jp: '鳥取砂丘', tema: 'raro', zona: 'oeste', wiki: 'Tottori Sand Dunes', desc: 'Un desierto frente al mar, con camellos y un museo de esculturas de arena.' },
  { id: 'nagoro', nombre: 'Nagoro, el pueblo de los muñecos', jp: '名頃', tema: 'raro', zona: 'oeste', wiki: 'Nagoro', desc: 'Una aldea casi vacía donde una vecina fue reemplazando a los que se iban con muñecos de tamaño real.' },
  { id: 'tashirojima', nombre: 'Tashirojima, la isla de los gatos', jp: '田代島', tema: 'raro', zona: 'norte', wiki: 'Tashirojima', desc: 'Más gatos que personas, y un santuario dedicado a ellos.' },
  { id: 'zao-zorros', foto: 'Zao Fox Village', nombre: 'Pueblo de zorros de Zaō', jp: '蔵王キツネ村', tema: 'raro', zona: 'norte', wiki: 'Miyagi Zao Fox Village', desc: 'Un bosque cercado donde más de cien zorros andan sueltos entre los visitantes.' },
  { id: 'gunkanjima', nombre: 'Gunkanjima', jp: '軍艦島', tema: 'raro', zona: 'sur', wiki: 'Hashima Island', desc: 'La isla acorazado: una ciudad minera de concreto abandonada en el mar, frente a Nagasaki. Se visita en tour en barco.' },
  { id: 'beppu', nombre: 'Infiernos de Beppu', jp: '別府地獄', tema: 'raro', zona: 'sur', wiki: 'Hells of Beppu', desc: 'Pozos termales para mirar, no para meterse: uno azul cobalto, uno rojo sangre, uno de lodo hirviendo.' },

  // ───── eventos y temporada ─────
  { id: 'hanami', nombre: 'Hanami: cerezos en flor', jp: '花見', tema: 'eventos', zona: 'tokio', wiki: 'Hanami', meses: [3, 4], desc: 'Picnic bajo los cerezos en Ueno, Chidorigafuchi o Yoyogi. La floración dura cerca de una semana y la fecha cambia cada año.' },
  { id: 'sumo', nombre: 'Torneo de sumo', jp: '大相撲', tema: 'eventos', zona: 'tokio', wiki: 'Ryōgoku Kokugikan', meses: [1, 3, 5, 7, 9, 11], desc: 'Seis torneos al año, de 15 días: Tokio en enero, mayo y septiembre; Osaka en marzo, Nagoya en julio y Fukuoka en noviembre.' },
  { id: 'fuegos-sumida', nombre: 'Fuegos artificiales del Sumida', jp: '隅田川花火大会', tema: 'eventos', zona: 'tokio', wiki: 'Sumidagawa Fireworks Festival', meses: [7], desc: 'El espectáculo de pólvora más tradicional de Tokio, el último sábado de julio. La gente va en yukata.' },
  { id: 'comiket', foto: 'Comic Market Tokyo Big Sight crowd', nombre: 'Comiket', jp: 'コミックマーケット', tema: 'eventos', zona: 'tokio', wiki: 'Comiket', meses: [8, 12], desc: 'La feria de manga autopublicado más grande del mundo, dos veces al año en Tokyo Big Sight. Multitudes y cosplay.' },
  { id: 'auto-salon', nombre: 'Tokyo Auto Salon', jp: '東京オートサロン', tema: 'eventos', zona: 'kanto', wiki: 'Tokyo Auto Salon', meses: [1], desc: 'La feria de carros modificados más grande de Japón, en enero, en Makuhari.' },
  { id: 'game-show', nombre: 'Tokyo Game Show', jp: '東京ゲームショウ', tema: 'eventos', zona: 'kanto', wiki: 'Tokyo Game Show', meses: [9], desc: 'La feria de videojuegos, en septiembre, en Makuhari. Tiene días abiertos al público.' },
  { id: 'subir-fuji', nombre: 'Subir el monte Fuji', jp: '富士登山', tema: 'eventos', zona: 'kanto', wiki: 'Mount Fuji', meses: [7, 8, 9], desc: 'Solo en la temporada oficial: en 2026 fue del 1 de julio (ruta Yoshida) o el 10 de julio (rutas de Shizuoka) al 10 de septiembre; la de 2027 está por confirmar. Se sube de noche para ver el amanecer; hoy hay cupos y cobro de entrada.' },
  { id: 'kanamara', nombre: 'Kanamara Matsuri', jp: 'かなまら祭', tema: 'eventos', zona: 'kanto', wiki: 'Kanamara Matsuri', meses: [4], desc: 'El festival del falo de acero, en Kawasaki, el primer domingo de abril. Tal cual suena.' },
  { id: 'gion-matsuri', nombre: 'Gion Matsuri', jp: '祇園祭', tema: 'eventos', zona: 'kansai', wiki: 'Gion Matsuri', meses: [7], desc: 'El festival más famoso de Japón, todo julio en Kioto, con carrozas gigantes de madera arrastradas a mano.' },
  { id: 'momiji-kioto', nombre: 'Hojas rojas en Kioto', jp: '紅葉', tema: 'eventos', zona: 'kansai', wiki: 'Tōfuku-ji', meses: [11, 12], desc: 'Los arces se ponen rojos de mediados de noviembre a principios de diciembre; el promedio oficial en Kioto es el 5 de diciembre. Tōfuku-ji y Eikan-dō son los clásicos.' },
  { id: 'takayama-matsuri', nombre: 'Festival de Takayama', jp: '高山祭', tema: 'eventos', zona: 'chubu', wiki: 'Takayama Festival', meses: [4, 10], desc: 'Carrozas doradas con marionetas mecánicas, el 14 y 15 de abril y el 9 y 10 de octubre.' },
  { id: 'nabana', nombre: 'Iluminación de Nabana no Sato', jp: 'なばなの里', tema: 'eventos', zona: 'chubu', wiki: 'Nabana no Sato', meses: [10, 11, 12, 1, 2, 3, 4, 5], desc: 'Millones de luces LED: túneles enteros y un campo que cuenta una historia. De las iluminaciones de invierno más grandes.' },
  { id: 'f1-suzuka', foto: 'Japanese Grand Prix Suzuka Formula One', nombre: 'Gran Premio de Japón de F1', jp: 'F1日本グランプリ', tema: 'eventos', zona: 'chubu', wiki: 'Japanese Grand Prix', meses: [4], desc: 'En Suzuka. En 2027 es del 9 al 11 de abril, con carrera sprint (calendario oficial de la F1, anunciado en septiembre de 2026).' },
  { id: 'awa-odori', nombre: 'Awa Odori', jp: '阿波おどり', tema: 'eventos', zona: 'oeste', wiki: 'Awa Dance Festival', meses: [8], desc: 'El festival de baile más grande de Japón, del 11 al 15 de agosto en Tokushima.' },
  { id: 'nebuta', nombre: 'Nebuta Matsuri', jp: '青森ねぶた祭', tema: 'eventos', zona: 'norte', wiki: 'Aomori Nebuta Matsuri', meses: [8], desc: 'Carrozas gigantes de papel iluminadas, con guerreros y demonios, del 2 al 7 de agosto en Aomori.' },
  { id: 'nieve-sapporo', nombre: 'Festival de la Nieve de Sapporo', jp: 'さっぽろ雪まつり', tema: 'eventos', zona: 'norte', wiki: 'Sapporo Snow Festival', meses: [2], desc: 'Esculturas de nieve y hielo del tamaño de edificios, una semana a principios de febrero.' },
  { id: 'niseko', nombre: 'Esquiar en Niseko', jp: 'ニセコ', tema: 'eventos', zona: 'norte', wiki: 'Niseko, Hokkaido', meses: [12, 1, 2, 3], desc: 'La nieve polvo de Hokkaido, de la mejor del mundo, con aguas termales al final del día.' },
];
