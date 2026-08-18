// ============================================================================
// Параметры мира билетного сервиса «БИЛЕТВИЛЬ».
// Денежная единица — рубли, шаг времени — 1 месяц.
//
// Это двусторонний рынок: с одной стороны организаторы, которые дают афишу,
// с другой зрители, которые покупают билеты. Ни одна сторона не приходит
// первой сама по себе, и в этом вся трудность.
//
// Текстовые поля двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

// Мелкие общие помощники живут здесь, а не копией в каждом модуле:
// в однофайловой сборке все модули склеиваются, и дубль имени ломает игру.
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const CONFIG = {
  // --- Финансовая команда (общая механика набора, см. shared/finance.js) ---
  // У билетного маркетплейса выручка — тонкий take rate поверх крупного GMV,
  // поэтому команда здесь чинит в первую очередь эквайринг: он снимается
  // с оборота, а не с вашей комиссии.
  finance: {
    saturationShare: 0.03,       // выручки в месяц до «половины» силы
    saturationFloor: 300_000,
    miscRateBase: 0.020,         // прочие расходы без службы, доля выручки
    miscRateCut: 0.014,
    acquiringCut: 0.005,         // насколько сбивается ставка эквайринга с GMV
    roundGain: 0.20,
  },
  monthsTotal: 36,        // партия — три года
  startCash: 1_500_000_000, // деньги инвестора на старте

  // --- Комиссия: одна выручка, две стороны ---
  // Сервисный сбор платит зритель поверх цены билета, комиссию — организатор
  // из своей выручки. Сумма может быть одинаковой, а последствия разные:
  // сбор виден покупателю в момент оплаты, комиссия — организатору в договоре.
  refBuyerFee: 0.10,      // сбор, при котором множитель спроса равен 1.0
  refOrgCommission: 0.05, // комиссия, при которой организатору «нормально»
  refPlatformRate: 0.025, // платформенная ставка «как у всех»

  // Эквайринг платите вы, и платите со всего оборота — включая деньги,
  // которые всё равно уйдут организатору. Это то, из-за чего низкая комиссия
  // опаснее, чем кажется: 3% take rate минус 2.2% эквайринга — почти ноль.
  acquiringRate: 0.022,

  // --- Зрители ---
  awarenessDecay: 0.075,        // забывание бренда за месяц
  awarenessMaxGain: 0.26,
  refMarketingPerViewer: 8,    // ₽ на потенциального зрителя для половины эффекта
  marketingSaturation: 1.35,
  baseBuyRate: 0.28,           // сколько билетов в месяц покупает охваченный зритель
  refConversion: 0.42,          // доля дошедших до оплаты при эталонном сборе и продукте
  refProductSpend: 26_000_000,  // вложения в продукт для половины эффекта
  productSaturation: 900_000_000,

  // --- Организаторы ---
  // Организатор выбирает оператора по трём вещам: сколько вы забираете,
  // сколько вы приводите зрителей и как вас терпеть в работе.
  baseJoinRate: 0.030,          // доля свободных организаторов, смотрящих на вас за месяц
  baseOrgChurn: 0.030,          // базовый месячный отток организаторов
  refReach: 4_500_000,          // охваченная аудитория, при которой тяга к вам равна 1.0
  orgPerManager: 34,            // сколько организаторов тянет один аккаунт-менеджер
  managerCost: 420_000,         // ₽/мес на менеджера
  // Перегрузка обслуживания растёт нелинейно: с двойной нагрузкой менеджер
  // работает не вдвое, а втрое хуже — как курьер в час пик.
  serviceCongestion: 2.4,
  // Заполняемость — главный аргумент в разговоре с организатором. Пустой зал
  // он видит своими глазами, и никакая комиссия этого не перебьёт.
  refFill: 0.62,
  fillAngerPower: 1.8,

  // --- Платформа (white label) ---
  // Переезд на чужую билетную систему — проект, а не галочка. Интеграция,
  // перенос схем залов и абонементов, обучение кассиров, у крупных ещё и аванс
  // под мероприятия. Столько стоит подключить одного среднего организатора,
  // которому виджет и так нужен; тому, у кого всё работает и без вас, дороже.
  integrationCost: 260_000,
  adoptionPace: 0.42,          // как быстро переезжает тип при оплаченной интеграции
  rivalLockStrength: 0.8,      // насколько прочно конкурент держит своих

  // Билетный виджет на сайте организатора: он продаёт сам, вы берёте меньше,
  // но не теряете его целиком. Уровень платформы копится вложениями.
  platformSaturation: 620_000_000,
  platformSeatCost: 2_400,      // ₽/мес обслуживания одного подключённого организатора
  // Организатор без виджета часть оборота уводит мимо вас: продаёт через
  // собственный сайт, кассу у входа в зал или другого оператора. Именно этот кусок
  // и возвращает подключение к платформе — но уже по платформенной ставке.
  leakWithoutPlatform: 0.80,

  // Ставка платформы — не только цена, но и указание организатору, куда гнать
  // покупателя. Дешёвый виджет он продвигает сам и уводит к себе тот оборот,
  // с которого вы брали и сбор, и комиссию. Дорогой обходит вовсе: касса
  // у входа, абонементы, старое самописное решение. Поэтому у ставки есть
  // вершина, а не потолок.
  ratePushBite: 0.32,
  // И дорогой виджет вдобавок тормозит переезд: организатор считает
  // окупаемость, и бюджет на подключения этого до конца не перебивает.
  rateAdoptionBite: 0.35,

  // --- Тариф платформы ---
  // Абонплата — плата за пакет, а не просто за доступ к виджету: приоритет
  // в афише, аналитика по залу, свой менеджер, обучение кассиров. Пакет
  // насыщается — первые деньги дают личный кабинет, десятые не дают ничего —
  // и держится на зрелости платформы: тариф за сто тысяч на сыром продукте
  // организатор считает обманом. Обещанное приходится содержать, и это
  // съедает часть собранной абонплаты.
  tariffHalfValue: 45_000,   // абонплата, дающая половину ценности пакета
  tariffGain: 0.50,          // насколько сильный пакет поднимает привлекательность
  tariffServeShare: 0.30,    // какая доля абонплаты уходит на содержание обещанного

  // --- Заполняемость и спрос ---
  // Спрос и мест — два независимых числа, и продаётся минимум из них.
  // Сглаженная форма: даже при избытке спроса часть мест остаётся неудобной.
  fillCurve: 1.0,

  // --- Доверие ---
  // Доверие копится медленно и рушится быстро: перекупщики, скрытый сбор,
  // упавший сайт и отменённые концерты бьют по одному и тому же счёту.
  trustRecovery: 0.055,
  trustFloor: 0.25,

  // --- Постоянные расходы ---
  // Офис и администрация. Разработка и серверы — отдельные статьи ниже.
  // Поднято с 13 млн: при символической постоянке пассивная партия
  // «ползунки в серединку, раундов не берём» доживала до конца на стартовой
  // кассе. Офис, юристы и бухгалтерия оператора с миллиардным оборотом
  // стоят дороже.
  hqMonthly: 22_000_000,
  // Штат, растущий с числом организаторов на обслуживании: интеграции,
  // финансы, юристы, вторая линия поддержки — ₽/мес на организатора.
  // Аккаунт-менеджеры — отдельный ползунок; этот штат в ноль не уведёшь.
  staffPerOrg: 6_000,
  // Содержание построенного: платформа, приложение и алгоритмы требуют
  // поддержки каждый месяц, сколько бы времени ни прошло с их запуска.
  techUpkeepRate: 0.0125,
  // Серверы под нагрузкой: старт продаж хита — это не только запас мощности,
  // но и счёт за трафик, который приходит каждый месяц.
  serverPerTicket: 1.4,
  serverTechRelief: 0.30,
  supportPerTicket: 2.8,        // ₽ поддержки на проданный билет при базовом бюджете
  refSupport: 9_000_000,

  // --- Данные и алгоритмы ---
  rndSaturation: 220_000_000,
  dataSaturation: 9_000_000,    // накопленных проданных билетов для «половины» эффекта

  // --- Оценка компании ---
  // Выручка, рост и маржа берутся одним окном: месяц у билетного сервиса
  // слишком волнистый, а последний месяц вдобавок покупается одним решением —
  // обнулив на нём вложения, множитель можно было задрать рывком.
  valuationWindow: 9,
  // Темп роста считается тем же окном — полгода против предыдущего полугодия.
  growthWindow: 6,
  // Пол под оценкой в раунде: посевную компанию оценивают не по выручке,
  // которой ещё нет.
  valuationFloor: 200_000_000,

  // --- Инвестиции ---
  minMonthForFunding: 3,
  fundingOptions: [400_000_000, 1_200_000_000, 3_000_000_000],

  // --- Конкуренция ---
  // Организаторов на рынке конечное число, и почти каждый уже с кем-то работает.
  // Расти можно, подключая новых, и переманивая чужих. Второй способ быстрее.
  switchIntensity: 0.045,
  competeSharpness: 1.0,
  exclusivePull: 1.0,

  // --- Совет акционеров ---
  boardYearMonths: 12,
  boardCapMonths: 6,

  // --- Эксклюзивы ---
  exclusiveOfferChance: 0.20,
  exclusiveHoldMonths: 12,
  // Какую долю оборота организатора удерживаем в счёт выданного аванса.
  // Больше — быстрее вернём, но организатору тяжелее и он это чувствует.
  advanceRecoupRate: 0.35,
};

