// ============================================================================
// Параметры мира онлайн-кинотеатра «КИНОПОТОК».
// Денежная единица — рубли, шаг времени — 1 месяц.
//
// Текстовые поля двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

export const CONFIG = {
  monthsTotal: 36,          // партия — три года
  startCash: 4_000_000_000, // деньги инвестора на старте

  // --- Каталог ---
  // Лицензии дешевле, но истекают и есть у конкурентов. Оригиналы дороже,
  // остаются навсегда, но выходят с задержкой и могут провалиться.
  licenseDecay: 0.045,        // доля лицензионных часов, истекающая за месяц
  licenseCostPerHour: 600_000,  // ₽ за час лицензионного контента
  // Лицензия есть и у конкурентов, поэтому она хуже удерживает: тот же час
  // чужого контента создаёт вдвое меньше причин подписаться именно на вас.
  licenseDepthWeight: 0.5,
  // Час собственной премьеры удерживает как несколько часов библиотеки:
  // ради эксклюзива подписываются, ради старого кино — почти нет.
  originalDepthWeight: 6,
  exclusiveRetention: 0.40,   // насколько доля собственного контента снижает отток
  originalCostPerHour: 31_000_000, // ₽ за час собственного производства
  originalLeadMonths: 6,      // сколько месяцев проект едет до премьеры
  freshDecay: 0.22,           // как быстро новинка перестаёт быть новинкой
  licenseFreshShare: 0.10,    // какая доля закупленных часов воспринимается как новинка
  refCatalogHours: 9_000,     // каталог, при котором множитель выбора равен 1.0
  refFreshHours: 320,         // «новинок» в месяц для эталонной свежести

  // --- Просмотр и трафик ---
  baseHoursPerSub: 22,        // часов в месяц на подписчика при эталонном каталоге
  cdnCostPerHour: 2.6,        // ₽ за час просмотра при базовом качестве
  refBitrate: 5,              // Мбит/с — базовое качество картинки
  supportCostPerSub: 9,       // поддержка и биллинг на подписчика, ₽/мес

  // --- Реклама ---
  cpm: 480,                   // ₽ за 1000 показов
  adsPerHour: 4,              // сколько роликов помещается в час при нагрузке 1 мин/час
  refAdLoad: 4,               // эталонная рекламная нагрузка, мин/час

  // --- Подписчики ---
  baseChurn: 0.035,           // базовый месячный отток при идеальном сервисе
  trialConversion: 0.55,      // доля пробников, доходящих до первого платежа
  refTrialDays: 14,
  awarenessDecay: 0.06,       // забывание бренда за месяц
  awarenessMaxGain: 0.30,
  refMarketingPerViewer: 26,  // ₽ на одного потенциального зрителя в месяц

  // --- Постоянные расходы ---
  hqMonthly: 26_000_000,      // студия, редакция, разработка, поддержка
  techSaturation: 900_000_000,

  // --- Данные и алгоритмы ---
  rndSaturation: 500_000_000,
  dataSaturation: 600_000_000, // накопленных часов просмотра для «половины» эффекта

  // --- Инвестиции ---
  minMonthForFunding: 3,
  fundingOptions: [1_000_000_000, 3_000_000_000, 8_000_000_000],
};

// ============================================================================
// Сегменты аудитории. Аналог районов в игре про доставку: у каждого своя
// экономика, своя чувствительность к цене и свои причины уходить.
// ============================================================================

