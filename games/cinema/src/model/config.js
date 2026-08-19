// ============================================================================
// Параметры мира онлайн-кинотеатра «КИНОРЕКА».
// Денежная единица — рубли, шаг времени — 1 месяц.
//
// Текстовые поля двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

// Мелкие общие помощники живут здесь, а не копией в каждом модуле:
// в однофайловой сборке все модули склеиваются, и дубль имени ломает игру.
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const CONFIG = {
  // --- Финансовая команда (общая механика набора, см. shared/finance.js) ---
  // Числа свои: у стриминга крупная выручка и месячный шаг.
  finance: {
    saturationShare: 0.02,       // выручки в месяц до «половины» силы
    saturationFloor: 1_000_000,
    miscRateBase: 0.020,         // прочие расходы без службы, доля выручки
    miscRateCut: 0.014,          // сколько снимает полная команда
    roundGain: 0.20,
  },
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
  // ради эксклюзива подписываются, ради старого кино — почти нет. Вес поднят
  // с 6 после замера: при шести лицензии выходили вчетверо дешевле за один
  // и тот же эффективный час, и закупка выигрывала всухую на всех стратегиях —
  // то есть главный урок игры измерением не подтверждался.
  originalDepthWeight: 9,
  exclusiveRetention: 0.40,   // насколько доля собственного контента снижает отток
  originalCostPerHour: 31_000_000, // ₽ за час собственного производства
  originalLeadMonths: 6,      // сколько месяцев проект едет до премьеры
  freshDecay: 0.22,           // как быстро новинка перестаёт быть новинкой
  licenseFreshShare: 0.10,    // какая доля закупленных часов воспринимается как новинка
  // Каталог, при котором множитель выбора равен 1.0. Опущен с 9 000: прежняя
  // планка стояла выше всего, что можно построить за партию собственными
  // силами, поэтому глубина ни разу не насыщалась и следующий закупленный час
  // всегда окупался. Теперь у закупки есть вершина.
  refCatalogHours: 7_500,
  refFreshHours: 320,         // «новинок» в месяц для эталонной свежести

  // Какая доля сегмента вообще готова смотреть с рекламой — при бесконечной
  // разнице в цене. Умножается на терпимость сегмента. Без этого потолка
  // прайс работал не как цена, а как переключатель тарифа.
  adTierCeiling: 0.72,

  // Насколько премиальный выбор новичка чувствует собственную цену тарифа
  // (множитель к эластичности сегмента). 0 — прежний мир, где спрос видел
  // только смесь listPrice и оптимум прайса лежал на упоре 999. Замер
  // аудита 2026-08: при 1.0 внутренний оптимум есть, но студийная опора
  // разоряется на собственной цене; при 0.6 упор исчезает, но верх кривой
  // плоский. 0.8 — середина: см. срезы в комментарии к LEVERS.priceNew.
  premiumChoiceElasticity: 0.8,

  // Выпуклость раздражения рекламой: pain = (adLoad/refAdLoad)^exponent.
  // 1.0 — прежний линейный мир с оптимумом нагрузки в нуле.
  adPainExponent: 1.6,

  // Какая доля действующих подписчиков, готовых к годовому тарифу, реально
  // переходит на него за месяц. Новичку решать проще: он и так выбирает.
  annualUpgradeRate: 0.28,

  // --- Просмотр и трафик ---
  baseHoursPerSub: 22,        // часов в месяц на подписчика при эталонном каталоге
  cdnCostPerHour: 2.6,        // ₽ за час просмотра при базовом качестве
  refBitrate: 5,              // Мбит/с — базовое качество картинки
  supportCostPerSub: 9,       // поддержка и биллинг на подписчика, ₽/мес

  // --- Реклама ---
  cpm: 640,                   // ₽ за 1000 показов
  // Сезонность рекламного рынка: зимние бюджеты дороже летних.
  // Совпадает по фазе с сезоном просмотра — зимой и смотрят, и платят больше.
  cpmSeason: { winter: 1.25, spring: 0.95, summer: 0.75, autumn: 1.1 },
  adsPerHour: 4,              // сколько роликов помещается в час при нагрузке 1 мин/час
  refAdLoad: 4,               // эталонная рекламная нагрузка, мин/час
  // Рекламодателей конечное число. Столько показов в месяц — половина скидки
  // за переполнение: дальше каждый следующий показ стоит заметно дешевле.
  adInventorySaturation: 900_000_000,
  adGlutDiscount: 0.45,       // насколько дешевеет показ при полном переполнении

  // --- Подписчики ---
  baseChurn: 0.035,           // базовый месячный отток при идеальном сервисе
  trialConversion: 0.55,      // доля пробников, доходящих до первого платежа
  refTrialDays: 14,
  // Какая доля пришедшей за месяц когорты отваливается на первом списании,
  // если пробный период растянут до предела. Триал длиннее привычных двух
  // недель приводит не только тех, кто распробовал, но и тех, кто пришёл
  // ровно за бесплатным. При 14 днях надбавка равна нулю.
  trialChurnAdd: 0.55,
  awarenessDecay: 0.06,       // забывание бренда за месяц
  awarenessMaxGain: 0.30,
  refMarketingPerViewer: 26,  // ₽ на одного потенциального зрителя в месяц

  // --- Постоянные расходы ---
  // Студия, редакция и поддержка. Разработка вынесена отдельной статьёй:
  // построенный плеер и рекомендательный стек нужно содержать, а раньше
  // накопленный уровень технологий не стоил ничего.
  // Студия, редакция, администрация. Поднято с 20 млн: при символической
  // постоянке пассивная партия «ползунки в серединку, раундов не берём»
  // сама выходила в плюс на 12-24 месяцах и доживала до конца — сервис
  // с миллионной базой не может стоить в содержании как ларёк.
  hqMonthly: 60_000_000,
  // Штат, растущий с базой: продукт, биллинг, модерация, юристы — ₽ на
  // подписчика в месяц. Бюджеты технологий игрок может увести в ноль,
  // команду масштаба — нет.
  staffPerSub: 6,
  techUpkeepRate: 0.0135,     // содержание накопленных технологий, доля в месяц
  techSaturation: 900_000_000,

  // --- Данные и алгоритмы ---
  rndSaturation: 500_000_000,
  dataSaturation: 600_000_000, // накопленных часов просмотра для «половины» эффекта

  // --- Оценка компании ---
  // Считается по окну, а не по последнему месяцу: последний месяц покупается
  // одним решением — задрать прайс и обнулить контент перед самым концом, —
  // шесть месяцев уже нет.
  valuationWindow: 6,
  // Во сколько рынок оценивает построенную библиотеку — долю от того, что она
  // стоила. Поднято с 0.28: собственный каталог это актив, который остаётся,
  // а лицензия — аренда, которая кончается вместе с договором.
  libraryValueShare: 0.45,
  // Темп роста считается своим, более коротким окном: три месяца против
  // предыдущих трёх — иначе в первой трети партии истории на него не хватает.
  growthWindow: 3,
  // Пол под оценкой в раунде: без него ранний раунд забирал почти всю компанию,
  // и партию решал он, а не экономика.
  valuationFloor: 1_500_000_000,

  // --- Инвестиции ---
  minMonthForFunding: 3,
  fundingOptions: [1_000_000_000, 3_000_000_000, 8_000_000_000],

  // --- Конкуренция ---
  // Рынок один на двоих. Расти можно двумя способами: приводить тех, у кого
  // подписки нет вообще, и переманивать тех, кто уже платит конкуренту.
  // Второй способ работает быстрее, но конкурент умеет отвечать.
  switchIntensity: 0.035,     // какая доля чужой базы в месяц вообще рассматривает переход
  switchPremiereBoost: 0.5,   // насколько премьера усиливает переток к её автору
  competeSharpness: 1.0,      // насколько резко преимущество превращается в переток
  // Насколько сильно собственный каталог тянет зрителя к вам сверх глубины.
  // Это то, чего лицензией не купишь: у конкурента ровно те же лицензии.
  exclusivePull: 1.15,
  refExclusiveHours: 260,     // взвешенных часов своего для «половины» эффекта

  // --- Совместный мегахит с конкурентом ---
  // Единственное решение в игре, где рынок не делится, а растёт. Проект
  // снимается вскладчину: каждый платит половину, часы получают оба — то
  // есть предпочтение зрителя не сдвигается никуда, зато в категорию
  // приходят те, кто вообще не подписывался. Кому это выгодно, зависит от
  // того, кто заберёт большую долю прироста, — и это и есть урок.
  coProduction: {
    minMonth: 6,              // раньше о таком не договариваются
    scale: 'season',          // масштаб проекта: только большой
    costMult: 1.8,            // мегахит дороже обычного сезона
    yourShare: 0.5,           // ваша половина бюджета
    months: 7,                // производство дольше обычного
    hoursMult: 1.6,           // и часов в нём больше
    qualityFloor: 1.15,       // такие проекты не проваливаются: две команды и два бюджета
    // Замер на 24 кодах партии (первый, на восьми, обманул: разброс по
    // партиям шире самого эффекта). При 14% лучшая опора получала +26…34%
    // медианы — это решает партию, а не «чувствуется». При 5% медиана
    // +10…15%, и это при том, что в плюс выходит примерно половина партий:
    // проект остаётся ставкой, а не улучшением.
    marketLift: 0.05,         // насколько вырастает потолок КАТЕГОРИИ
    liftMonths: 18,           // и на сколько месяцев (потом эффект тает)
    liftDecay: 0.04,          // затухание после окончания окна
    rivalAwareness: 0.35,     // насколько общий хит поднимает узнаваемость партнёра
    rivalBuzz: 1.4,           // и сколько шума достаётся ему в месяц премьеры
  },
  // Свободный рынок делится по привлекательности: при паритете каждому по
  // половине. База поднята вдвое, потому что раньше весь приток шёл вам одному.
  trialRate: 0.115,

  // --- Дорожающие ресурсы ---
  // Права дорожают, когда за них торгуетесь вы оба. Индекс общий: сбить его
  // в одиночку нельзя, можно только перестать в него вкладываться.
  // Индекс начинается с 1.0 при спокойном рынке и растёт, только когда
  // совокупная закупка выходит за привычный объём. Разогреть его можно вдвоём,
  // остудить — только перестав торговаться.
  // Как сильно дорожают права от совокупных торгов. Поднято с 1.15: библиотеки
  // конечны, и скупающий рынок целиком платит за это заметно больше.
  licenseInflation: 1.75,
  licenseCalmSpend: 260_000_000, // совокупная закупка, при которой индекс ещё 1.0
  refLicenseSpend: 420_000_000,  // масштаб, на котором индекс успевает вырасти
  licenseIndexInertia: 0.72,     // сглаживание: рынок прав реагирует не мгновенно

  // --- Третий акт ---
  // Обвал прав: студии решают строить собственные витрины и разом отзывают
  // долю лицензионных каталогов у всего рынка — и у вас, и у конкурента.
  // Анонс за три месяца: у подготовившегося есть время нарастить своё.
  rightsCliffAnnounceMonth: 24,
  rightsCliffMonth: 27,
  rightsCliffShare: 0.30,
  // Последний рывок конкурента: раунд сверх лимита и ценовая война почти
  // до конца партии — финал нельзя досидеть на автопилоте.
  rivalSurgeMonth: 26,
  rivalSurgeCash: 5_000_000_000,
  rivalSurgeWarUntil: 35,
  // Талант дорожает вместе с вашим успехом: успешному сервису звёзды выставляют
  // другой счёт. Это и есть причина, по которой себестоимость хита растёт
  // быстрее его аудитории.
  talentInflation: 0.95,
  refSubsForTalent: 4_000_000,
  // Маркетинг насыщается: чем глубже проникновение, тем дороже следующий зритель
  marketingSaturation: 1.4,

  // --- Совет директоров ---
  boardYearMonths: 12,        // цели ставятся на год и проверяются в конце года
  boardCapMonths: 6,          // на сколько месяцев режется бюджет при провале

  // --- Производство: слейт и релизы ---
  // Содержание слотов растёт быстрее их числа: пять параллельных производств —
  // это не пять раз по одному, а ещё и координация между ними.
  studioSlotMonthly: 42_000_000,
  studioSlotExponent: 1.45,
  // Студия, ведущая пять проектов сразу, ведёт каждый хуже: мощность
  // покупается не только деньгами, но и вниманием.
  slotQualityDrag: 0.55,
  vaultDecay: 0.045,          // насколько готовый проект выветривается за месяц в запасе
  // Зимняя премьера слышнее летней: зритель дома и ищет, что посмотреть.
  // Это и делает придерживание готового проекта осмысленным решением.
  seasonBuzzPower: 2.2,
  // Усталость от шума (аудит 2026-08): каждая премьера утомляет аудиторию
  // пропорционально сырому шуму, следующая шумит слабее в 1/(1+bite×усталость)
  // раз; усталость спадает на decay в месяц. Наказывается частота шума, а не
  // громкость: редкая премьера почти не теряет, конвейер — заметно. Числа
  // подобраны замером — цель: блокбастер на массовом остаётся вершиной
  // (~1.2×), но перестаёт быть викторинным ответом (было 2.1×).
  buzzFatigueBite: 0.5,
  buzzFatigueDecay: 0.4,
  // Конверсия шума в пробы: вогнутая (power < 1) — внимание рынка
  // насыщается, и третья громкая премьера приводит меньше второй.
  premiereTrialGain: 0.6,
  // 0.85 по замеру: блокбастер на массовом остаётся вершиной (~1.2×),
  // но перестаёт быть викторинным ответом (при 1.0 было 2.1×).
  premiereTrialPower: 0.85,
  // Прицельно снятый под сегмент проект попадает в него точнее, но остальным
  // интересен меньше: фокус — это всегда и отказ.
  targetedAppealBonus: 2.0,
  targetedAppealPenalty: 0.78,

  // --- Маркетинг релиза ---
  // Кампания работает только вместе с релизом: рекламировать нечего, если
  // в этом месяце ничего не выходит.
  campaignPower: 1.5,         // насколько кампания усиливает шум премьеры
  refCampaign: 120_000_000,   // бюджет кампании, дающий половину эффекта

  // --- Цена для действующей базы ---
  // Реакция на повышение нелинейна: +10% почти незаметны, +40% выносят
  // заметный кусок базы. Годовых подписчиков повышение не задевает.
  raiseShockBase: 0.035,
  raiseShockCurve: 1.6,
  raiseCooldown: 4,           // сколько месяцев нельзя повышать повторно

  // --- Партнёрства и бандлы ---
  // Второй канал роста: опт вместо розницы. Предложения приходят редко —
  // это стратегические развилки, а не ежемесячная рутина.
  partnerOfferChance: 0.22,
  // Когда контракт кончается, оптовые подписчики уходят разом, а не по одному.
  // Часть удаётся удержать, если бренд им запомнился.
  partnerExitKeep: 0.22,
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
      en: 'The biggest segment. Arrives for a loud premiere and leaves once it is finished. Counts every penny.',
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
      en: 'They pay willingly and watch a lot, but demand a deep catalogue and cannot stand ads. The most expensive bandwidth of any segment.',
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
      en: 'The most loyal audience: they keep the subscription for the children and rarely leave. But they watch a lot, and bandwidth costs money.',
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
      en: 'Happy to sit through ads instead of paying, but they leave the moment they are bored. They live on the ad tier and on hype.',
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
    depthValue: 1.35,         // сколько «глубины» даёт час этого жанра
    decay: 0.004,             // как быстро час жанра теряет ценность (в месяц)
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
    costPerHour: 2.45,
    hours: 4,
    buzz: 1.45,
    depthValue: 0.90,
    decay: 0.012,
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
    depthValue: 1.25,
    decay: 0.002,
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
    costPerHour: 0.55,
    hours: 12,
    buzz: 0.7,
    depthValue: 0.50,
    decay: 0.038,
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

// ============================================================================
// Рычаги управления.
//
// Их намеренно немного, и они разложены по группам. Ползунок хорош там, где
// решение — это действительно число («сколько тратить на бренд»). Там, где
// решение — это выбор объекта («какой проект запустить», «когда его выпустить»,
// «повышать ли цену действующим»), ползунка нет: есть карточки и кнопки.
//
// group: 'money'  — деньги и цена, смотреть каждый месяц
//        'growth' — маркетинг и каталог, смотреть при смене стратегии
//        'infra'  — инфраструктура: выставил один раз и почти не трогаешь
// ============================================================================

export const LEVERS = [
  {
    key: 'finance',
    group: 'infra',
    label: { ru: 'Финансовая команда', en: 'Finance team' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 40_000_000, step: 1_000_000, def: 0,
    tip: {
      ru: 'Казначейство, контроль расходов, подготовка к раундам. Слабая финансовая служба стоит денег молча: комиссии платёжных систем, списания, штрафы, неразнесённая административка — всё это уходит в «прочие расходы». Сильная режет эту строку и лучше упаковывает компанию к раунду. Уровень сложности набора меняет только её цену.',
      en: 'Treasury, cost control, preparing for funding rounds. A weak finance function costs money silently: payment commissions, write-offs, penalties, unallocated admin — all of it lands in “miscellaneous”. A strong one cuts that line and packages the company better for a round. The series difficulty changes only its price.',
    },
  },
  {
    key: 'priceNew',
    group: 'money',
    label: { ru: 'Цена для новых', en: 'Price for new sign-ups' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 99, max: 999, step: 10, def: 399,
    // Режимы заменяют ползунок (аудит 2026-08): после пересборки спроса
    // вершина кривой легла ровно на «Рыночную» (замер по сетке шага 10:
    // 399 -> 15.06 млрд — максимум, 429 -> 14.34, 499 -> 11.40), и точность
    // тоньше режимов перестала окупаться — двойное управление было
    // перегрузом. Старый пик на 499 остался в прошлом балансе.
    policyMode: 'replace',
    policy: [
      { v: 249, label: { ru: 'Вход рублём', en: 'Cheap entry' },
        note: { ru: 'Дешевле рынка: подписываются охотно, но каждый приносит мало, и поднять цену этой базе потом будет отдельным решением с оттоком.', en: 'Below market: people sign up readily but each brings little, and raising the price for that base later is a separate decision with churn attached.' } },
      { v: 399, label: { ru: 'Рыночная', en: 'Market' },
        note: { ru: 'Как у конкурента: конкурируете каталогом и премьерами, а не рублём.', en: 'The same as your rival: you compete on catalogue and premieres, not on price.' } },
      { v: 499, label: { ru: 'Уверенная', en: 'Confident' },
        note: { ru: 'Выше рынка: подписка окупает контент быстрее, но каталог обязан это оправдывать — иначе новые не приходят.', en: 'Above market: the subscription pays back the content faster, but the catalogue has to justify it — otherwise new sign-ups dry up.' } },
      { v: 649, label: { ru: 'Премиум', en: 'Premium' },
        note: { ru: 'Дорого и штучно: приходят немногие, зато платят как за кино. Годится только с сильными оригиналами.', en: 'Expensive and selective: few come, but they pay cinema money. Only works with strong originals.' } },
    ],
    tip: {
      ru: 'Цена, по которой подписываются новые. Действующая база продолжает платить свою — перевести её на новую цену можно только отдельным решением, и часть людей на этом уйдёт.',
      en: 'The price new subscribers sign up at. Your existing base keeps paying what it signed at — moving them to the new price is a separate decision, and some of them will leave over it.',
    },
  },
  {
    key: 'priceAds',
    group: 'money',
    label: { ru: 'Цена с рекламой', en: 'Ad-tier price' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 499, step: 10, def: 149,
    tip: {
      ru: 'Дешёвый тариф приводит тех, кто иначе не заплатил бы вообще, и переманивает часть тех, кто заплатил бы полную цену. Это управление каннибализацией, а не «широкая линейка».',
      en: 'The cheap tier brings in people who would not have paid at all and poaches some who would have paid full price. This is cannibalisation management, not a “broad line-up”.',
    },
  },
  {
    key: 'annualDiscount',
    group: 'money',
    label: { ru: 'Скидка за год вперёд', en: 'Annual plan discount' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 40, step: 5, def: 0, scale: 0.01,
    // Режимы заменяют ползунок (аудит 2026-08): вершина на «Заметной»
    // (15% -> 15.13 млрд, 10% -> 15.06, 20% -> 14.63) — сетка её накрывает.
    policyMode: 'replace',
    policy: [
      { v: 0, label: { ru: 'Только помесячно', en: 'Monthly only' },
        note: { ru: 'Никаких годовых: выручка ровная, деньги приходят по мере просмотра.', en: 'No annual plans: revenue is even, money arrives as people watch.' } },
      { v: 5, label: { ru: 'Мягкая', en: 'Gentle' },
        note: { ru: 'Небольшая скидка: годовых немного, а те, кто перешёл, уходят заметно реже.', en: 'A small discount: few switch, and those who do churn noticeably less.' } },
      { v: 15, label: { ru: 'Заметная', en: 'Noticeable' },
        note: { ru: 'Год вперёд берут охотно: касса сегодня, но цена этих людей зафиксирована и под повышения не попадёт.', en: 'People take the year willingly: cash today, but their price is locked and exempt from any rise.' } },
      { v: 30, label: { ru: 'Агрессивная', en: 'Aggressive' },
        note: { ru: 'Заём у собственной будущей выручки: деньги сейчас, тонкая выручка потом весь следующий год.', en: 'A loan against your own future revenue: cash now, thin revenue for the whole year after.' } },
    ],
    tip: {
      ru: 'Годовая подписка приносит деньги сразу за двенадцать месяцев и защищает от оттока — но фиксирует цену и не попадает под повышения. Это заём у собственной будущей выручки.',
      en: 'An annual plan brings twelve months of cash at once and shields you from churn — but it locks the price and is exempt from any rise. It is a loan against your own future revenue.',
    },
  },
  {
    key: 'adLoad',
    group: 'money',
    label: { ru: 'Рекламная нагрузка', en: 'Ad load' },
    unit: { ru: 'мин/час', en: 'min/hr' },
    min: 0, max: 16, step: 1, def: 4,
    // Режимы заменяют ползунок (аудит 2026-08), сетка пересобрана по замеру
    // на 24 кодах: вершина у всех трёх опор лежит на 3–4 мин/час (студийная:
    // 4 -> 6.40 млрд против 3 -> 5.52), прежняя «Плотная 6» стояла уже на
    // спуске — добавлена «Рабочая 4», «Плотная» сдвинута на 8, где спад
    // честно виден.
    policyMode: 'replace',
    policy: [
      { v: 0, label: { ru: 'Без рекламы', en: 'Ad-free' },
        note: { ru: 'Чистый просмотр: вторая статья выручки закрыта, зато никого не раздражаете.', en: 'Clean viewing: your second revenue line is shut, but nobody is annoyed.' } },
      { v: 2, label: { ru: 'Щадящая', en: 'Light' },
        note: { ru: 'Пара минут в час: деньги появляются, отток почти не двигается.', en: 'A couple of minutes an hour: money appears while churn barely moves.' } },
      { v: 4, label: { ru: 'Рабочая', en: 'Standard' },
        note: { ru: 'Столько крутят те, кто живёт рекламой всерьёз: вторая выручка уже ощутима, раздражение ещё терпимо. Киноманы хмурятся первыми.', en: 'What serious ad businesses run: the second revenue line is already real while irritation is still bearable. Cinephiles frown first.' } },
      { v: 8, label: { ru: 'Плотная', en: 'Heavy' },
        note: { ru: 'Заметно для зрителя: выручка растёт линейно, раздражение — быстрее, и отток съедает больше, чем приносят показы.', en: 'Noticeable to the viewer: revenue grows linearly, irritation faster — and churn eats more than the impressions bring.' } },
      { v: 12, label: { ru: 'Как у бесплатных', en: 'Free-TV level' },
        note: { ru: 'Телевизионная нагрузка: подписка перестаёт отличаться от эфира, и её перестают ценить.', en: 'Broadcast levels: the subscription stops feeling different from free TV, and stops being valued.' } },
    ],
    tip: {
      ru: 'Вторая статья выручки. Пара минут в час почти не замечается, дальше раздражение растёт быстрее денег: киноманы уходят первыми, молодёжь терпит дольше всех. Показы сезонные: зимой CPM на четверть дороже, летом — на четверть дешевле.',
      en: 'Your second revenue line. A couple of minutes an hour goes almost unnoticed; past that, irritation grows faster than the money — cinephiles leave first, the young put up with it longest. Impressions are seasonal: winter CPMs run about a quarter dearer, summer a quarter cheaper.',
    },
  },

  {
    key: 'licensing',
    group: 'growth',
    label: { ru: 'Закупка лицензий', en: 'Licensing budget' },
    unit: { ru: '₽', en: '$' },
    // Максимум поднят с 500 млн: оптимум закупки лежал ровно на упоре
    // ползунка, а падающая сторона кривой (перегретый индекс прав) игроку
    // была не видна. Замер аудита 2026-08: 500 млн — 13.2 млрд итога,
    // 650 — 8.4, 800 — 7.1. Перебор должен быть доступен, иначе урок
    // «платишь дороже сам себе» останется за краем шкалы.
    min: 0, max: 800_000_000, step: 10_000_000, def: 0,
    tip: {
      ru: 'Каталог появляется сразу, но истекает 4.5% в месяц, лежит и у конкурента и почти не считается новинкой. Когда за права торгуетесь вы оба, они дорожают для обоих.',
      en: 'The catalogue appears at once, but 4.5% expires monthly, the rival has the same titles, and it barely counts as new. When you both bid for rights, they get more expensive for both.',
    },
  },
  {
    key: 'brandMarketing',
    group: 'growth',
    label: { ru: 'Маркетинг бренда', en: 'Brand marketing' },
    unit: { ru: '₽', en: '$' },
    min: 0, max: 300_000_000, step: 10_000_000, def: 0,
    tip: {
      ru: 'Ровный фон узнаваемости. Работает медленно, забывается быстро и при пустом каталоге сгорает впустую: приводить зрителя некуда.',
      en: 'A steady background level of awareness. It works slowly, decays quickly, and against an empty catalogue it burns for nothing: there is nowhere to bring the viewer.',
    },
  },

  {
    key: 'studioSlots',
    group: 'infra',
    label: { ru: 'Слотов в студии', en: 'Studio slots' },
    unit: { ru: 'проектов', en: 'projects' },
    min: 1, max: 5, step: 1, def: 2,
    tip: {
      ru: 'Сколько проектов может идти одновременно. Слот стоит денег каждый месяц, занят он или пуст, — это и есть настоящая себестоимость производственной мощности.',
      en: 'How many projects can run at once. A slot costs money every month whether it is busy or idle — that is what production capacity actually costs.',
    },
  },
  {
    key: 'trialDays',
    group: 'infra',
    label: { ru: 'Пробный период', en: 'Free trial' },
    unit: { ru: 'дней', en: 'days' },
    min: 0, max: 30, step: 1, def: 7,
    tip: {
      ru: 'Длинный триал повышает конверсию и дарит месяцы. Короткий экономит деньги и теряет тех, кто не успел распробовать.',
      en: 'A long trial lifts conversion and gives months away. A short one saves money and loses the people who never got a taste.',
    },
  },
  {
    key: 'bitrate',
    group: 'infra',
    label: { ru: 'Качество картинки', en: 'Streaming quality' },
    unit: { ru: 'Мбит/с', en: 'Mbps' },
    min: 2, max: 16, step: 1, def: 5,
    tip: {
      ru: 'Плохая картинка раздражает, хорошая стоит трафика — а трафик здесь единственная крупная переменная статья.',
      en: 'A poor picture annoys people, a good one costs bandwidth — and bandwidth is the only large variable cost line here.',
    },
  },
  {
    key: 'tech',
    group: 'infra',
    label: { ru: 'Технологии и платформа', en: 'Technology' },
    unit: { ru: '₽', en: '$' },
    min: 0, max: 120_000_000, step: 5_000_000, def: 0,
    tip: {
      ru: 'Накопительная инвестиция: дешевле час трафика и выше качество производимых проектов. Окупается не сразу и не сама.',
      en: 'A cumulative investment: cheaper bandwidth per hour and better quality in what you produce. It does not pay back quickly or by itself.',
    },
  },
  {
    key: 'rnd',
    group: 'infra',
    label: { ru: 'Data Science', en: 'Data science' },
    unit: { ru: '₽', en: '$' },
    min: 0, max: 90_000_000, step: 5_000_000, def: 0,
    tip: {
      ru: 'Команда без данных бесполезна ровно так же, как данные без команды: качество алгоритмов — среднее геометрическое того и другого.',
      en: 'A team without data is exactly as useless as data without a team: algorithm quality is the geometric mean of the two.',
    },
  },
];

export const LEVER_GROUPS = [
  {
    id: 'money',
    label: { ru: 'Деньги и цена', en: 'Money and price' },
    desc: {
      ru: 'Две статьи выручки — подписка и реклама — и то, как вы их сочетаете. Цена берётся с новых, действующая база платит свою.',
      en: 'Two revenue lines — subscription and advertising — and how you combine them. The price applies to new sign-ups; your existing base keeps paying what it signed at.',
    },
    open: true,
  },
  {
    id: 'growth',
    label: { ru: 'Каталог и маркетинг', en: 'Catalogue and marketing' },
    desc: {
      ru: 'Чем наполнена полка и знает ли о ней город. Лицензии дешевле и быстрее, но тают; своё производство дороже и медленнее, зато остаётся навсегда.',
      en: 'What fills the shelf and whether the city knows about it. Licences are cheaper and faster but expire; your own production is dearer and slower but stays for good.',
    },
    open: true,
  },
  {
    id: 'infra',
    label: { ru: 'Инфраструктура', en: 'Infrastructure' },
    desc: {
      ru: 'Настраивается один раз и почти не трогается: качество картинки, платформа, данные.',
      en: 'Set once and rarely touched: picture quality, platform, data.',
    },
    open: false,
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
      en: 'Churn falls for modest money. But the model misfires and hands discounts to people who would have stayed, and word of a “leavers’ discount” teaches viewers to leave.',
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

// Пороги вердикта финала. Лежат здесь, а не в интерфейсе, потому что от них
// зависит не только надпись на экране: «крепкий финал» этой игры — единица
// переноса наследия в НОВОГРАД (shared/meta.js). Пока числа жили в двух
// местах, они разъехались, и игра говорила «крепкий бизнес», а НОВОГРАД на
// том же результате — «до крепкого финала не дотянуло». Тест сверяет их.
export const VERDICT = { excellent: 8e9, solid: 4.5e9, survived: 1.5e9 };

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  algoOn: Object.fromEntries(ALGORITHMS.map((a) => [a.key, false])),
  algoParam: Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.param.def * (a.param.scale ?? 1)])),
};

// Что игрок делает помимо ползунков: запускает проекты, выпускает готовые,
// повышает цену действующей базе. Это действия, а не числа, — и передаются
// они в step() отдельно от decisions.
export const NO_ACTIONS = { commission: [], release: [], raisePrice: false };

export function segmentById(id) {
  return SEGMENTS.find((s) => s.id === id);
}

export function genreById(id) {
  return GENRES.find((g) => g.id === id);
}
