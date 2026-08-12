// ============================================================================
// Параметры мира. Все константы вынесены сюда, чтобы преподаватель мог
// менять баланс без правки логики симуляции.
// Денежная единица — рубли, шаг времени — 1 неделя.
//
// Текстовые поля двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

export const CONFIG = {
  weeksTotal: 52,          // длительность партии, недель
  startCash: 50_000_000,   // стартовый капитал (посевной раунд)

  // --- Средний чек ---
  aovBase: 900,            // средний чек заказа в «среднем» районе, ₽
  aovIncomeExponent: 0.7,  // насколько чек растёт с доходом района

  // --- Эталонные значения (точка, в которой все коэффициенты равны 1.0) ---
  refDeliveryFee: 149,     // эталонная стоимость доставки для клиента, ₽
  // Во сколько раз плата за доставку заметнее тех же денег в цене блюда.
  // При 149 ₽ это ничего не меняет — воспринимаемая цена считается от той же
  // точки отсчёта. Работает только отклонение от неё.
  deliveryFeeSalience: 2.5,
  refDeliveryTime: 35,     // эталонное время доставки, мин
  refRestaurants: 80,      // эталонное число ресторанов в районе
  refMarketingPerUser: 12, // эталонные маркетинговые траты на 1 потенц. клиента в неделю, ₽

  // --- Курьеры ---
  courierBaseOrders: 105,      // заказов в неделю на курьера при эталонной дистанции и ясной погоде
  courierRefDistanceKm: 3.5,   // эталонное плечо доставки
  courierMarketWeeklyPay: 14_000, // сколько курьер заработает у конкурента / на другой работе
  courierHireCost: 8_000,      // разовая стоимость найма, проверки и экипировки
  courierBaseChurn: 0.05,      // базовый недельный отток курьеров
  courierApplicantsBase: 400,  // максимум откликов в неделю при отличных условиях
  courierExpectedLoad: 0.75,   // на какую загрузку смены рассчитывает кандидат
  courierHireThreshold: 0.9,   // отклики начинаются, когда заработок подходит к рыночному
  courierHireSpan: 0.6,        // насколько «круто» растёт поток откликов сверх порога

  // --- Рестораны ---
  restaurantRefOrders: 45,     // «нормальный» поток заказов на ресторан в неделю
  restaurantRefCommission: 0.20,
  restaurantBaseChurn: 0.015,
  // У ресторана своя экономика: выше этой комиссии доставка для него убыточна
  // при любом объёме заказов, и никакой поток это не компенсирует.
  restaurantMaxCommission: 0.30,
  restaurantCommissionSpan: 0.12,
  // Ресторан не работает себе в убыток: комиссию выше привычной он закладывает
  // в цену блюда. Платит в итоге клиент — и видит это в чеке, а не в договоре.
  // При комиссии 20% надбавки нет вовсе, так что опорный расчёт это не двигает.
  commissionPassThrough: 0.6,
  salesRefBudget: 150_000,     // эталонный недельный бюджет отдела подключения, ₽

  maxMarketShare: 0.90,       // потолок доли: часть города к нам не придёт никогда
  competitorLock: 0.6,         // какая доля «силы конкурента» полностью недоступна вам
  // Конкурент рядом, и его цена за нашей не идёт. Пока мы стоим как рынок,
  // эти два коэффициента не делают ничего: они включаются ровно настолько,
  // насколько мы дороже. Частота заказов падает плавно, а уход к конкуренту —
  // это уже потеря клиента, и вернуть его дороже, чем было удержать.
  rivalPricePull: 0.32,        // насколько наценка ускоряет отток к конкуренту
  rivalTrialPull: 1.8,         // насколько наценка мешает переманить нового человека

  // --- Клиенты ---
  customerBaseChurn: 0.07,     // базовый недельный отток клиентов
  trialRate: 0.05,             // доля «узнавших», пробующих сервис за неделю
  awarenessDecay: 0.05,        // забывание бренда за неделю
  awarenessMaxGain: 0.35,      // потолок прироста узнаваемости за неделю

  // --- Операционные издержки ---
  paymentFeeRate: 0.018,       // эквайринг, % от суммы платежа клиента
  supportCostPerOrder: 14,     // поддержка + возвраты на заказ, ₽
  supportTechDiscount: 8,      // на сколько ₽ снижает поддержку максимальный уровень техно
  // Офис и менеджмент. Разработка и серверы вынесены отдельными статьями:
  // раньше они прятались здесь и не росли ни с продуктом, ни с нагрузкой.
  hqWeeklyBase: 560_000,       // офис и менеджмент, ₽/нед
  // Содержание построенного: каждая вложенная в технологии сумма приходит
  // счётом каждую неделю, сколько бы времени ни прошло.
  techUpkeepRate: 0.0034,
  // Серверы под нагрузкой — единственная статья, дорожающая от успеха
  serverPerOrder: 1.9,
  serverTechRelief: 0.35,
  // Курьер стоит денег, даже когда не везёт заказ: выходы на слот, гарантии,
  // экипировка, страховка, диспетчеризация. Поэтому запас мощности не бесплатен.
  hqPerCourier: 2_200,         // содержание одного курьера, ₽/нед
  techSaturation: 40_000_000,  // сколько нужно вложить в технологии для «половины» эффекта

  // --- Данные и алгоритмы ---
  // Качество алгоритмов = √(данные × команда). Нужно и то и другое: модель без
  // данных не обучишь, а данные без команды никто не превратит в решения.
  rndSaturation: 25_000_000,   // вложения в data science для «половины» эффекта
  dataSaturation: 400_000,     // накопленных заказов для «половины» эффекта

  // --- Инвестиции ---
  // Раунд открыт со второй недели. На максимальном маркетинге стартовых денег
  // хватает на три недели — при прежнем пороге в четыре предупреждение
  // «деньги кончаются» вело к кнопке, которая ещё не работает, и выхода не было.
  minWeekForFunding: 2,
  fundingOptions: [20_000_000, 50_000_000, 120_000_000],
};

