// ============================================================================
// Параметры мира билетного сервиса «БИЛЕТОН».
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
  // Билетный виджет на сайте организатора: он продаёт сам, вы берёте меньше,
  // но не теряете его целиком. Уровень платформы копится вложениями.
  platformSaturation: 620_000_000,
  platformSeatCost: 2_400,      // ₽/мес обслуживания одного подключённого организатора
  // Организатор без виджета часть оборота уводит мимо вас: продаёт через
  // собственный сайт, кассу у входа в зал или другого оператора. Именно этот кусок
  // и возвращает подключение к платформе — но уже по платформенной ставке.
  leakWithoutPlatform: 0.80,

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
  hqMonthly: 13_000_000,
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
    commissionSensitivity: 1.5, // насколько больно берут комиссию
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
    commissionSensitivity: 2.4,
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
    commissionSensitivity: 0.85,
    feeAwareness: 0.6,
    loyalty: 1.25,
    platformNeed: 1.75,
    selfTraffic: 0.42,
    serviceWeight: 0.35,
    hint: {
      ru: 'Длинный хвост: их тысячи, каждый крошечный. Вручную обслуживать нерентабельно — без билетного виджета они к вам просто не дойдут. Зато к комиссии почти равнодушны.',
      en: 'The long tail: thousands of them, each tiny. Serving them by hand does not pay — without self-service they never reach you at all. In exchange they barely care about commission.',
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
    commissionSensitivity: 3.1,
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
    feeElasticity: 0.8,        // насколько больно бьёт сервисный сбор
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
    feeElasticity: 1.7,
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
    feeElasticity: 2.1,
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
    feeElasticity: 2.6,
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
  { id: 'take', label: { ru: 'Комиссия и сборы', en: 'Fees and commission' }, open: true },
  { id: 'growth', label: { ru: 'Спрос и предложение', en: 'Demand and supply' }, open: true },
  { id: 'infra', label: { ru: 'Продукт и поддержка', en: 'Product and support' }, open: false },
];

export const LEVERS = [
  {
    key: 'buyerFee',
    group: 'take',
    label: { ru: 'Сервисный сбор с покупателя', en: 'Buyer service fee' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 22, step: 0.5, def: 10, scale: 0.01,
    tip: {
      ru: 'Надбавка к цене билета, которую видит зритель на оплате. Самая заметная строка вашей выручки — и самая заметная причина закрыть вкладку.',
      en: 'The mark-up on top of the ticket price that the buyer sees at checkout. The most visible line of your revenue — and the most visible reason to close the tab.',
    },
  },
  {
    key: 'orgCommission',
    group: 'take',
    label: { ru: 'Комиссия с организатора', en: 'Organiser commission' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 14, step: 0.5, def: 5, scale: 0.01,
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
      en: 'What you take from sales through the widget on the organiser site. There is no buyer fee there: on their own site they set the price the buyer sees, not you — so this is all the revenue you get from such a ticket. And the bank takes its acquiring out of it too.',
    },
  },
  {
    key: 'platformFee',
    group: 'take',
    label: { ru: 'Абонплата платформы', en: 'Platform subscription' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 120_000, step: 5_000, def: 20_000,
    tip: {
      ru: 'Фиксированная плата с подключённого организатора. Деньги, не зависящие от оборота, — но для маленького клуба это и есть причина не подключаться.',
      en: 'A flat fee per connected organiser. Money that does not depend on turnover — and for a small club, exactly the reason not to connect.',
    },
  },
  {
    key: 'marketing',
    group: 'growth',
    label: { ru: 'Маркетинг на зрителей', en: 'Marketing to buyers' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 400_000_000, step: 5_000_000, def: 15_000_000,
    tip: {
      ru: 'Растит охват: сколько людей вообще помнят, где покупать билеты. Охват — это и есть аргумент в разговоре с организатором.',
      en: 'Grows reach: how many people remember where to buy tickets at all. Reach is exactly the argument you bring to an organiser.',
    },
  },
  {
    key: 'managers',
    group: 'growth',
    label: { ru: 'Аккаунт-менеджеры', en: 'Account managers' },
    unit: { ru: 'чел.', en: 'people' },
    min: 0, max: 220, step: 5, def: 15,
    tip: {
      ru: 'Кто подключает организаторов и разбирает их проблемы. Перегруженная команда теряет их быстрее, чем приводит новых.',
      en: 'The people who sign organisers up and sort out their problems. An overloaded team loses them faster than it brings new ones in.',
    },
  },
  {
    key: 'platformDev',
    group: 'growth',
    label: { ru: 'Разработка платформы', en: 'Platform development' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 200_000_000, step: 5_000_000, def: 8_000_000,
    tip: {
      ru: 'Билетный виджет на сайте организатора, схемы залов, абонементы, отчёты. Чем сильнее платформа, тем больше организаторов вообще способны с вами работать.',
      en: 'The ticketing widget for the organiser site, seating charts, season tickets, reports. The stronger the platform, the more organisers can work with you at all.',
    },
  },
  {
    key: 'product',
    group: 'infra',
    label: { ru: 'Продукт и приложение', en: 'Product and app' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 200_000_000, step: 5_000_000, def: 8_000_000,
    tip: {
      ru: 'Скорость оплаты, поиск, карта зала. Влияет на конверсию: сколько дошедших до корзины действительно платят.',
      en: 'Checkout speed, search, seat maps. It drives conversion: how many of the people who reach the cart actually pay.',
    },
  },
  {
    key: 'support',
    group: 'infra',
    label: { ru: 'Поддержка', en: 'Support' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 120_000_000, step: 2_000_000, def: 6_000_000,
    tip: {
      ru: 'Возвраты, потерянные билеты, вопросы на входе. Плохая поддержка бьёт по доверию зрителей и по терпению организаторов одновременно.',
      en: 'Refunds, lost tickets, questions at the door. Weak support hits buyer trust and organiser patience at the same time.',
    },
  },
  {
    key: 'capacityTech',
    group: 'infra',
    label: { ru: 'Запас мощности', en: 'Capacity headroom' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 120_000_000, step: 2_000_000, def: 3_000_000,
    tip: {
      ru: 'Серверы под старт продаж на хит. В обычный месяц это выброшенные деньги — ровно до того месяца, когда сайт ляжет на глазах у ста тысяч человек.',
      en: 'Servers for the on-sale rush of a hit. In a normal month this is money thrown away — right up to the month the site goes down in front of a hundred thousand people.',
    },
  },
  {
    key: 'rnd',
    group: 'infra',
    label: { ru: 'Команда данных', en: 'Data team' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 90_000_000, step: 2_000_000, def: 0,
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
    short: { ru: 'сбор в конце', en: 'late fee reveal' },
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
