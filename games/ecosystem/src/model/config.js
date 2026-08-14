// ============================================================================
// Параметры мира игры «НОВОГРАД» — экосистемного симулятора-«эндгейма».
// Все константы вынесены сюда, чтобы преподаватель мог менять баланс
// без правки логики симуляции.
// Денежная единица — рубли, шаг времени — 1 месяц, партия — три года.
//
// Ключевая идея архитектуры: стартовый актив — это ДАННЫЕ, а не код.
// Победившая компания любой из трёх игр описывается дескриптором в
// START_ASSETS: агрегированные метрики (база, ARPU, маржа) и профиль
// синергий. Движок читает только дескриптор — старты от КИНОРЕКИ и
// БИЛЕТВИЛЯ добавляются новыми записями, а не переписыванием движка.
// В прототипе фазы 1 запись одна: доставка (финал НОВОЕДЫ).
//
// Текстовые поля двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

export const CONFIG = {
  monthsTotal: 36,          // партия — три года жизни холдинга
  startCash: 220_000_000,   // казна компании-победителя после насыщения рынка

  // --- Город ---
  // Взрослые жители Новограда, пользующиеся городскими онлайн-сервисами.
  // Это общий потолок уникальных клиентов холдинга: ответ на него — ARPU,
  // а не охват.
  cityAdults: 620_000,

  // --- Холдинг ---
  hqMonthly: 6_000_000,     // управление холдинга: финансы, юристы, HR
  // Каннибализация фокуса: каждая вертикаль сверх первой размывает
  // исполнение ВСЕХ вертикалей. Управляющая компания (рычаг mgmt)
  // выкупает этот штраф, но не бесплатно.
  focusPenaltyPerVertical: 0.12,
  mgmtSaturation: 6_000_000,   // ₽/мес управляющей компании для «половины» эффекта

  // --- Кросс-селл ---
  // Клиент соседней вертикали в разы дешевле холодного: он уже в приложении,
  // уже платит, уже доверяет бренду. Но у канала есть ёмкость: нельзя
  // сконвертировать больше, чем готово попробовать за месяц, — перерасход
  // бюджета сгорает (и виден в отчёте).
  crossSellCac: 260,           // ₽ за приведённого клиента (до синергии)
  crossSellMonthlyReach: 0.055, // какая доля пула готова попробовать за месяц
  crossBackCac: 320,           // обратное направление (такси -> еда)
  crossBackMonthlyReach: 0.03,
  crossBackShare: 0.25,        // доля бюджета кросс-селла на обратное направление
  // Экосистемная привычка: клиент двух сервисов уходит из каждого реже.
  // Это предвестник подписки Plus (фаза 3), пока эффект умеренный.
  ecoChurnRelief: 0.30,

  // --- Еда (портфельный уровень стартового актива) ---
  foodOpsSaturation: 5_000_000,  // ₽/мес сервисных вложений для «половины» качества
  foodQualityFloor: 0.45,        // качество при нулевых вложениях
  // Эластичность дожима: часть повышения монетизации съедает частота.
  // Дожим обязан работать в моменте (это и есть соблазн) — платить за него
  // должно будущее, то есть отток базы.
  foodTakeElasticity: 0.35,
  // За порогом клиенты не «чуть недовольнее» — уходят к конкуренту ускоренно
  foodTakeThreshold: 1.15,
  foodTakePressure: 0.08,        // мягкая зона: отток растёт с дожимом
  foodTakeExodus: 0.30,
  foodQualityRef: 0.75,          // качество, при котором добавки к оттоку нет
  foodChurnQuality: 0.06,        // сколько оттока добавляет плохое качество
  foodOrganicShare: 0.03,        // доля свободного остатка рынка, приходящая сама
  // Возврат ушедших: единственный работающий «маркетинг» насыщенного рынка.
  // Ушедший клиент помнит сервис — вернуть его дешевле, чем найти нового,
  // но пул конечен и тает.
  foodWinbackCac: 750,           // ₽ за возвращённого
  foodWinbackReach: 0.10,        // доля пула ушедших, достижимая за месяц
  foodReturnPoolDecay: 0.06,     // пул ушедших забывает сервис
  foodReturnShare: 0.65,         // какая часть оттока попадает в пул возврата
  foodSeasonAmp: 0.04,

  // --- Такси: производительность и рынок труда ---
  taxiTripsPerDriver: 330,       // поездок в месяц на активного водителя
  taxiDriverOnboardCost: 25_000, // привлечение и онбординг одного водителя
  taxiDriverBaseChurn: 0.07,     // месячный отток водителей
  // Водитель без поездок не ждёт — уходит к конкуренту
  taxiDriverIdleChurn: 0.16,
  taxiDriverIdleFloor: 0.62,     // ниже этой загрузки водитель считает месяц пустым
  taxiCostPerTrip: 14,           // поддержка, эквайринг, карты и колл-центр
  taxiPriceElasticity: 1.2,
  // Тариф ниже рынка — это не «дешёвый спрос», а скидки за счёт платформы:
  // часть недобранной цены субсидируется из вашей маржи (остальное теряет
  // водитель — и это уже учтено его оттоком). Без этой строки первый же
  // замер показал упор ползунка на минимуме: демпинг был бесплатным.
  taxiSubsidyShare: 0.35,
  taxiSeasonAmp: 0.06,
  taxiBaseChurn: 0.055,          // месячный отток клиентов такси
  taxiChurnQuality: 0.10,
  taxiChurnFill: 0.22,           // недовоз (долгая подача) гонит клиентов
  // Холодное привлечение: конкурентный рынок перформанс-маркетинга.
  // Насыщающая отдача: первые миллионы приводят дешевле последних.
  taxiMarketingSaturation: 15_000_000,
  taxiMarketingReach: 0.10,      // доля свободного пула при бесконечном бюджете

  // --- Оценка холдинга: sum-of-parts ---
  valuationWindow: 6,            // окно выручки и маржи, месяцев
  growthWindow: 3,               // окно темпа роста
  valuationFloor: 800_000_000,   // пол под оценкой в раунде
  // Премия за работающий кросс-селл: инвестор платит за клиентов,
  // сидящих в двух и более сервисах, — их LTV выше, отток ниже.
  crossPremiumPerShare: 0.75,    // премия = доля мульти-клиентов x этот вес
  crossPremiumCap: 0.30,
  // Убыточная вертикаль не «стоит ноль» — она дисконтируется как обязательство:
  // инвестор вычитает её годовой burn с множителем.
  lossBurnMultiple: 3,
  // Множители по вертикалям: зрелая еда стоит как дойная корова,
  // растущее такси — как история роста.
  multiples: {
    food: { base: 1.2, growthWeight: 4, marginWeight: 3, marginPenalty: 2.0, min: 0.4, max: 6 },
    taxi: { base: 1.6, growthWeight: 5, marginWeight: 3, marginPenalty: 1.5, min: 0.4, max: 9 },
  },

  // --- Инвестиции ---
  minMonthForFunding: 2,
  fundingOptions: [150_000_000, 400_000_000, 900_000_000],

  // --- Совет директоров ---
  boardYearMonths: 12,
  boardCapMonths: 6,
  boardMarketingCap: 6_000_000,  // потолок на КАЖДЫЙ бюджет привлечения
  boardInjection: 250_000_000,
};