// ============================================================================
// Организаторы — сторона предложения. У каждого типа своя экономика:
// сколько событий, какой зал, какой чек и, главное, сколько зрителей он
// приводит сам. Именно последнее решает, во что вам обходится виджет
// на его сайте.
// ============================================================================

export const ORGANIZERS = [
  {
    id: 'theatre',
    name: { ru: 'Театры', en: 'Theatres' },
    short: { ru: 'театры', en: 'theatres' },
    pool: 900,                 // сколько таких организаторов на рынке
    eventsPerMonth: 11,
    seats: 380,
    avgPrice: 1600,
    commissionSensitivity: 1.25, // насколько больно берут комиссию
    feeAwareness: 0.9,          // насколько организатор замечает ваш сбор с покупателя
    loyalty: 0.55,              // множитель оттока: меньше — консервативнее
    platformNeed: 0.55,         // насколько ему нужен билетный виджет
    selfTraffic: 0.50,          // какую долю зрителей он приводит сам
    serviceWeight: 1.0,         // сколько внимания менеджера требует
    hint: {
      ru: 'Много показов, небольшой зал, своя постоянная публика. Уходят редко, но за комиссию торгуются въедливо: у театра каждый процент из бюджета.',
      en: 'Many shows, a small hall, their own regular audience. They rarely leave, but they haggle over commission: for a theatre every percent comes out of the budget.',
    },
  },
  {
    id: 'concert',
    name: { ru: 'Концерты и туры', en: 'Concerts and tours' },
    short: { ru: 'концерты', en: 'concerts' },
    pool: 220,
    eventsPerMonth: 2.2,
    seats: 2_600,
    avgPrice: 3_800,
    commissionSensitivity: 2.0,
    feeAwareness: 1.3,
    loyalty: 1.7,
    platformNeed: 0.30,
    selfTraffic: 0.28,
    serviceWeight: 2.2,
    hint: {
      ru: 'Самый крупный оборот и самые тяжёлые переговоры. Своей публики у промоутера почти нет — он живёт вашей афишей. Зато уходит к любому, кто предложит на процент меньше.',
      en: 'The biggest turnover and the hardest negotiations. A promoter has almost no audience of their own — they live off your listings. And they leave for anyone offering one percent less.',
    },
  },
  {
    id: 'club',
    name: { ru: 'Клубы и стендап', en: 'Clubs and stand-up' },
    short: { ru: 'клубы', en: 'clubs' },
    pool: 3_000,
    eventsPerMonth: 6,
    seats: 150,
    avgPrice: 1_400,
    commissionSensitivity: 0.7,
    feeAwareness: 0.6,
    loyalty: 1.25,
    platformNeed: 1.75,
    selfTraffic: 0.42,
    serviceWeight: 0.35,
    hint: {
      ru: 'Длинный хвост: их тысячи, каждый крошечный. Вручную обслуживать нерентабельно — без билетного виджета они к вам просто не дойдут. Зато к комиссии почти равнодушны.',
      en: 'The long tail: thousands of them, each tiny. Serving them by hand does not pay — without the ticketing widget they never reach you at all. On the other hand, they barely care about commission.',
    },
  },
  {
    id: 'sport',
    name: { ru: 'Спорт', en: 'Sport' },
    short: { ru: 'спорт', en: 'sport' },
    pool: 140,
    eventsPerMonth: 2.2,
    seats: 7_000,
    avgPrice: 1_100,
    commissionSensitivity: 2.6,
    feeAwareness: 1.5,
    loyalty: 0.75,
    platformNeed: 1.40,
    selfTraffic: 0.72,
    serviceWeight: 1.8,
    hint: {
      ru: 'Огромные объёмы и почти нулевая комиссия: клуб знает свою цену. Болельщик и так идёт на сайт клуба, поэтому виджет им нужен как воздух — а вам он стоит дороже всего.',
      en: 'Huge volumes and almost no commission: the club knows its worth. Fans go to the club site anyway, so they need the widget badly — and for you it is the most expensive one to give.',
    },
  },
];

