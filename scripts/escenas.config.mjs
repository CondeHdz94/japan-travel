// Configuración de las escenas de anime: qué series se buscan en anitabi, cómo se llaman aquí,
// y a qué lugar del catálogo pertenece cada punto. La usa scripts/escenas.mjs.
//
// Reglas de nombre (decididas con el grupo): el de Latinoamérica si es conocido; si no, el inglés
// oficial; si no, el rōmaji. Nunca en letra japonesa. El rōmaji va debajo cuando es distinto.
// «estudio» es quien hizo la animación (AniList); no es el dueño de los derechos.

/**
 * Cada serie agrupa sus temporadas, películas y especiales: en el sitio se ven como una sola obra.
 * `partes` es el id de cada entrega en bgm.tv (el que usa anitabi) y cómo se llama esa entrega
 * cuando no es la primera.
 */
export const SERIES = {
  'death-note': { nombre: 'Death Note', romaji: 'Death Note', estudio: 'Madhouse', partes: { 1773: null } },
  'jujutsu-kaisen': { nombre: 'Jujutsu Kaisen', romaji: 'Jujutsu Kaisen', estudio: 'MAPPA', partes: { 294993: null, 369304: 'Temporada 2' } },
  'your-name': { nombre: 'Your Name', romaji: 'Kimi no Na wa.', estudio: 'CoMix Wave Films', partes: { 160209: null } },
  suzume: { nombre: 'Suzume', romaji: 'Suzume no Tojimari', estudio: 'CoMix Wave Films', partes: { 362577: null } },
  'tenki-no-ko': { nombre: 'El tiempo contigo', romaji: 'Tenki no Ko', estudio: 'CoMix Wave Films', partes: { 269235: null } },
  'oshi-no-ko': { nombre: 'Oshi no Ko', estudio: 'Doga Kobo', partes: { 386809: null, 443428: 'Temporada 2', 517057: 'Temporada 3' } },
  'bocchi-the-rock': { nombre: 'Bocchi the Rock!', romaji: 'Bocchi the Rock!', estudio: 'CloverWorks', partes: { 328609: null } },
  'tokyo-ghoul': { nombre: 'Tokyo Ghoul', romaji: 'Tokyo Ghoul', estudio: 'Studio Pierrot', partes: { 93714: null, 115292: '√A' } },
  'lycoris-recoil': { nombre: 'Lycoris Recoil', romaji: 'Lycoris Recoil', estudio: 'A-1 Pictures', partes: { 364450: null } },
  'kotonoha-no-niwa': { nombre: 'El jardín de las palabras', romaji: 'Kotonoha no Niwa', estudio: 'CoMix Wave Films', partes: { 58949: null } },
  'byousoku-5-cm': { nombre: '5 centímetros por segundo', romaji: 'Byousoku 5 Centimeter', estudio: 'CoMix Wave Films', partes: { 927: null } },
  'kimi-no-uso': { nombre: 'Your Lie in April', romaji: 'Shigatsu wa Kimi no Uso', estudio: 'A-1 Pictures', partes: { 100444: null } },
  shirobako: { nombre: 'Shirobako', romaji: 'Shirobako', estudio: 'P.A. Works', partes: { 110467: null } },
  'sword-art-online': { nombre: 'Sword Art Online', romaji: 'Sword Art Online', estudio: 'A-1 Pictures', partes: { 92382: 'Sword Art Online II', 148099: 'Ordinal Scale (película)' } },
  toradora: { nombre: 'Toradora!', romaji: 'Toradora!', estudio: 'J.C.Staff', partes: { 909: null } },
  'k-on': { nombre: 'K-On!', romaji: 'K-ON!', estudio: 'Kyoto Animation', partes: { 1424: null, 3774: 'K-On!! (temporada 2)' } },
  euphonium: {
    nombre: 'Sound! Euphonium', romaji: 'Hibike! Euphonium', estudio: 'Kyoto Animation',
    partes: { 115908: null, 152091: 'Temporada 2', 283643: 'Temporada 3', 216372: 'Película: Our Promise', 386195: 'Ensemble Contest' },
  },
  'love-live': {
    nombre: 'Love Live!', romaji: 'Love Live!', estudio: 'Sunrise',
    partes: { 49294: 'School Idol Project', 165553: 'Sunshine!!', 210272: 'Sunshine!! temporada 2', 296659: 'Nijigasaki', 442615: 'Nijigasaki: película final, parte 2', 306742: 'Superstar!!', 404480: 'Superstar!! temporada 3' },
  },
  'lucky-star': { nombre: 'Lucky Star', romaji: 'Lucky☆Star', estudio: 'Kyoto Animation', partes: { 276: null } },
  'chou-kaguya-hime': { nombre: 'Cosmic Princess Kaguya!', romaji: 'Chou Kaguya-hime!', estudio: 'Studio Colorido y Studio Chromato', partes: { 604826: null } },
  'kaguya-sama': { nombre: 'Kaguya-sama: Love is War', romaji: 'Kaguya-sama wa Kokurasetai', estudio: 'A-1 Pictures', partes: { 248175: null, 293049: 'Temporada 2' } },
  horimiya: { nombre: 'Horimiya', romaji: 'Horimiya', estudio: 'CloverWorks', partes: { 315069: null } },
  'detective-conan': {
    nombre: 'Detective Conan', romaji: 'Meitantei Conan', estudio: 'TMS Entertainment',
    partes: { 359930: 'The Bride of Halloween (película)', 429644: 'The Million-dollar Pentagram (película)' },
  },
  // 仮 = título provisional: no hay cómo confirmar qué obra es
  grotesque: { nombre: 'GROTESQUE', romaji: 'Grotesque (título provisional)', estudio: null, dudoso: true, partes: { 502499: null } },
  'steins-gate': { nombre: 'Steins;Gate', romaji: 'Steins;Gate', estudio: 'White Fox', partes: { 10380: null, 129807: 'Steins;Gate 0' } },
  'tonari-no-kyuuketsuki': { nombre: 'Ms. Vampire Who Lives in My Neighborhood', romaji: 'Tonari no Kyuuketsuki-san', estudio: 'Studio Gokumi y AXsiZ', partes: { 241158: null } },
  'blue-lock': { nombre: 'Blue Lock', romaji: 'Blue Lock', estudio: '8-bit', partes: { 426124: 'Episode Nagi (película)' } },
  durarara: { nombre: 'Durarara!!', romaji: 'Durarara!!', estudio: "Brain's Base", partes: { 2463: null } },
  'bungo-stray-dogs': { nombre: 'Bungo Stray Dogs', romaji: 'Bungou Stray Dogs', estudio: 'Bones', partes: { 144357: null } },
  clannad: { nombre: 'Clannad', romaji: 'Clannad', estudio: 'Kyoto Animation', partes: { 876: 'After Story' } },
  'yuru-camp': {
    nombre: 'Laid-Back Camp', romaji: 'Yuru Camp△', estudio: 'C-Station y 8-bit',
    partes: { 207195: null, 262897: 'Temporada 2', 405785: 'Temporada 3', 262898: 'Película' },
  },
  hyouka: { nombre: 'Hyouka', romaji: 'Hyouka', estudio: 'Kyoto Animation', partes: { 27364: null } },
  'slam-dunk': { nombre: 'Slam Dunk', romaji: 'Slam Dunk', estudio: 'Toei Animation', partes: { 1608: null } },
  'rock-wa-lady': { nombre: "Rock Is a Lady's Modesty", romaji: 'Rock wa Lady no Tashinami Deshite', estudio: 'Bandai Namco Pictures', partes: { 504678: null } },
  evangelion: { nombre: 'Neon Genesis Evangelion', romaji: 'Shin Seiki Evangelion', estudio: 'Gainax y Tatsunoko Production', partes: { 265: null } },
};