export const SEGMENTS = [
  {
    id: 'mass',
    name: { ru: 'Массовый зритель', en: 'Mainstream' },
    potential: 9_000_000,      // потенциальных подписчиков
    elasticity: 1.9,           // чувствительность к цене
    baseHours: 1.05,           // множитель часов просмотра
    freshnessWeight: 1.25,     // насколько важны новинки
    depthWeight: 0.45,         // насколько важна глубина каталога
    adTolerance: 1.15,         // насколько спокойно переносит рекламу
    loyalty: 0.85,             // множитель базового оттока (меньше — лояльнее)
    hint: {
      ru: 'Самый большой сегмент. Приходит на громкую премьеру и уходит, когда её досмотрел. Считает каждый рубль.',
      en: 'The biggest segment. Arrives for a loud premiere and leaves once it is finished. Counts every rouble.',
    },
  },
  {
    id: 'cinephile',
    name: { ru: 'Киноманы', en: 'Cinephiles' },
    potential: 2_400_000,
    elasticity: 0.75,
    baseHours: 1.35,
    freshnessWeight: 0.55,
    depthWeight: 1.60,
    adTolerance: 0.45,
    loyalty: 0.70,
    hint: {
      ru: 'Платят охотно и смотрят много, но требуют глубокий каталог и не выносят рекламу. Самый дорогой трафик.',
      en: 'They pay willingly and watch a lot, but demand a deep catalogue and cannot stand ads. The most expensive traffic.',
    },
  },
  {
    id: 'family',
    name: { ru: 'Семьи с детьми', en: 'Families' },
    potential: 4_200_000,
    elasticity: 1.35,
    baseHours: 1.30,
    freshnessWeight: 0.75,
    depthWeight: 1.05,
    adTolerance: 0.80,
    loyalty: 0.55,
    hint: {
      ru: 'Самая лояльная аудитория: подписку держат ради детей и почти не уходят. Но смотрят много — трафик дорогой.',
      en: 'The most loyal audience: they keep the subscription for the children and rarely leave. But they watch a lot, and traffic costs money.',
    },
  },
  {
    id: 'youth',
    name: { ru: 'Молодёжь', en: 'Young viewers' },
    potential: 3_600_000,
    elasticity: 2.4,
    baseHours: 0.85,
    freshnessWeight: 1.45,
    depthWeight: 0.40,
    adTolerance: 1.35,
    loyalty: 1.30,
    hint: {
      ru: 'Готовы терпеть рекламу вместо оплаты, но уходят при первой скуке. Живут на бесплатном тарифе и в хайпе.',
      en: 'Happy to trade ads for money, but they leave the moment they are bored. They live on the ad tier and on hype.',
    },
  },
];

// ============================================================================
// Жанры собственного производства. Игрок выбирает, во что вкладывать студию.
// ============================================================================

export const GENRES = [
  {
    id: 'drama',
    hangover: 0.45,   // отток после того, как премьеру досмотрели
    name: { ru: 'Драма-сериал', en: 'Prestige drama' },
    costPerHour: 1.25,        // множитель к базовой стоимости часа
    hours: 8,                 // сколько часов контента даёт один проект
    buzz: 1.0,                // сила всплеска подписок на премьере
    appeal: { mass: 0.9, cinephile: 1.6, family: 0.7, youth: 0.6 },
    hint: {
      ru: 'Фестивальная драма: киноманы ради неё подписываются и остаются надолго, массовый зритель проходит мимо.',
      en: 'A festival drama: cinephiles subscribe for it and stay, while the mainstream walks past.',
    },
  },
  {
    id: 'blockbuster',
    hangover: 1.0,   // отток после того, как премьеру досмотрели
    name: { ru: 'Блокбастер', en: 'Blockbuster' },
    costPerHour: 2.10,
    hours: 4,
    buzz: 1.45,
    appeal: { mass: 1.7, cinephile: 0.7, family: 1.1, youth: 1.4 },
    hint: {
      ru: 'Дорогая премьера с максимальным шумом. Подписки взлетают — и осыпаются через месяц, если дальше смотреть нечего.',
      en: 'An expensive premiere with maximum noise. Sign-ups spike — and fall away a month later if there is nothing to follow it.',
    },
  },
  {
    id: 'family',
    hangover: 0.1,   // отток после того, как премьеру досмотрели
    name: { ru: 'Семейная анимация', en: 'Family animation' },
    costPerHour: 1.55,
    hours: 6,
    buzz: 0.8,
    appeal: { mass: 1.0, cinephile: 0.5, family: 2.0, youth: 0.7 },
    hint: {
      ru: 'Пересматривают десятки раз. Слабый всплеск на премьере, зато самый сильный эффект на удержание.',
      en: 'Rewatched dozens of times. A weak premiere spike, but the strongest effect on retention there is.',
    },
  },
  {
    id: 'reality',
    hangover: 0.2,   // отток после того, как премьеру досмотрели
    name: { ru: 'Реалити и шоу', en: 'Reality and shows' },
    costPerHour: 0.45,
    hours: 12,
    buzz: 0.7,
    appeal: { mass: 1.3, cinephile: 0.3, family: 0.8, youth: 1.6 },
    hint: {
      ru: 'Дёшево за час и бесконечно по объёму. Держит молодёжь и наполняет каталог, но киноманы такое не считают за контент.',
      en: 'Cheap per hour and endless in volume. It holds young viewers and fills the catalogue, but cinephiles do not count it as content at all.',
    },
  },
];