// ============================================================================
// Районы вымышленного города Новоград (~1.4 млн жителей).
// potential — потенциальные клиенты (взрослые, готовые заказывать доставку).
// ============================================================================

export const DISTRICTS = [
  {
    id: 'center',
    name: { ru: 'Центр', en: 'Downtown' },
    potential: 130_000, income: 1.35, distanceKm: 2.4, baseTime: 19,
    elasticity: 1.0, baseFreq: 0.60, competitor: 0.50,
    restaurantPool: 340, launchCost: 3_000_000, weeklyFixed: 300_000,
    hint: {
      ru: 'Дорогой, плотный, высокая конкуренция. Лучшая юнит-экономика, но клиента надо отбивать у конкурента.',
      en: 'Expensive, dense, fiercely contested. The best unit economics in the city — but every customer has to be taken from a rival.',
    },
  },
  {
    id: 'sever',
    name: { ru: 'Северный', en: 'Northside' },
    potential: 180_000, income: 1.00, distanceKm: 3.6, baseTime: 23,
    elasticity: 1.4, baseFreq: 0.45, competitor: 0.35,
    restaurantPool: 260, launchCost: 2_200_000, weeklyFixed: 260_000,
    hint: {
      ru: 'Самый большой спальный район. Средний по всем параметрам — основной объём.',
      en: 'The largest residential district. Average on every dimension, which is exactly why it carries the volume.',
    },
  },
  {
    id: 'zarechie',
    name: { ru: 'Заречье', en: 'Riverside' },
    potential: 150_000, income: 0.90, distanceKm: 5.0, baseTime: 27,
    elasticity: 1.6, baseFreq: 0.38, competitor: 0.25,
    restaurantPool: 180, launchCost: 1_800_000, weeklyFixed: 230_000,
    hint: {
      ru: 'Разбросанная застройка: длинное плечо, курьеры теряют производительность.',
      en: 'Sprawling and low-rise: long delivery legs, so couriers complete fewer orders per shift.',
    },
  },
  {
    id: 'univer',
    name: { ru: 'Университетский', en: 'Campus' },
    potential: 90_000, income: 0.70, distanceKm: 3.0, baseTime: 21,
    elasticity: 2.2, baseFreq: 0.75, competitor: 0.40,
    restaurantPool: 120, launchCost: 1_200_000, weeklyFixed: 180_000,
    hint: {
      ru: 'Студенты: заказывают часто, но крайне чувствительны к цене. Рай для промо, ад для маржи.',
      en: 'Students order often and count every rouble. Heaven for promotions, hell for margin.',
    },
  },
  {
    id: 'promzona',
    name: { ru: 'Промзона', en: 'Industrial' },
    potential: 110_000, income: 0.75, distanceKm: 6.0, baseTime: 31,
    elasticity: 1.8, baseFreq: 0.30, competitor: 0.15,
    restaurantPool: 90, launchCost: 1_000_000, weeklyFixed: 200_000,
    hint: {
      ru: 'Дешёвый вход и почти нет конкурентов, но мало ресторанов и низкая частота.',
      en: 'Cheap to enter and almost no competition — but few restaurants and low order frequency.',
    },
  },
  {
    id: 'zagorod',
    name: { ru: 'Загородный', en: 'Suburbs' },
    potential: 60_000, income: 1.60, distanceKm: 9.0, baseTime: 38,
    elasticity: 0.8, baseFreq: 0.30, competitor: 0.10,
    restaurantPool: 70, launchCost: 1_600_000, weeklyFixed: 240_000,
    hint: {
      ru: 'Богатые коттеджи. Цену не замечают, но плечо огромное — курьер делает мало заказов.',
      en: 'Wealthy houses that never look at the price — but the delivery legs are enormous and couriers barely complete a shift.',
    },
  },
];