/**
 * A qué lugar del catálogo va cada punto: el primero cuya palabra clave aparezca en el nombre del
 * punto. El orden importa: «新宿御苑» va antes que «新宿». `principal` sube a la escena que mejor
 * representa el lugar (se puede cambiar a mano en src/data/escenas-revision.json).
 */
export const LUGARES = [
  ['shinjuku-gyoen', ['新宿御苑', '千駄ヶ谷'], null],
  ['shibuya', ['渋谷', 'スクランブル', 'ハチ公', '宮下', 'センター街'], 'スクランブル'],
  ['shinjuku', ['新宿駅', '新宿東口', '新宿西口', '歌舞伎町', '西新宿', 'LABI新宿', '新宿南口', '新宿'], null],
  ['akihabara', ['秋葉原', 'アキバ', '神田明神', '末広町', '万世橋', 'ラジオ会館'], null],
  ['ikebukuro', ['池袋', 'サンシャイン'], null],
  ['harajuku', ['原宿', '表参道', '竹下'], null],
  ['shimokitazawa', ['下北沢'], null],
  ['yokohama', ['横浜', 'みなとみらい', '山下公園', '赤レンガ', '大さん橋', '桜木町'], null],
  ['kamakura', ['鎌倉', '江ノ電', '七里ヶ浜', '江ノ島'], '踏切'],
  ['hakone', ['箱根', '芦ノ湖', '仙石原', '強羅', '湯本'], null],
  ['kawaguchiko', ['河口湖', '本栖湖', '精進湖', '西湖', '富士吉田'], '本栖湖'],
  ['takayama', ['高山', '飛騨', '古川'], null],
  ['torre-tokio', ['東京タワー', '芝公園'], null],
  ['yanaka', ['谷中', '日暮里'], null],
  ['sensoji', ['浅草', '雷門'], null],
  ['meiji-jingu', ['明治神宮'], null],
  ['museo-nintendo', ['宇治', '平等院'], '宇治橋'],
  ['fushimi-inari', ['伏見稲荷'], null],
  ['arashiyama', ['嵐山', '渡月橋'], null],
  ['gion', ['祇園', '八坂', '花見小路'], null],
  ['kiyomizudera', ['清水寺'], null],
  ['camino-filosofia', ['哲学の道'], null],
  ['gundam-odaiba', ['お台場', '台場'], null],
  ['rio-meguro', ['目黒川', '中目黒'], null],
  ['tsukiji', ['築地'], null],
  ['kawagoe', ['川越'], null],
  ['castillo-osaka', ['大阪城'], null],
  ['dotonbori', ['道頓堀'], null],
  ['shinsekai', ['新世界', '通天閣'], null],
  ['nikko', ['日光'], null],
  ['kanazawa', ['金沢'], null],
  ['nakano-broadway', ['中野'], null],
  ['museo-ghibli', ['三鷹', '井の頭', '吉祥寺'], null],
  ['hiroshima', ['広島'], null],
];

/** Puntos que caen en un lugar solo porque el nombre se parece. */
export const EXCLUIDOS = {
  '262897:f5jmdz3': '旧鎌倉往還 es un camino antiguo de otra zona: solo coincide «鎌倉» en el nombre',
};