// ============================================================================
// Стартовые активы — «классы персонажа». Дескриптор сжимает победившую
// компанию исходной игры до портфельного уровня: агрегаты вместо
// микроменеджмента. Микроменеджмент остаётся в исходных играх.
//
// В прототипе фазы 1 играбелен один старт — доставка. Записи от КИНОРЕКИ
// (стриминг: дешёвая синергия с подпиской) и БИЛЕТВИЛЯ (партнёрская сеть
// организаторов) добавятся сюда данными после одобрения прототипа.
// ============================================================================

export const START_ASSETS = [
  {
    id: 'delivery',
    icon: '🛵',
    fromGame: { ru: 'НОВОЕДА', en: 'NOVOEDA' },
    name: { ru: 'Доставка еды «Новоеда»', en: 'Novoeda food delivery' },
    hint: {
      ru: 'Вы выиграли рынок доставки еды Новограда. Рынок насыщен: расти числом клиентов больше некуда, город ваш. Дальше — расти выручкой с клиента.',
      en: 'You won Novograd’s food delivery market. It is saturated: there is no one left to acquire — the city is yours. From here, growth means revenue per customer.',
    },
    // Агрегаты портфельного уровня
    users: 210_000,          // активная база клиентов
    arpu: 290,               // выручка платформы на клиента, ₽/мес
    margin: 0.38,            // вклад вертикали (доля выручки платформы)
    fixedMonthly: 9_000_000, // фикс вертикали: районные операции, дарксторы, офис
    baseChurn: 0.018,        // месячный отток в насыщенном рынке
    returnPool: 30_000,      // недавно ушедшие — пул возврата
    reachableCap: 240_000,   // потолок базы: часть города к вам не придёт никогда
    // Профиль синергий: во сколько раз кросс-селл в целевую вертикаль
    // дешевле эталона. У доставки лучшая синергия — е-ком (курьеры уже
    // ездят по городу), у стриминга была бы подписка, у билетов — партнёрства.
    synergy: { taxi: 1.0, scooters: 1.1, ecom: 1.5, subscription: 0.9 },
    synergyNote: {
      ru: 'Сильная сторона доставки: собственная курьерская логистика. Дешевле всего ей даётся е-ком (фаза 2) — курьеры уже ездят по городу.',
      en: 'Delivery’s edge is its own courier logistics. Its cheapest synergy is e-commerce (phase 2): the couriers already criss-cross the city.',
    },
  },
  // { id: 'streaming', ... }  — старт от КИНОРЕКИ, после одобрения прототипа
  // { id: 'tickets', ... }    — старт от БИЛЕТВИЛЯ, после одобрения прототипа
];