export const organizerById = (id) => ORGANIZERS.find((o) => o.id === id);

// ============================================================================
// Зрители — сторона спроса. Разные сегменты ходят на разное и по-разному
// реагируют на сервисный сбор. Афиша из одного жанра собирает одну аудиторию.
// ============================================================================

export const AUDIENCES = [
  {
    id: 'regulars',
    name: { ru: 'Театралы', en: 'Theatre regulars' },
    potential: 3_400_000,
    feeElasticity: 1.5,        // насколько больно бьёт сервисный сбор
    trustWeight: 1.4,          // насколько важна репутация сервиса
    discovery: 0.45,           // насколько зависит от рекомендаций и подборок
    affinity: { theatre: 2.3, concert: 0.6, club: 0.5, sport: 0.15 },
    hint: {
      ru: 'Покупают заранее и почти не смотрят на сбор — но обиду помнят годами. Ходят в театр, остальная афиша им безразлична.',
      en: 'They buy early and barely look at the fee — but they remember a grievance for years. They go to the theatre; the rest of the listings mean nothing to them.',
    },
  },
  {
    id: 'music',
    name: { ru: 'Меломаны', en: 'Music fans' },
    potential: 6_000_000,
    feeElasticity: 3.0,
    trustWeight: 0.9,
    discovery: 0.75,
    affinity: { theatre: 0.35, concert: 2.5, club: 1.7, sport: 0.25 },
    hint: {
      ru: 'Самая живая аудитория: ходят и на стадионные туры, и в маленькие клубы. Сбор замечают и сравнивают с другими площадками.',
      en: 'The liveliest audience: they go to stadium tours and tiny clubs alike. They notice the fee and compare it against other sites.',
    },
  },
  {
    id: 'fans',
    name: { ru: 'Болельщики', en: 'Sports fans' },
    potential: 4_200_000,
    feeElasticity: 3.7,
    trustWeight: 1.1,
    discovery: 0.20,
    affinity: { theatre: 0.1, concert: 0.45, club: 0.2, sport: 3.0 },
    hint: {
      ru: 'Знают, куда идти, и в подборках не нуждаются. Сбор для них — прямая обида: билет и так дешёвый, а сверху накинули.',
      en: 'They know where they are going and need no recommendations. The fee is a straight insult to them: the ticket is cheap already, and you added on top.',
    },
  },
  {
    id: 'casual',
    name: { ru: 'За компанию', en: 'Casual buyers' },
    potential: 8_000_000,
    feeElasticity: 4.5,
    trustWeight: 1.0,
    discovery: 1.35,
    affinity: { theatre: 0.9, concert: 1.0, club: 0.85, sport: 0.8 },
    hint: {
      ru: 'Самый большой и самый капризный сегмент. Не знают, чего хотят, — их приводит афиша и подборки. Сбор видят сразу и уходят молча.',
      en: 'The biggest and the most fickle segment. They do not know what they want — listings and recommendations bring them in. They see the fee at once and leave without a word.',
    },
  },
];