// ============================================================================
// Рычаги управления. Описания используются в интерфейсе как обучающие подсказки.
// ============================================================================

export const LEVERS = [
  {
    key: 'deliveryFee',
    label: { ru: 'Стоимость доставки', en: 'Delivery fee' },
    unit: { ru: '₽', en: '₽' },
    min: 0, max: 399, step: 10, def: 149,
    tip: {
      ru: 'Прямая выручка с заказа. Но спрос эластичен: рост цены на 10% в студенческом районе срезает частоту заказов сильнее, чем в центре.',
      en: 'Direct revenue on every order. But demand is elastic: a 10% price rise cuts order frequency far harder on campus than downtown.',
    },
  },
  {
    key: 'commissionRate',
    label: { ru: 'Комиссия с ресторана', en: 'Restaurant commission' },
    unit: { ru: '%', en: '%' },
    min: 5, max: 40, step: 1, def: 20, scale: 0.01,
    tip: {
      ru: 'Главный источник выручки. Высокая комиссия отпугивает рестораны — падает выбор, а вместе с ним и спрос клиентов.',
      en: 'Your main revenue source. Push it too high and restaurants leave — selection shrinks, and customer demand follows it down.',
    },
  },
  {
    key: 'courierPay',
    label: { ru: 'Оплата курьеру за заказ', en: 'Courier pay per order' },
    unit: { ru: '₽', en: '₽' },
    min: 60, max: 400, step: 10, def: 180,
    tip: {
      ru: 'Основная переменная себестоимость. Мало платите — курьеры уходят, растёт время доставки и падает удержание клиентов.',
      en: 'Your largest variable cost. Underpay and couriers leave, delivery times climb, and customer retention goes with them.',
    },
  },
  {
    key: 'targetCouriers',
    label: { ru: 'Целевой штат курьеров', en: 'Target courier headcount' },
    unit: { ru: 'чел', en: 'people' },
    min: 0, max: 4000, step: 50, def: 0,
    tip: {
      ru: 'Сколько курьеров вы хотите иметь. Нанять получится столько, сколько придёт откликов — а они зависят от заработка курьера.',
      en: 'How many couriers you want. How many you get depends on applications — and those depend on what a courier actually earns.',
    },
  },
  {
    key: 'marketing',
    label: { ru: 'Маркетинг', en: 'Marketing' },
    unit: { ru: '₽/нед', en: '₽/wk' },
    min: 0, max: 20_000_000, step: 250_000, def: 0,
    tip: {
      ru: 'Растит узнаваемость → приток новых клиентов. Работает с убывающей отдачей и «забывается» ~5% в неделю.',
      en: 'Builds awareness, which brings new customers. Diminishing returns, and awareness decays about 5% every week.',
    },
  },
  {
    key: 'promo',
    label: { ru: 'Промо-скидка на заказ', en: 'Promo discount per order' },
    unit: { ru: '₽', en: '₽' },
    min: 0, max: 300, step: 10, def: 0,
    tip: {
      ru: 'Скидка клиенту за ваш счёт. Мгновенно поднимает спрос и убивает маржу — классическая ловушка «покупки роста».',
      en: 'A discount funded out of your own margin. It lifts demand instantly and destroys contribution — the classic buying-growth trap.',
    },
  },
  {
    key: 'weatherBonus',
    label: { ru: 'Надбавка за плохую погоду', en: 'Bad-weather bonus' },
    unit: { ru: '₽', en: '₽' },
    min: 0, max: 150, step: 10, def: 0,
    tip: {
      ru: 'Доплата курьеру за заказ в дождь, снег и гололёд. В ясную погоду не стоит ничего: расход появляется ровно тогда, когда без него срываются смены.',
      en: 'Extra pay per order in rain, snow and ice. Costs nothing when the weather is clear — the expense appears exactly when shifts would otherwise be abandoned.',
    },
  },
  {
    key: 'sales',
    label: { ru: 'Подключение ресторанов', en: 'Restaurant acquisition' },
    unit: { ru: '₽/нед', en: '₽/wk' },
    min: 0, max: 5_000_000, step: 100_000, def: 0,
    tip: {
      ru: 'Бюджет отдела продаж. Без ресторанов нет ассортимента, а без ассортимента клиенты не приходят вообще.',
      en: 'Your sales team budget. No restaurants means no selection, and with no selection customers simply never arrive.',
    },
  },
  {
    key: 'tech',
    label: { ru: 'Технологии и логистика', en: 'Technology and logistics' },
    unit: { ru: '₽/нед', en: '₽/wk' },
    min: 0, max: 8_000_000, step: 100_000, def: 0,
    tip: {
      ru: 'Накопительная инвестиция: улучшает маршрутизацию (больше заказов на курьера), ускоряет доставку и удешевляет поддержку.',
      en: 'A cumulative investment: better routing (more orders per courier), faster delivery and cheaper support.',
    },
  },
  {
    key: 'rnd',
    label: { ru: 'Data Science', en: 'Data science' },
    unit: { ru: '₽/нед', en: '₽/wk' },
    min: 0, max: 6_000_000, step: 100_000, def: 0,
    tip: {
      ru: 'Команда, которая строит алгоритмы: динамическое ценообразование, персональные скидки, прогноз спроса. Без данных бесполезна, а данные копятся только от заказов.',
      en: 'The team that builds your algorithms: surge pricing, targeted discounts, demand forecasting. Useless without data — and data only accumulates from completed orders.',
    },
  },
];