export const assetById = (id) => START_ASSETS.find((a) => a.id === id) ?? START_ASSETS[0];

// ============================================================================
// Вертикали экспансии. В прототипе играбельно такси; самокаты и е-ком
// показаны карточками «фаза 2» — их модель появится после одобрения.
// ============================================================================

export const VERTICALS = [
  {
    id: 'taxi',
    icon: '🚕',
    name: { ru: 'Такси «Новоград.Драйв»', en: 'Novograd.Drive taxi' },
    hint: {
      ru: 'Самый большой смежный рынок города. Но в нём уже десять лет живёт «СитиДрайв»: часть города не отдаст никогда, а на ваш вход ответит демпингом.',
      en: 'The city’s largest adjacent market. But CityDrive has run it for a decade: part of the city will never switch, and your entry will be answered with a price war.',
    },
    potential: 430_000,      // взрослые, пользующиеся агрегаторами такси
    incumbentName: { ru: 'СитиДрайв', en: 'CityDrive' },
    incumbentLock: 0.35,     // доля рынка, запертая у конкурента
    launchCost: 60_000_000,  // лицензии, приложение, запуск парка
    fixedMonthly: 6_000_000, // офис вертикали, колл-центр, диспетчеризация
    tripsPerUser: 6.5,       // поездок в месяц у активного клиента
    fare: 260,               // средний чек поездки, ₽
    takeRate: 0.22,          // комиссия платформы с поездки
    // Ворота совета: диверсификацию согласуют, когда увидят, что стартовый
    // актив управляем — квартал истории и положительный вклад еды.
    gate: { minMonth: 5, assetContributionMonths: 3 },
    // Ответ хозяина рынка: конечная промо-война после вашего входа
    warMonths: 9,
    warAcqCut: 0.45,         // демпинг перехватывает часть вашего притока
    warFareCut: 0.15,        // и продавливает цены рынка вниз
  },
];

// Витрина будущих фаз: карточки видны, модель появится после одобрения.
export const FUTURE_VERTICALS = [
  {
    id: 'scooters',
    icon: '🛴',
    name: { ru: 'Самокаты', en: 'Scooters' },
    hint: {
      ru: 'Фаза 2: короткие поездки, сезонность, парк как капитал.',
      en: 'Phase 2: short rides, seasonality, the fleet as capital.',
    },
  },
  {
    id: 'ecom',
    icon: '📦',
    name: { ru: 'Е-ком и дарксторы', en: 'E-commerce and dark stores' },
    hint: {
      ru: 'Фаза 2: у доставки еды здесь лучшая синергия — общая курьерская логистика.',
      en: 'Phase 2: food delivery’s best synergy — shared courier logistics.',
    },
  },
  {
    id: 'plus',
    icon: '➕',
    name: { ru: 'Подписка «Новоград Plus»', en: 'Novograd Plus subscription' },
    hint: {
      ru: 'Фаза 3: покупка удержания за маржу — дилемма Amazon Prime.',
      en: 'Phase 3: buying retention with margin — the Amazon Prime dilemma.',
    },
  },
];

export const verticalById = (id) => VERTICALS.find((v) => v.id === id);

// ============================================================================
// Рычаги управления — портфельный уровень. Их нарочно мало: холдинг управляет
// агрегатами, микроменеджмент остался в исходных играх.
// ============================================================================

export const LEVER_GROUPS = [
  { id: 'holding', label: { ru: 'Холдинг', en: 'Holding' }, open: true },
  { id: 'food', label: { ru: 'Доставка еды · стартовый актив', en: 'Food delivery · starting asset' }, open: true },
  { id: 'taxi', label: { ru: 'Такси', en: 'Taxi' }, open: true },
];