export const audienceById = (id) => AUDIENCES.find((a) => a.id === id);

// ============================================================================
// Рычаги
// ============================================================================

export const LEVER_GROUPS = [
  {
    id: 'take',
    label: { ru: 'Комиссия и сборы', en: 'Fees and commission' },
    desc: {
      ru: 'С кого вы берёте деньги: со зрителя сбором, который он видит, или с организатора комиссией, которую он видит в договоре. Обе стороны нужны одновременно.',
      en: 'Whom you charge: the buyer through a fee they see, or the organiser through a commission they see in the contract. You need both sides at once.',
    },
    open: true,
  },
  {
    id: 'growth',
    label: { ru: 'Спрос и предложение', en: 'Demand and supply' },
    desc: {
      ru: 'Двусторонний рынок растёт только с обоих концов: зрители приходят за афишей, организаторы — за зрителями. Маркетинг зовёт первых, менеджеры приводят вторых.',
      en: 'A two-sided market only grows from both ends: buyers come for the listings, organisers come for the buyers. Marketing calls the former, account managers bring the latter.',
    },
    open: true,
  },
  {
    id: 'infra',
    label: { ru: 'Продукт и поддержка', en: 'Product and support' },
    desc: {
      ru: 'То, что держит доверие и выдерживает он-сейл: витрина, поддержка, ёмкость. Настраивается редко, но именно здесь ломается всё остальное.',
      en: 'What holds trust and survives the on-sale: the storefront, support, capacity. Rarely adjusted — and exactly where everything else breaks.',
    },
    open: false,
  },
];

