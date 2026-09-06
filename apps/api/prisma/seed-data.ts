export const categorySeeds = [
  { slug: 'electronics', nameRu: 'Электроника', position: 10 },
  { slug: 'phones-computers', nameRu: 'Телефоны и компьютеры', position: 20 },
  { slug: 'auto', nameRu: 'Авто', position: 30 },
  { slug: 'home-furniture', nameRu: 'Дом и мебель', position: 40 },
  { slug: 'clothing', nameRu: 'Одежда', position: 50 },
  { slug: 'children', nameRu: 'Детское', position: 60 },
  { slug: 'sports-hobbies', nameRu: 'Спорт и хобби', position: 70 },
  { slug: 'services', nameRu: 'Услуги', position: 80 },
] as const;

type RegionSeed = {
  regionRu: string;
  cities: ReadonlyArray<readonly [slug: string, nameRu: string]>;
};

const regionSeeds: readonly RegionSeed[] = [
  {
    regionRu: 'Города республиканского значения',
    cities: [
      ['almaty', 'Алматы'],
      ['astana', 'Астана'],
      ['shymkent', 'Шымкент'],
    ],
  },
  {
    regionRu: 'Область Абай',
    cities: [
      ['semey', 'Семей'],
      ['kurchatov', 'Курчатов'],
      ['ayagoz', 'Аягоз'],
      ['shar', 'Шар'],
    ],
  },
  {
    regionRu: 'Акмолинская область',
    cities: [
      ['kokshetau', 'Кокшетау'],
      ['kosshy', 'Косшы'],
      ['stepnogorsk', 'Степногорск'],
      ['akkol', 'Акколь'],
      ['atbasar', 'Атбасар'],
      ['derzhavinsk', 'Державинск'],
      ['ereymentau', 'Ерейментау'],
      ['esil', 'Есиль'],
      ['makinsk', 'Макинск'],
      ['stepnyak', 'Степняк'],
      ['shchuchinsk', 'Щучинск'],
    ],
  },
  {
    regionRu: 'Актюбинская область',
    cities: [
      ['aktobe', 'Актобе'],
      ['alga', 'Алга'],
      ['zhem', 'Жем'],
      ['kandyagash', 'Кандыагаш'],
      ['temir', 'Темир'],
      ['khromtau', 'Хромтау'],
      ['shalkar', 'Шалкар'],
      ['emba', 'Эмба'],
    ],
  },
  {
    regionRu: 'Алматинская область',
    cities: [
      ['konaev', 'Конаев'],
      ['esik', 'Есик'],
      ['kaskelen', 'Каскелен'],
      ['talgar', 'Талгар'],
      ['alatau', 'Алатау'],
    ],
  },
  {
    regionRu: 'Атырауская область',
    cities: [
      ['atyrau', 'Атырау'],
      ['kulsary', 'Кульсары'],
    ],
  },
  {
    regionRu: 'Западно-Казахстанская область',
    cities: [
      ['uralsk', 'Уральск'],
      ['aksay', 'Аксай'],
    ],
  },
  {
    regionRu: 'Жамбылская область',
    cities: [
      ['taraz', 'Тараз'],
      ['karatau', 'Каратау'],
      ['zhanatas', 'Жанатас'],
      ['shu', 'Шу'],
    ],
  },
  {
    regionRu: 'Область Жетысу',
    cities: [
      ['taldykorgan', 'Талдыкорган'],
      ['tekeli', 'Текели'],
      ['usharal', 'Ушарал'],
      ['ushtobe', 'Уштобе'],
      ['sarkand', 'Сарканд'],
      ['zharkent', 'Жаркент'],
    ],
  },
  {
    regionRu: 'Карагандинская область',
    cities: [
      ['karaganda', 'Караганда'],
      ['balkhash', 'Балхаш'],
      ['priozersk', 'Приозёрск'],
      ['saran', 'Сарань'],
      ['temirtau', 'Темиртау'],
      ['shakhtinsk', 'Шахтинск'],
      ['abay', 'Абай'],
      ['karkaralinsk', 'Каркаралинск'],
    ],
  },
  {
    regionRu: 'Костанайская область',
    cities: [
      ['kostanay', 'Костанай'],
      ['arkalyk', 'Аркалык'],
      ['lisakovsk', 'Лисаковск'],
      ['rudny', 'Рудный'],
      ['zhitikara', 'Житикара'],
      ['tobyl', 'Тобыл'],
    ],
  },
  {
    regionRu: 'Кызылординская область',
    cities: [
      ['kyzylorda', 'Кызылорда'],
      ['baikonur', 'Байконур'],
      ['aralsk', 'Аральск'],
      ['kazalinsk', 'Казалинск'],
    ],
  },
  {
    regionRu: 'Мангистауская область',
    cities: [
      ['aktau', 'Актау'],
      ['zhanaozen', 'Жанаозен'],
      ['fort-shevchenko', 'Форт-Шевченко'],
    ],
  },
  {
    regionRu: 'Павлодарская область',
    cities: [
      ['pavlodar', 'Павлодар'],
      ['aksu', 'Аксу'],
      ['ekibastuz', 'Экибастуз'],
    ],
  },
  {
    regionRu: 'Северо-Казахстанская область',
    cities: [
      ['petropavlovsk', 'Петропавловск'],
      ['bulaevo', 'Булаево'],
      ['mamlyutka', 'Мамлютка'],
      ['sergeevka', 'Сергеевка'],
      ['taiynsha', 'Тайынша'],
    ],
  },
  {
    regionRu: 'Туркестанская область',
    cities: [
      ['turkistan', 'Туркестан'],
      ['arys', 'Арыс'],
      ['kentau', 'Кентау'],
      ['zhetysay', 'Жетысай'],
      ['lenger', 'Ленгер'],
      ['saryagash', 'Сарыагаш'],
      ['shardara', 'Шардара'],
    ],
  },
  {
    regionRu: 'Область Улытау',
    cities: [
      ['zhezkazgan', 'Жезказган'],
      ['satpayev', 'Сатпаев'],
      ['karazhal', 'Каражал'],
    ],
  },
  {
    regionRu: 'Восточно-Казахстанская область',
    cities: [
      ['ust-kamenogorsk', 'Усть-Каменогорск'],
      ['ridder', 'Риддер'],
      ['altai', 'Алтай'],
      ['zaysan', 'Зайсан'],
      ['serebryansk', 'Серебрянск'],
      ['shemonaikha', 'Шемонаиха'],
    ],
  },
];

export const citySeeds = regionSeeds.flatMap(({ regionRu, cities }) =>
  cities.map(([slug, nameRu]) => ({ slug, nameRu, regionRu })),
);