export const LEVERS = [
  {
    key: 'crossSell',
    group: 'holding',
    label: { ru: 'Кросс-селл между сервисами', en: 'Cross-sell between services' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 25_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Промо своих сервисов внутри своих же приложений: клиент доставки видит предложение такси. В разы дешевле холодного привлечения, но у канала есть ёмкость — и он не спасает мёртвый продукт: конверсия зависит от качества принимающей вертикали.',
      en: 'Promoting your own services inside your own apps: a delivery customer sees a taxi offer. Far cheaper than cold acquisition, but the channel has finite capacity — and it cannot save a dead product: conversion depends on the receiving side’s quality.',
    },
  },
  {
    key: 'mgmt',
    group: 'holding',
    label: { ru: 'Управляющая компания', en: 'Management company' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 15_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Каждая новая вертикаль размывает фокус менеджмента — исполнение проседает во ВСЕХ сервисах сразу. Сильная управляющая компания выкупает этот штраф. Пока вертикаль одна, она почти не нужна.',
      en: 'Every added vertical dilutes management focus — execution sags across ALL services at once. A strong management company buys that penalty back. With a single vertical you barely need it.',
    },
  },
  {
    key: 'foodTake',
    group: 'food',
    label: { ru: 'Монетизация доставки', en: 'Delivery monetisation' },
    unit: { ru: '%', en: '%' },
    min: 80, max: 130, step: 1, def: 100, scale: 0.01,
    tip: {
      ru: 'Насколько жёстко доить насыщенный актив: комиссии, сборы, реклама в приложении. Выше 100% — выручка с клиента растёт, но отток ускоряется, а за порогом ~115% клиенты уходят к конкуренту ускоренно. Дожатая корова хуже кормит и кросс-селл: уходящие уносят с собой будущих клиентов такси.',
      en: 'How hard to milk the saturated asset: fees, commissions, in-app ads. Above 100%, revenue per customer rises but churn accelerates — and past ~115% customers flee outright. An over-milked cow also starves your cross-sell: leavers take your future taxi customers with them.',
    },
  },
  {
    key: 'foodOps',
    group: 'food',
    label: { ru: 'Сервис и удержание еды', en: 'Food service and retention' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 12_000_000, step: 500_000, def: 4_000_000,
    tip: {
      ru: 'Качество исполнения: скорость, споры, ассортимент. В насыщенном рынке удержание — единственный настоящий рост: вернуть нечем, не потерять — можно.',
      en: 'Execution quality: speed, disputes, selection. In a saturated market retention is the only real growth: you cannot re-acquire the city, but you can stop losing it.',
    },
  },
  {
    key: 'foodMarketing',
    group: 'food',
    label: { ru: 'Возврат ушедших клиентов', en: 'Customer win-back' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 15_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Маркетинг насыщенного рынка: новых клиентов в городе нет, но ушедшие ещё помнят сервис. Пул возврата конечен и тает — заливать его деньгами бесполезно, это не рычаг роста, а ремонт удержания.',
      en: 'Marketing in a saturated market: there are no new customers in the city, but recent leavers still remember you. The win-back pool is finite and decaying — flooding it with money is not growth, it is repairing retention.',
    },
  },
  {
    key: 'taxiPrice',
    group: 'taxi',
    label: { ru: 'Тариф такси', en: 'Taxi fares' },
    unit: { ru: '%', en: '%' },
    min: 85, max: 125, step: 1, def: 100, scale: 0.01,
    tip: {
      ru: 'Цена относительно рынка. Дешевле — быстрее набираете клиентов и злите юнит-экономику; дороже — маржа сейчас, рост потом. Во время войны с «СитиДрайвом» рынок продавлен демпингом, и высокий тариф бьёт больнее.',
      en: 'Price versus the market. Cheaper grows the base faster and hurts unit economics; dearer means margin now, growth later. During the CityDrive war the market is dumped down, and a high fare hurts twice as much.',
    },
  },
  {
    key: 'taxiSupply',
    group: 'taxi',
    label: { ru: 'Привлечение водителей', en: 'Driver acquisition' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 20_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Онбординг и бонусы водителям. Мало водителей — долгая подача и отток клиентов; много — водители простаивают, не зарабатывают и уходят сами. Мощность надо вести за спросом, а не впереди него.',
      en: 'Driver onboarding and bonuses. Too few drivers means long pickups and customer churn; too many means idle drivers who earn nothing and quit. Capacity should follow demand, not run ahead of it.',
    },
  },
  {
    key: 'taxiMarketing',
    group: 'taxi',
    label: { ru: 'Маркетинг такси', en: 'Taxi marketing' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 25_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Холодное привлечение на конкурентном рынке: дорого, но масштабируемо и приводит новых для холдинга людей — будущий пул кросс-селла в обе стороны. Сравнивайте цену клиента с кросс-селлом в отчёте.',
      en: 'Cold acquisition in a contested market: expensive, but scalable — and it brings people new to the holding, feeding the cross-sell pool both ways. Compare cost per customer with cross-sell in the report.',
    },
  },
];

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  verticals: [],   // какие вертикали игрок решил запустить (например ['taxi'])
};

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