// ============================================================================
// Рычаги управления
// ============================================================================

export const LEVERS = [
  {
    key: 'pricePremium',
    label: { ru: 'Цена без рекламы', en: 'Ad-free price' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 99, max: 999, step: 10, def: 399,
    tip: {
      ru: 'Основная выручка. Киноманы почти не замечают цену, молодёжь уходит от каждой сотни — один и тот же рубль работает по-разному в разных сегментах.',
      en: 'Your core revenue. Cinephiles barely notice the price, young viewers leave over every hundred roubles — the same rouble behaves differently in each segment.',
    },
  },
  {
    key: 'priceAds',
    label: { ru: 'Цена с рекламой', en: 'Ad-tier price' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 499, step: 10, def: 149,
    tip: {
      ru: 'Дешёвый тариф расширяет рынок, но переманивает и тех, кто платил бы полную цену. Каннибализация — не побочный эффект, а суть решения.',
      en: 'A cheap tier widens the market but also pulls in people who would have paid full price. Cannibalisation is not a side effect here, it is the decision itself.',
    },
  },
  {
    key: 'adLoad',
    label: { ru: 'Рекламная нагрузка', en: 'Ad load' },
    unit: { ru: 'мин/час', en: 'min/hr' },
    min: 0, max: 16, step: 1, def: 4,
    tip: {
      ru: 'Каждая минута рекламы — прямая выручка и прямой удар по удержанию. Киноманы уходят втрое быстрее молодёжи.',
      en: 'Every minute of advertising is direct revenue and a direct hit to retention. Cinephiles leave three times faster than young viewers.',
    },
  },
  {
    key: 'licensing',
    label: { ru: 'Закупка лицензий', en: 'Licensing budget' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 400_000_000, step: 10_000_000, def: 0,
    tip: {
      ru: 'Чужой контент появляется в каталоге сразу, но истекает ~4,5% в месяц и есть у конкурентов. Это аренда, а не покупка.',
      en: 'Licensed content lands in the catalogue immediately, but it expires at about 4.5% a month and your rivals have it too. This is rent, not ownership.',
    },
  },
  {
    key: 'originals',
    label: { ru: 'Производство оригиналов', en: 'Originals budget' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 600_000_000, step: 10_000_000, def: 0,
    tip: {
      ru: 'Деньги уходят сейчас, премьера будет через полгода. Зато оригинал остаётся навсегда и работает только на вас.',
      en: 'The money goes out now and the premiere lands six months later. But an original stays forever and works for you alone.',
    },
  },
  {
    key: 'marketing',
    label: { ru: 'Маркетинг', en: 'Marketing' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 300_000_000, step: 10_000_000, def: 0,
    tip: {
      ru: 'Растит узнаваемость и приток пробных подписок. Приводить людей в пустой каталог — самый дорогой способ купить отток.',
      en: 'Builds awareness and the flow of trials. Bringing people into an empty catalogue is the most expensive way to buy churn.',
    },
  },
  {
    key: 'trialDays',
    label: { ru: 'Пробный период', en: 'Free trial' },
    unit: { ru: 'дней', en: 'days' },
    min: 0, max: 30, step: 1, def: 7,
    tip: {
      ru: 'Длинный триал поднимает конверсию из интереса в подписку, но месяц вы платите за трафик и не получаете денег.',
      en: 'A long trial lifts conversion from interest into subscription, but for a month you pay for the traffic and collect nothing.',
    },
  },
  {
    key: 'bitrate',
    label: { ru: 'Качество картинки', en: 'Streaming quality' },
    unit: { ru: 'Мбит/с', en: 'Mbps' },
    min: 2, max: 16, step: 1, def: 5,
    tip: {
      ru: 'Трафик — переменная себестоимость, которая растёт вместе с любовью зрителя к сервису. Экономия на битрейте видна сразу.',
      en: 'Bandwidth is a variable cost that grows with how much viewers love you. Cutting the bitrate is noticed immediately.',
    },
  },
  {
    key: 'tech',
    label: { ru: 'Технологии и платформа', en: 'Technology' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 150_000_000, step: 5_000_000, def: 0,
    tip: {
      ru: 'Накопительная инвестиция: дешевле трафик, лучше приложение, меньше отток по техническим причинам.',
      en: 'A cumulative investment: cheaper bandwidth, a better app, less churn for purely technical reasons.',
    },
  },
  {
    key: 'rnd',
    label: { ru: 'Data Science', en: 'Data science' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 120_000_000, step: 5_000_000, def: 0,
    tip: {
      ru: 'Команда, которая строит рекомендации и удержание. Без часов просмотра учиться не на чем, а часы приходят только от подписчиков.',
      en: 'The team that builds recommendations and retention. Without watch hours there is nothing to learn from, and hours only come from subscribers.',
    },
  },
];

// ============================================================================
// Алгоритмы — оптимизации второго порядка.
// unlock — требуемое качество (√(данные × команда)), install — разовое внедрение.
// ============================================================================

export const ALGORITHMS = [
  {
    key: 'recommendations',
    name: { ru: 'Рекомендательная лента', en: 'Recommendation feed' },
    short: { ru: 'рекомендации', en: 'recommendations' },
    unlock: 0.10,
    install: 60_000_000,
    param: {
      label: { ru: 'Сила персонализации', en: 'Personalisation strength' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'Главная страница собирается под каждого зрителя, а не одинаковая для всех.',
      en: 'The home screen is assembled for each viewer instead of being the same for everyone.',
    },
    tradeoff: {
      ru: 'Часы просмотра и удержание растут. Но чем агрессивнее персонализация при слабой модели, тем уже пузырь: зритель перестаёт видеть каталог и считает, что смотреть нечего.',
      en: 'Watch hours and retention both rise. But the more aggressive the personalisation with a weak model, the tighter the bubble: viewers stop seeing the catalogue and conclude there is nothing to watch.',
    },
    lesson: {
      ru: 'Рекомендации увеличивают потребление того, что уже есть. Они не заменяют контент — они лишь достают его с полки.',
      en: 'Recommendations increase consumption of what you already have. They do not replace content, they only take it off the shelf.',
    },
  },
  {
    key: 'contentForecast',
    name: { ru: 'Прогноз спроса на контент', en: 'Content demand forecast' },
    short: { ru: 'прогноз контента', en: 'content forecast' },
    unlock: 0.18,
    install: 80_000_000,
    param: {
      label: { ru: 'Доверие модели', en: 'Trust in the model' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 60, scale: 0.01,
    },
    what: {
      ru: 'Закупка лицензий идёт по прогнозу спроса, а не по вкусу редакции.',
      en: 'Licensing follows a demand forecast rather than the taste of the editorial team.',
    },
    tradeoff: {
      ru: 'Тот же бюджет даёт больше просмотров. Но модель учится на прошлом и тянет каталог к повторению уже известного — глубина растёт медленнее.',
      en: 'The same budget buys more viewing. But the model learns from the past and pulls the catalogue towards more of the same — depth grows more slowly.',
    },
    lesson: {
      ru: 'Оптимизация закупки под спрос — это оптимизация под вчерашний спрос. Она эффективна и консервативна одновременно.',
      en: 'Optimising purchases against demand means optimising against yesterday’s demand. It is efficient and conservative at the same time.',
    },
  },
  {
    key: 'winback',
    name: { ru: 'Персональное удержание', en: 'Targeted win-back' },
    short: { ru: 'удержание', en: 'win-back' },
    unlock: 0.28,
    install: 90_000_000,
    param: {
      label: { ru: 'Размер удерживающей скидки', en: 'Retention discount' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 60, step: 5, def: 25, scale: 0.01,
    },
    what: {
      ru: 'Скидку получают только те, кто уже собрался отписаться.',
      en: 'The discount goes only to subscribers who are already about to cancel.',
    },
    tradeoff: {
      ru: 'Отток падает за небольшие деньги. Но модель ошибается и дарит скидку тем, кто и так остался бы, а слухи о «скидке для уходящих» учат зрителей уходить.',
      en: 'Churn falls for modest money. But the model misfires and hands discounts to people who would have stayed, and word of a "leavers’ discount" teaches viewers to leave.',
    },
    lesson: {
      ru: 'Удерживать дешевле, чем привлекать, — правда ровно до тех пор, пока скидка не становится известной всем.',
      en: 'Retention is cheaper than acquisition — true right up until the discount becomes common knowledge.',
    },
  },
  {
    key: 'adaptiveAds',
    name: { ru: 'Адаптивная реклама', en: 'Adaptive ad load' },
    short: { ru: 'адаптивная реклама', en: 'adaptive ads' },
    unlock: 0.36,
    install: 70_000_000,
    param: {
      label: { ru: 'Разброс нагрузки', en: 'Load spread' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'Терпимым зрителям показывается больше рекламы, готовым уйти — меньше.',
      en: 'Tolerant viewers see more advertising, those close to leaving see less.',
    },
    tradeoff: {
      ru: 'Выручка с рекламы растёт при том же среднем оттоке. Но при слабой модели вы просто злите не тех и теряете самых ценных зрителей.',
      en: 'Ad revenue rises at the same average churn. With a weak model you simply annoy the wrong people and lose your most valuable viewers.',
    },
    lesson: {
      ru: 'Средняя рекламная нагрузка — бессмысленная величина. Значение имеет распределение по людям.',
      en: 'Average ad load is a meaningless number. What matters is how it is distributed across people.',
    },
  },
  {
    key: 'encoding',
    name: { ru: 'Умное кодирование', en: 'Smart encoding' },
    short: { ru: 'кодек', en: 'encoding' },
    unlock: 0.22,
    install: 100_000_000,
    param: {
      label: { ru: 'Агрессивность сжатия', en: 'Compression strength' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'Битрейт подбирается под конкретную сцену, а не задаётся одинаковым для всего.',
      en: 'The bitrate is chosen per scene instead of being fixed for everything.',
    },
    tradeoff: {
      ru: 'Трафик — крупнейшая переменная статья, и здесь она режется прямо. Но пережатая картинка заметна, и заметна она в первую очередь киноманам.',
      en: 'Bandwidth is your largest variable cost and this cuts it directly. But over-compression is visible, and it is visible to cinephiles first.',
    },
    lesson: {
      ru: 'Единственный алгоритм в игре, который экономит расходы, а не добывает выручку. Такие всегда окупаются раньше остальных.',
      en: 'The only algorithm here that saves cost instead of chasing revenue. Those always pay back sooner than the rest.',
    },
  },
  {
    key: 'pacing',
    name: { ru: 'Календарь релизов', en: 'Release pacing' },
    short: { ru: 'календарь', en: 'pacing' },
    unlock: 0.44,
    install: 50_000_000,
    param: {
      label: { ru: 'Растягивание премьеры', en: 'Premiere spread' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'Серии выходят по одной в неделю, а не всё сразу.',
      en: 'Episodes are released weekly instead of all at once.',
    },
    tradeoff: {
      ru: 'Подписку продлевают ещё месяц, отток после премьеры сглаживается. Но всплеск на премьере ниже, а часть зрителей уходит ждать, пока выйдет всё.',
      en: 'Subscriptions are renewed for another month and the post-premiere churn smooths out. But the premiere spike is smaller, and some viewers leave to wait for the whole season.',
    },
    lesson: {
      ru: 'Одно и то же содержимое, разная упаковка во времени — и совершенно разная выручка. Расписание тоже продукт.',
      en: 'The same content, packaged differently in time, produces completely different revenue. The schedule is part of the product.',
    },
  },
];

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  genre: 'drama',              // во что вкладывается студия сейчас
  algoOn: Object.fromEntries(ALGORITHMS.map((a) => [a.key, false])),
  algoParam: Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.param.def * (a.param.scale ?? 1)])),
};