export const LEVERS = [
  {
    key: 'finance',
    group: 'infra',
    label: { ru: 'Финансовая команда', en: 'Finance team' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 12_000_000, step: 250_000, def: 0,
    tip: {
      ru: 'Казначейство, переговоры с банком, контроль расходов. Здесь она важнее, чем кажется: эквайринг снимается с оборота, а зарабатываете вы тонкий процент — сбитая ставка бьёт прямо в вашу маржу. Плюс режет «прочие расходы» и лучше упаковывает компанию к раунду. Уровень сложности набора меняет только её цену.',
      en: 'Treasury, bank negotiations, cost control. It matters more here than it looks: card processing is charged on turnover while you earn a thin percentage — a lower rate goes straight into your margin. It also cuts “miscellaneous” and packages the company better for a round. The series difficulty changes only its price.',
    },
  },
  {
    key: 'buyerFee',
    group: 'take',
    label: { ru: 'Сервисный сбор с покупателя', en: 'Buyer service fee' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 22, step: 0.5, def: 10, scale: 0.01,
    // Режимы заменяют ползунок (аудит 2026-08): кривая отклика пологая, и
    // точность тоньше шага режимов не окупалась — двойное управление было
    // перегрузом. «Плотный» стоит в вершине для сборки с дешёвой комиссией:
    // 12% -> 4.38, 14% -> 4.28 (24 кода), 15% -> 4.05, спад до 2.2 на 22%.
    //
    // Ноль добавлен по игровому отзыву: «отключить сбор целиком» — понятная
    // стратегия дифференциации, а сетка её не пускала. Замер показал, что это
    // не поблажка, а связанное решение — оптимум идёт гребнем по диагонали
    // (медиана итога, 24 кода, чистый маркетплейс, млрд ₽):
    //
    //   комиссия \ сбор    0%     5%    10%    14%    20%
    //              1%    0.17   1.09   2.99   4.32   3.18
    //              5%    1.14   2.80   3.37   2.63   1.52
    //              8%    2.21   3.80   2.90   1.97   1.03
    //             10%    4.69   4.13   2.53   1.67   0.86
    //             13%    6.37   4.59   2.13   1.38   0.71
    //
    // Читается так: нулевой сбор — лучший ход при комиссии от 10% и худший
    // из возможных при комиссии 1% (0.17 млрд). Сбор с покупателя бьёт
    // дважды — по конверсии зрителя и по желанию организатора работать с
    // вами, — поэтому забрать своё с одной стороны выгоднее, чем с двух
    // понемногу. В платформенной сборке ответ другой: там ноль хуже
    // небольшого сбора (17.7 против 19.1 млрд на 2–5%), потому что виджет
    // и абонплата уже держат выручку, а сбор работает чистой прибавкой.
    policyMode: 'replace',
    policy: [
      { v: 0, label: { ru: 'Без сбора', en: 'No fee' },
        note: { ru: 'Зритель видит ровно цену билета — сильнейшая позиция на витрине, и организатору с вами продаётся лучше всех. Но всю выручку теперь платит организатор: без высокой комиссии это партия в минус. Алгоритм «сбор в конце оплаты» при нуле бесполезен — прятать нечего.', en: 'The buyer sees exactly the ticket price — the strongest possible shop window, and the organiser sells better with you than with anyone. But the organiser now pays for everything: without a high commission this is a losing run. The “fee at the last step” algorithm is useless at zero — there is nothing left to hide.' } },
      { v: 5, label: { ru: 'Символический', en: 'Token' },
        note: { ru: 'Зритель видит почти цену билета: конверсия лучшая на рынке, выручки с билета почти нет.', en: 'The buyer sees almost the ticket price: best conversion on the market, almost no revenue per ticket.' } },
      { v: 10, label: { ru: 'Рыночный', en: 'Market' },
        note: { ru: 'Как у всех: зритель ворчит, но платит. Средний путь между оборотом и выручкой.', en: 'Same as everyone: the buyer grumbles and pays. The middle road between turnover and revenue.' } },
      { v: 14, label: { ru: 'Плотный', en: 'Firm' },
        note: { ru: 'Выше рынка: с каждого билета берёте заметно больше, часть корзин бросают на оплате.', en: 'Above market: you take visibly more per ticket, and some baskets are abandoned at checkout.' } },
      { v: 20, label: { ru: 'Дожим', en: 'Squeeze' },
        note: { ru: 'На пороге терпения: кажется, что выручка максимальная, — но зритель уже уходит к конкуренту вместе с организатором.', en: 'At the tolerance threshold: revenue looks maximal — but the buyer is already leaving for a rival, taking the organiser along.' } },
    ],
    tip: {
      ru: 'Надбавка к цене билета, которую видит зритель на оплате. Самая заметная строка вашей выручки — и самая заметная причина закрыть вкладку. Бьёт дважды: зритель хуже конвертируется, а организатор видит, что его билеты продаются медленнее, и уходит туда, где надбавки нет. Поэтому ноль — рабочая позиция, но только если своё вы берёте комиссией с организатора.',
      en: 'The mark-up on top of the ticket price that the buyer sees at checkout. The most visible line of your revenue — and the most visible reason to close the tab. It hits twice: buyers convert worse, and the organiser sees their tickets selling slower and leaves for a platform without the mark-up. That is why zero is a real position — but only if you take your share as organiser commission instead.',
    },
  },
  {
    key: 'orgCommission',
    group: 'take',
    label: { ru: 'Комиссия с организатора', en: 'Organiser commission' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 14, step: 0.5, def: 5, scale: 0.01,
    // Режимы заменяют ползунок (аудит 2026-08). Сетка расширена вверх по
    // замеру на 24 кодах: у чистого маркетплейса вершина на 12–13%
    // (4.62–4.65 млрд), у платформенной сборки — на 10% (19.2 млрд против
    // 16.7 на 8%): чем больше оборота идёт через виджет по своей ставке,
    // тем раньше комиссия начинает выгонять организаторов.
    policyMode: 'replace',
    policy: [
      { v: 1, label: { ru: 'Заманить', en: 'Court them' },
        note: { ru: 'Почти даром: организаторы идут охотно, зарабатываете вы на зрителе, а не на них.', en: 'Almost free: organisers come readily and you earn from the buyer, not from them.' } },
      { v: 5, label: { ru: 'Рыночная', en: 'Market' },
        note: { ru: 'Как у конкурента: удерживать придётся сервисом и залом, а не ценой.', en: 'The same as your rival: you will have to hold them with service and a full hall, not price.' } },
      { v: 8, label: { ru: 'Плотная', en: 'Firm' },
        note: { ru: 'Дороже рынка: организатор ворчит и сравнивает, но зал и зрители пока перевешивают.', en: 'Above market: the organiser grumbles and compares, but the hall and the audience still outweigh it.' } },
      { v: 10, label: { ru: 'Дожим', en: 'Squeeze' },
        note: { ru: 'Дорого: крупные площадки начинают считать. Работает, только пока вы приводите зрителей, которых им больше негде взять.', en: 'Expensive: big venues start doing the maths. It works only while you bring an audience they cannot get anywhere else.' } },
      { v: 13, label: { ru: 'На пределе', en: 'To the limit' },
        note: { ru: 'Верх терпения рынка: каждый следующий процент уже выгоняет организаторов вместе с залами.', en: 'The market’s upper limit: every further percent drives organisers away, halls and all.' } },
    ],
    tip: {
      ru: 'Ваша доля из выручки организатора. Зритель её не видит совсем, зато организатор видит в договоре — и держит в голове предложение конкурента.',
      en: 'Your share of the organiser revenue. The buyer never sees it; the organiser sees it in the contract — and keeps the rival offer in mind.',
    },
  },
  {
    key: 'platformRate',
    group: 'take',
    label: { ru: 'Ставка платформы', en: 'Platform rate' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 7, step: 0.25, def: 2.5, scale: 0.01,
    tip: {
      ru: 'Сколько вы берёте с продаж через виджет на сайте организатора. Сервисного сбора там нет: цену для покупателя на своём сайте назначает он, а не вы, — так что это вся ваша выручка с такого билета. Плюс эквайринг банк снимает и с неё тоже.',
      en: 'What you take from sales through the widget on the organiser site. There is no buyer fee there: on their own site they set the price the buyer sees, not you — so this is all the revenue you get from such a ticket. And the bank takes its card fees out of it too.',
    },
  },
  {
    key: 'platformFee',
    group: 'take',
    label: { ru: 'Абонплата платформы', en: 'Platform subscription' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 120_000, step: 5_000, def: 20_000,
    // Режимы заменяют ползунок (аудит 2026-08): вершина по замеру — «Полная»
    // (60 тыс. = 21.0 млрд на платформенной опоре, 50 тыс. = 20.8, 70 тыс. —
    // уже 18.3: дальше длинный хвост клубов уходит к конкуренту).
    policyMode: 'replace',
    policy: [
      { v: 0, label: { ru: 'Бесплатно', en: 'Free' },
        note: { ru: 'Виджет даром: подключаются даже клубы, денег он приносит только оборотом.', en: 'The widget is free: even small clubs connect, and it earns only through turnover.' } },
      { v: 20_000, label: { ru: 'Символическая', en: 'Token' },
        note: { ru: 'Небольшая абонплата: крупным незаметна, маленьким уже повод подумать.', en: 'A small subscription: invisible to the big ones, already something for the small ones to think about.' } },
      { v: 60_000, label: { ru: 'Полная', en: 'Full' },
        note: { ru: 'Деньги, не зависящие от оборота, — но длинный хвост маленьких площадок останется у конкурента.', en: 'Money independent of turnover — but the long tail of small venues stays with your rival.' } },
    ],
    tip: {
      ru: 'Фиксированная плата с подключённого организатора. Деньги, не зависящие от оборота, — но для маленького клуба это и есть причина не подключаться.',
      en: 'A flat fee per connected organiser. Money that does not depend on turnover — and for a small club, exactly the reason not to connect.',
    },
  },
  {
    key: 'marketing',
    group: 'growth',
    label: { ru: 'Маркетинг на зрителей', en: 'Marketing to buyers' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 200_000_000, step: 5_000_000, def: 15_000_000,
    tip: {
      ru: 'Растит охват: сколько людей вообще помнят, где покупать билеты. Охват — это и есть аргумент в разговоре с организатором. У охвата есть критическая масса: город либо помнит вас, либо нет — ниже ~45 млн/мес бренд забывают быстрее, чем вы его строите, и маховик «охват → организаторы → афиша → зрители» не заводится.',
      en: 'Grows reach: how many people remember where to buy tickets at all. Reach is exactly the argument you bring to an organiser. Reach has a critical mass: the city either remembers you or it does not — below ~$450K/mo the brand is forgotten faster than you build it, and the flywheel of reach → organisers → listings → buyers never starts.',
    },
  },
  {
    key: 'managers',
    group: 'growth',
    label: { ru: 'Аккаунт-менеджеры', en: 'Account managers' },
    unit: { ru: 'чел.', en: 'people' },
    min: 0, max: 120, step: 5, def: 15,
    tip: {
      ru: 'Кто подключает организаторов и разбирает их проблемы. Перегруженная команда теряет их быстрее, чем приводит новых.',
      en: 'The people who sign organisers up and sort out their problems. An overloaded team loses them faster than it brings new ones in.',
    },
  },
  {
    key: 'onboarding',
    group: 'growth',
    label: { ru: 'Бюджет на подключения', en: 'Onboarding budget' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 40_000_000, step: 1_000_000, def: 0,
    tip: {
      ru: 'Виджет не включается кнопкой: у каждого организатора уже что-то стоит — своё или конкурента. Это деньги на переезд: интеграция, перенос схем залов и абонементов, обучение кассиров, аванс под мероприятия. Чем нужнее организатору виджет, тем дешевле он соглашается; стадион со своей системой стоит дороже всех.',
      en: 'The widget does not switch on with a button: every organiser already runs something — their own or the rival\'s. This is the money for moving them: integration, porting seat maps and season tickets, training the box office, an advance against events. The more an organiser needs the widget, the less it costs to win them over; a stadium with its own system costs the most.',
    },
  },
  {
    key: 'platformDev',
    group: 'growth',
    label: { ru: 'Разработка платформы', en: 'Platform development' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 80_000_000, step: 2_000_000, def: 8_000_000,
    tip: {
      ru: 'Билетный виджет на сайте организатора, схемы залов, абонементы, отчёты. Чем сильнее платформа, тем больше организаторов вообще способны с вами работать.',
      en: 'The ticketing widget for the organiser site, seating charts, season tickets, reports. The stronger the platform, the more organisers can work with you at all.',
    },
  },
  {
    key: 'product',
    group: 'infra',
    label: { ru: 'Продукт и приложение', en: 'Product and app' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 80_000_000, step: 2_000_000, def: 8_000_000,
    tip: {
      ru: 'Скорость оплаты, поиск, карта зала. Влияет на конверсию: сколько дошедших до корзины действительно платят.',
      en: 'Checkout speed, search, seat maps. It drives conversion: how many of the people who reach the cart actually pay.',
    },
  },
  {
    key: 'support',
    group: 'infra',
    label: { ru: 'Поддержка', en: 'Support' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 50_000_000, step: 1_000_000, def: 6_000_000,
    tip: {
      ru: 'Возвраты, потерянные билеты, вопросы на входе. Плохая поддержка бьёт по доверию зрителей и по терпению организаторов одновременно.',
      en: 'Refunds, lost tickets, questions at the door. Weak support hits buyer trust and organiser patience at the same time.',
    },
  },
  {
    key: 'capacityTech',
    group: 'infra',
    label: { ru: 'Запас мощности', en: 'Capacity headroom' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 50_000_000, step: 1_000_000, def: 3_000_000,
    tip: {
      ru: 'Серверы под старт продаж на хит. В обычный месяц это выброшенные деньги — ровно до того месяца, когда сайт ляжет на глазах у ста тысяч человек.',
      en: 'Servers for the on-sale rush of a hit. In a normal month this is money thrown away — right up to the month the site goes down in front of a hundred thousand people.',
    },
  },
  {
    key: 'rnd',
    group: 'infra',
    label: { ru: 'Команда данных', en: 'Data team' },
    unit: { ru: '₽/мес', en: '$/mo' },
    min: 0, max: 30_000_000, step: 1_000_000, def: 0,
    tip: {
      ru: 'Качество алгоритмов. Без неё умные механики работают наугад и вредят чаще, чем помогают.',
      en: 'The quality of the algorithms. Without it the smart mechanics guess, and hurt more often than they help.',
    },
  },
];

export const leverByKey = (key) => LEVERS.find((l) => l.key === key);

// ============================================================================
// Алгоритмы — оптимизации второго порядка. Каждая что-то улучшает и что-то
// ломает, и почти каждая тем сильнее вредит, чем хуже данные.
// ============================================================================

export const ALGORITHMS = [
  {
    key: 'personalFeed',
    name: { ru: 'Персональная афиша', en: 'Personal listings' },
    short: { ru: 'персональная афиша', en: 'personal listings' },
    unlock: 0.10,
    install: 40_000_000,
    param: {
      label: { ru: 'Сила персонализации', en: 'Personalisation strength' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'Главная страница собирается под каждого зрителя, а не одинаковая для всех.',
      en: 'The home page is assembled for each buyer instead of being the same for everyone.',
    },
    tradeoff: {
      ru: 'Случайный зритель наконец находит, куда пойти, и длинный хвост клубов начинает продаваться. Но при слабых данных лента схлопывается в десяток хитов — и мелкие организаторы перестают продавать вовсе.',
      en: 'The casual buyer finally finds somewhere to go, and the long tail of clubs starts selling. But with weak data the feed collapses into a dozen hits — and small organisers stop selling at all.',
    },
    lesson: {
      ru: 'Рекомендации решают задачу выбора, а не задачу предложения. Показать можно только то, что уже есть в афише.',
      en: 'Recommendations solve the problem of choosing, not the problem of supply. You can only show what is already listed.',
    },
  },
  {
    key: 'dynamicFee',
    name: { ru: 'Динамический сбор', en: 'Dynamic fee' },
    short: { ru: 'динамический сбор', en: 'dynamic fee' },
    unlock: 0.22,
    install: 70_000_000,
    param: {
      label: { ru: 'Разброс сбора', en: 'Fee spread' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 40, scale: 0.01,
    },
    what: {
      ru: 'Сбор выше на события, которые и так разберут, и ниже на те, где есть места.',
      en: 'The fee is higher on events that will sell out anyway and lower where seats remain.',
    },
    tradeoff: {
      ru: 'Выручка с того же оборота растёт, и заполняемость слабых событий тоже. Но зритель видит, что вчера сбор был другим, — и это самая частая причина написать, что вы жулики.',
      en: 'Revenue from the same turnover rises, and weak events fill up too. But buyers see that the fee was different yesterday — the most common reason to say in public that you are crooks.',
    },
    lesson: {
      ru: 'Ценовая дискриминация работает ровно до того момента, когда покупатель её заметил.',
      en: 'Price discrimination works exactly until the buyer notices it.',
    },
  },
  {
    key: 'antiBot',
    name: { ru: 'Защита от ботов', en: 'Bot protection' },
    short: { ru: 'антибот', en: 'bot protection' },
    unlock: 0.16,
    install: 55_000_000,
    param: {
      label: { ru: 'Жёсткость проверок', en: 'Check strictness' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
      // Борьба с перекупщиками — это политика, а не ползунок «сделай лучше»:
      // у неё есть внутренний оптимум. Замер на 24 кодах партии (медианы, к
      // «алгоритм не куплен»): 0% даёт +11.8%, 25% — +13.8%, 50% — +2.8%,
      // 75% — −4.6%, 100% — +1.1%. Доверие растёт монотонно (53% -> 65%),
      // итог — нет: за жёсткостью платят отказы живых зрителей.
      //
      // Первый замер был на восьми кодах и указывал на 50%. Он ошибся:
      // разброс по партиям шире разницы между режимами, и на восьми кодах
      // оптимум гуляет. Отсюда правило набора — такие срезы снимать не
      // меньше чем на 24 кодах.
      policy: [
        { v: 0, label: { ru: 'Не мешать', en: 'Let it run' },
          note: { ru: 'Кто успел, тот и купил. Оборот даже растёт: перекупщик платит те же деньги. Зритель видит нули на старте и свой билет втридорога через час — и это тот же зритель, который потом не вернётся.', en: 'First come, first served. Turnover even grows: a reseller pays the same money. The buyer sees zero seats at on-sale and their own ticket at triple price an hour later — and that is the same buyer who does not come back.' } },
        { v: 25, label: { ru: 'Лимит на аккаунт', en: 'Per-account limit' },
          note: { ru: 'Лучший итог по замеру: четыре билета в одни руки. Профессионала не останавливает, случайного спекулянта — да, а живых людей почти не задевает. Дальше этой точки каждый процент жёсткости покупается чужими отказами.', en: 'The measured best: four tickets per person. It does not stop a professional, it does stop the casual reseller, and real buyers barely notice. Past this point every extra percent of strictness is paid for by real buyers giving up.' } },
        { v: 50, label: { ru: 'Очередь и верификация', en: 'Queue and verification' },
          note: { ru: 'Перекупщика отсекаете почти полностью, но очередь и подтверждение по телефону теряют часть зрителей: по замеру итог уже ниже, чем при простом лимите, хотя доверие выше.', en: 'You cut the reseller off almost entirely, but the queue and the phone confirmation lose you some buyers: measured, the result is already below a simple limit, even though trust is higher.' } },
        { v: 100, label: { ru: 'Паспорт на входе', en: 'ID at the door' },
          note: { ru: 'Доверие максимальное (65% против 53% без защиты), но итог почти как без защиты: часть настоящих зрителей не проходит проверку и уходит вместе с деньгами. Репутация — не то же самое, что выручка.', en: 'Trust peaks (65% against 53% with no protection), but the result is no better than no protection at all: some genuine buyers fail the check and leave with their money. Reputation is not the same thing as revenue.' } },
      ],
    },
    what: {
      ru: 'Очередь, лимиты и проверки на старте продаж хита — чтобы билеты достались людям, а не перекупщикам.',
      en: 'A queue, limits and checks at the on-sale of a hit — so that tickets go to people, not to resellers.',
    },
    tradeoff: {
      ru: 'Перекупщик выкупает билет так же быстро, как зритель, и оборот от этого даже растёт. Гибнет доверие: зритель видит нули на старте и свой же билет втридорога через час. Жёсткие проверки, наоборот, отсекают и живых людей.',
      en: 'A reseller buys as fast as a real buyer, and turnover even grows. What dies is trust: the buyer sees zero seats at on-sale and their own ticket at triple price an hour later. Strict checks, in turn, cut off real people too.',
    },
    lesson: {
      ru: 'Оборот и доверие — разные счета. Перекупщик наполняет первый и опустошает второй.',
      en: 'Turnover and trust are different accounts. A reseller fills the first and empties the second.',
    },
  },
  {
    key: 'dripPricing',
    name: { ru: 'Сбор в конце оплаты', en: 'Fee at the last step' },
    short: { ru: 'сбор в конце', en: 'fee shown late' },
    unlock: 0.06,
    install: 12_000_000,
    param: {
      label: { ru: 'Насколько поздно показан сбор', en: 'How late the fee is shown' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'В афише стоит цена билета, а сервисный сбор появляется на последнем шаге оплаты.',
      en: 'Listings show the ticket price; the service fee appears at the last step of checkout.',
    },
    tradeoff: {
      ru: 'Конверсия растёт сразу и заметно: человек, уже выбравший место, редко разворачивается. Доверие падает так же надёжно, и обманутый зритель возвращается реже — эффект копится месяцами.',
      en: 'Conversion rises at once and visibly: someone who has already picked a seat rarely turns back. Trust falls just as reliably, and a buyer who felt tricked comes back less often — the effect builds over months.',
    },
    lesson: {
      ru: 'Скрытая часть цены — это заём у будущих продаж под очень высокий процент.',
      en: 'A hidden part of the price is a loan against future sales at a very high rate.',
    },
  },
];

export const algorithmByKey = (key) => ALGORITHMS.find((a) => a.key === key);

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  // Каким типам организаторов вы ставите билетный виджет. Это решение, а не
  // ползунок: у него долгие последствия в обе стороны.
  platformFor: Object.fromEntries(ORGANIZERS.map((o) => [o.id, false])),
  algoOn: Object.fromEntries(ALGORITHMS.map((a) => [a.key, false])),
  algoParam: Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.param.def * (a.param.scale ?? 1)])),
};