// ============================================================================
// Алгоритмы — «оптимизации второго порядка».
//
// Обычный рычаг задаёт ЧИСЛО (цена = 149 ₽). Алгоритм задаёт ПРАВИЛО
// (цена = f(загрузка)) и потому способен улучшить сразу оба конца компромисса.
// Но у каждого правила есть цена: неточность модели, недовольство клиентов,
// потеря части выручки. Оптимум всегда внутри диапазона, а не на его краю.
//
// unlock — требуемое качество алгоритмов (√(данные × команда)).
// install — разовая стоимость внедрения.
// ============================================================================

export const ALGORITHMS = [
  {
    key: 'batching',
    name: { ru: 'Объединение заказов', en: 'Order batching' },
    short: { ru: 'батчинг', en: 'batching' },
    unlock: 0.10,
    install: 1_500_000,
    param: {
      label: { ru: 'Агрессивность', en: 'Aggressiveness' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 40, scale: 0.01,
    },
    what: {
      ru: 'Курьер везёт несколько заказов за одну поездку, если они по пути.',
      en: 'A courier carries several orders on one trip when they happen to be on the same route.',
    },
    tradeoff: {
      ru: 'Производительность курьера растёт, но каждый заказ едет дольше. Чем хуже алгоритм, тем сильнее страдает время доставки.',
      en: 'Courier productivity rises, but every order takes longer. The worse the algorithm, the more delivery time suffers.',
    },
    lesson: {
      ru: 'Классический компромисс «эффективность против скорости». Хороший алгоритм не убирает компромисс, а сдвигает его границу.',
      en: 'The classic efficiency-versus-speed trade-off. A good algorithm does not remove the trade-off — it moves the frontier.',
    },
  },
  {
    key: 'forecast',
    name: { ru: 'Прогноз спроса и автонайм', en: 'Demand forecast and auto-hiring' },
    short: { ru: 'прогноз', en: 'forecast' },
    unlock: 0.15,
    install: 2_000_000,
    param: {
      label: { ru: 'Целевая загрузка', en: 'Target utilisation' },
      unit: { ru: '%', en: '%' },
      min: 50, max: 95, step: 5, def: 75, scale: 0.01,
    },
    what: {
      ru: 'Штат курьеров подбирается автоматически под прогноз спроса следующей недели.',
      en: 'Courier headcount is sized automatically against next week’s demand forecast.',
    },
    tradeoff: {
      ru: 'Вы больше не двигаете ползунок штата вручную — но платите за ошибку прогноза. Точность растёт вместе с качеством алгоритмов.',
      en: 'You stop moving the headcount slider by hand — and start paying for forecast error instead. Accuracy grows with algorithm quality.',
    },
    lesson: {
      ru: 'Планирование мощности — это выбор между простоем и нарушением сроков. Алгоритм не отменяет выбор, он лишь сужает разброс.',
      en: 'Capacity planning is a choice between idle couriers and broken promises. The algorithm does not remove the choice, it only narrows the spread.',
    },
  },
  {
    key: 'targeting',
    name: { ru: 'Персональные скидки', en: 'Targeted discounts' },
    short: { ru: 'таргетинг', en: 'targeting' },
    unlock: 0.25,
    install: 3_000_000,
    param: {
      label: { ru: 'Охват скидкой', en: 'Discount reach' },
      unit: { ru: '% клиентов', en: '% of customers' },
      min: 5, max: 100, step: 5, def: 35, scale: 0.01,
    },
    what: {
      ru: 'Промо-скидка уходит не всем подряд, а тем, кто без неё не сделает заказ.',
      en: 'The promo discount goes only to customers who would not order without it.',
    },
    tradeoff: {
      ru: 'Вы платите только за часть заказов, но при слабой модели промахиваетесь: скидку получают те, кто заказал бы и так, а обделённые клиенты замечают несправедливость.',
      en: 'You pay on a fraction of orders — but a weak model misfires: the discount lands on people who would have ordered anyway, while everyone else notices the unfairness.',
    },
    lesson: {
      ru: 'Ценовая дискриминация: та же прибавка спроса за меньшие деньги. Это самый прибыльный из «умных» инструментов и самый требовательный к качеству данных.',
      en: 'Price discrimination: the same lift in demand for less money. The most profitable of the smart tools, and the most demanding about data quality.',
    },
  },
  {
    key: 'surge',
    name: { ru: 'Динамическое ценообразование', en: 'Surge pricing' },
    short: { ru: 'surge', en: 'surge' },
    unlock: 0.35,
    install: 3_500_000,
    param: {
      label: { ru: 'Сила надбавки', en: 'Surge strength' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 50, scale: 0.01,
    },
    what: {
      ru: 'В часы пик стоимость доставки растёт, в спокойные часы остаётся базовой.',
      en: 'The delivery fee rises during peak hours and stays at base rate the rest of the time.',
    },
    tradeoff: {
      ru: 'Пиковая выручка выше, а часть пикового спроса сдвигается на свободные часы — курьеры разгружаются. Но клиенты не любят непредсказуемую цену.',
      en: 'Peak revenue is higher and part of the peak demand shifts into quieter hours, easing the load. But customers hate an unpredictable price.',
    },
    lesson: {
      ru: 'Цена — не число, а инструмент управления спросом. Surge зарабатывает не столько на надбавке, сколько на сглаживании пика.',
      en: 'Price is not a number, it is a demand-management tool. Surge earns less from the premium itself than from flattening the peak.',
    },
  },
  {
    key: 'allocation',
    name: { ru: 'Умное распределение курьеров', en: 'Smart courier allocation' },
    short: { ru: 'аллокация', en: 'allocation' },
    unlock: 0.45,
    install: 2_500_000,
    param: {
      label: { ru: 'Приоритет маржи', en: 'Margin priority' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 40, scale: 0.01,
    },
    what: {
      ru: 'Курьеры перераспределяются в районы с более высоким вкладом с заказа.',
      en: 'Couriers are shifted towards districts with higher contribution per order.',
    },
    tradeoff: {
      ru: 'Прибыльные районы получают лучший сервис, остальные — худший. Там растёт время доставки и отток клиентов.',
      en: 'Profitable districts get better service and the rest get worse: delivery times and churn both rise there.',
    },
    lesson: {
      ru: 'Оптимизация по одной метрике всегда кому-то ухудшает жизнь. Вопрос не «оптимизировать ли», а «что именно вы согласны ухудшить».',
      en: 'Optimising one metric always makes something else worse. The question is never whether to optimise, but what you are willing to degrade.',
    },
  },
  {
    key: 'flexCommission',
    name: { ru: 'Гибкая комиссия для ресторанов', en: 'Flexible restaurant commission' },
    short: { ru: 'гибкая комиссия', en: 'flexible commission' },
    unlock: 0.40,
    install: 2_000_000,
    param: {
      label: { ru: 'Разброс ставок', en: 'Rate spread' },
      unit: { ru: '%', en: '%' },
      min: 0, max: 100, step: 5, def: 40, scale: 0.01,
    },
    what: {
      ru: 'Комиссия считается индивидуально: крупным и востребованным — ниже, остальным — выше.',
      en: 'Commission is set per partner: lower for large, in-demand restaurants, higher for the rest.',
    },
    tradeoff: {
      ru: 'Рестораны в среднем довольнее и реже уходят, но средняя комиссия падает.',
      en: 'Partners are happier on average and churn less, but your average take rate drops.',
    },
    lesson: {
      ru: 'Сегментация вместо единой цены работает на обеих сторонах маркетплейса — и для клиентов, и для партнёров.',
      en: 'Segmentation instead of one flat price works on both sides of a marketplace — for customers and for partners alike.',
    },
  },
];

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  districts: [],
  algoOn: Object.fromEntries(ALGORITHMS.map((a) => [a.key, false])),
  algoParam: Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.param.def * (a.param.scale ?? 1)])),
};
