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

import { difficultyById } from '../../../../shared/difficulty.js';

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

  // --- Подписка «Новоград Plus» ---
  // Дилемма Amazon Prime: подписка сама по себе почти не зарабатывает —
  // выгоды подписчику стоят примерно столько же, сколько он платит.
  // Окупается она частотой и удержанием во всех вертикалях сразу.
  plus: {
    launchCost: 40_000_000,      // разработка, биллинг, запуск
    minVerticals: 2,             // подписке нужно, что склеивать
    perkCostPerSub: 260,         // кешбэки и бесплатные доставки, ₽/мес на подписчика
    baseConvShare: 0.06,         // доля мульти-клиентов, готовых подписаться за месяц
    baseChurn: 0.06,             // месячный отток подписчиков
    priceRef: 299,               // нейтральная цена
    priceElasticity: 1.6,        // конверсия падает с ценой
    churnReliefMax: 0.25,        // доп. усиление экосистемного удержания при полном покрытии
    freqBoostFood: 0.12,         // прибавка частоты еды у подписчиков
    freqBoostTaxi: 0.15,         // прибавка поездок у подписчиков
    multiple: { base: 2.5, growthWeight: 4, marginWeight: 2, marginPenalty: 1, min: 0.5, max: 8 },
  },

  // --- Пост-эндгейм: «год конгломерата» ---
  // Партия зачтена, счёт заморожен — дальше играют не за оценку, а за зрелость.
  // Главное правило акта: чужих денег больше нет. Три года экспансия жила на
  // раунды; теперь холдинг обязан держаться сам, и все привычные ходы
  // («залить маркетингом», «поднять ещё раунд») закрыты.
  endless: {
    months: 12,              // ещё один год после финала
    multiShareTarget: 0.38,  // склейка: доля клиентов двух и более сервисов
    // Рост холдинга за год — но уже без чужих денег. Замер: сильная сборка
    // даёт ~12% за год, средняя ~10%, слабая ~7.5%; прибыльность к этому
    // моменту есть у всех и планкой быть перестала.
    growthTarget: 0.11,
  },

  // --- Перенос финала игры-источника ---
  // В НОВОГРАД переходят не только «да/нет», но и числа: касса победившей
  // компании и её оценка. Масштаб — отношение вашего счёта к «крепкому»
  // порогу той игры (1.0 — крепкая победа). Сверху срезано: правило набора —
  // заслуженный вход даёт преимущество, а не победу. Размер замерен.
  legacyCarry: {
    cashPerRatio: 0.02,   // +2% к стартовой казне за каждую «крепкую победу» сверх первой
    cashCap: 0.05,        // но не больше +5%
    // Наследие — фора на старте, а не рента на всю партию. Льготы по
    // абоненткам действуют первый год: снятая навсегда абонентка давала
    // +11.5% к итогу (замер), потому что экономия компаундится 36 месяцев.
    graceMonths: 12,
    cinemaFeeMult: 0.5,   // лицензия кино в льготный период
    ticketsFeeMult: 0.4,  // партнёрство по билетам в льготный период
    roundPerRatio: 0.015, // репутация: раунд оценивают выше, доля тает медленнее
    roundCap: 0.03,
    floorPerRatio: 0.08,  // и пол оценки в раунде выше
    floorCap: 0.15,
  },

  // --- Антимонопольное дело (кризис середины партии) ---
  // Три исхода платятся разными валютами: структурой (отделённая логистика),
  // продуктом (открытая подписка) или деньгами и временем (суд). Цены
  // подобраны замером: ни один исход не берётся во всех прогонах.
  antitrust: {
    legalMonthly: 10_000_000,   // юристы и внешние консультанты, ₽/мес
    legalCrossMult: 0.85,       // внимание прессы: пока идёт дело, кросс-селл хуже
    // Отделённая логистика: е-ком покупает доставку по рынку — это минус
    // маржа у всех, а не только у владельца курьерской сети
    ecomMarginCut: 0.05,
    // Надзор после суда: согласия на связывание аккаунтов собираются строже
    supervisionReachMult: 0.92,
  },

  // --- Партнёрские вертикали (кино и билеты входят лицензиями, не играми) ---
  partners: {
    cinemaLicenseMonthly: 4_000_000,  // лицензия стриминга в подписку
    cinemaConvBoost: 0.45,            // конверсия в Plus выше: есть за что платить
    cinemaChurnRelief: 0.018,         // и отток подписчиков ниже
    ticketsMonthly: 2_500_000,        // партнёрство с билетным сервисом
    ticketsArpuPerMulti: 25,          // событийная выручка на мульти-клиента, ₽/мес
  },

  // --- Финансовая команда ---
  // Единственный рычаг, который управляет не бизнесом, а тем, как бизнес
  // считают и показывают. Слабая финансовая служба стоит денег молча:
  // эквайринг по невыгодной ставке, комиссии, списания, штрафы, неразнесённая
  // административка — всё это живёт строкой «прочие расходы» и не спрашивает
  // разрешения. Сильная — режет эту строку, лучше упаковывает компанию к
  // раунду и делает оценку читаемой.
  finance: {
    // Цена команды считается долей выручки, а не абсолютом: финансовая
    // служба растёт вместе с компанией. Иначе рычаг живёт только у крупного
    // холдинга — замер это и показал: у билетного актива при фиксированной
    // цене команду не окупало ничто.
    saturationShare: 0.05,   // выручки в месяц до «половины» силы
    saturationFloor: 1_500_000,  // ниже этого команда не бывает даже у малыша
    // 3% выручки — та величина, при которой строка ощутима, но не убивает
    // дойную корову без единого решения: замер показал, что при 5% пассивная
    // партия («ничего не делаю») уходит в банкротство, а это ломает саму
    // предпосылку игры — вы начинаете с прибыльного насыщенного актива.
    miscRateBase: 0.030,     // прочие расходы без финансовой службы, доля выручки
    miscRateCut: 0.020,      // сколько снимает полная команда (остаётся 1.0%)
    roundGain: 0.25,         // насколько лучше упакована компания к раунду
    transparencyAt: 0.30,    // с этой силы видно, как собирается оценка
    adviceAt: 0.55,          // с этой — команда разбирает решения месяца
  },
};

// Уровни сложности живут в shared/difficulty.js: это настройка НАБОРА, а не
// одной игры. Здесь остаются только числа финансового блока — они у каждой
// игры свои, потому что и выручка, и маржа у них разные.

// ============================================================================
// Стартовые активы — «классы персонажа». Дескриптор сжимает победившую
// компанию исходной игры до портфельного уровня: агрегаты вместо
// микроменеджмента. Микроменеджмент остаётся в исходных играх.
//
// КОНТРАКТ ДЕСКРИПТОРА. Движок не знает, из какой игры пришёл актив, —
// он читает только эти поля. Новая игра-источник (как НОВОЕДА) встраивается
// записью здесь и ничем больше:
//   users/arpu/margin/fixedMonthly/baseChurn/returnPool/reachableCap —
//     агрегаты вертикали на старте;
//   synergy[verticalId]  — во сколько раз кросс-селл в эту вертикаль дешевле
//     эталона (курьеры, привычка платить, партнёрская сеть);
//   launchCostMult[verticalId] — скидка на запуск вертикали, где у актива
//     есть готовая инфраструктура (у доставки е-ком дешевле: курьеры и
//     дарксторы уже есть);
//   perks[] — именованные грани, которые механики будущих фаз читают по
//     ключу (подписка, партнёрства, логистика): новая игра приносит новую
//     грань как данные, а не как ветку в движке.
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
    // Короткое имя для строк, где полное встало бы в кавычки внутри кавычек
    short: { ru: 'доставка', en: 'delivery' },
    hint: {
      ru: 'Вы выиграли рынок доставки еды Новограда. Рынок насыщен: расти числом клиентов больше некуда, город ваш. Дальше — расти выручкой с клиента.',
      en: 'You won Novograd’s food delivery market. It is saturated: there is no one left to acquire — the city is yours. From here, growth means revenue per customer.',
    },
    // Агрегаты портфельного уровня
    users: 210_000,          // активная база клиентов
    arpu: 290,               // выручка платформы на клиента, ₽/мес
    margin: 0.38,            // вклад вертикали (доля выручки платформы)
    fixedMonthly: 9_000_000, // фикс вертикали: районные операции, дарксторы, офис
    startCash: 220_000_000,  // казна победителя своего рынка
    baseChurn: 0.018,        // месячный отток в насыщенном рынке
    returnPool: 30_000,      // недавно ушедшие — пул возврата
    reachableCap: 240_000,   // потолок базы: часть города к вам не придёт никогда
    // Профиль синергий: во сколько раз кросс-селл в целевую вертикаль
    // дешевле эталона. У доставки лучшая синергия — е-ком (курьеры уже
    // ездят по городу), у стриминга была бы подписка, у билетов — партнёрства.
    // Шкала вердиктов и порог «достойного финала» — свои у каждого актива:
    // замеренные оптимумы расходятся втрое (доставка 13.6, стриминг 13.7,
    // билеты 3.4 млрд), и общая шкала объявляла бы отличную партию за билеты
    // «скромным итогом». Пороги — доли от оптимума актива: 80% / 45% / 15%.
    // worthy (обратные бонусы и секретная концовка) равен «крепкому» порогу.
    grades: { excellent: 9.5e9, solid: 5.5e9, survived: 1.8e9, worthy: 5.5e9 },
    synergy: { taxi: 1.0, scooters: 1.1, ecom: 1.5, subscription: 0.9 },
    // Готовая инфраструктура удешевляет запуск родственной вертикали
    launchCostMult: { taxi: 1.0, scooters: 0.9, ecom: 0.6 },
    // Грани актива для механик будущих фаз (общая логистика еды и е-кома)
    perks: ['courier-logistics'],
    synergyNote: {
      ru: 'Сильная сторона доставки: собственная курьерская логистика. Дешевле всего ей даётся е-ком (фаза 2) — курьеры уже ездят по городу.',
      en: 'Delivery’s edge is its own courier logistics. Its cheapest synergy is e-commerce (phase 2): the couriers already criss-cross the city.',
    },
  },
  {
    id: 'streaming',
    icon: '🎬',
    fromGame: { ru: 'КИНОРЕКА', en: 'KINOREKA' },
    name: { ru: 'Стриминг «Кинорека»', en: 'Kinoreka streaming' },
    short: { ru: 'стриминг', en: 'streaming' },
    hint: {
      ru: 'Вы выиграли рынок стриминга. База меньше, чем у доставки, зато подписная: высокая маржа, низкий отток — и привычка платить каждый месяц.',
      en: 'You won the streaming market. The base is smaller than delivery’s but subscription-based: high margin, low churn — and a habit of paying monthly.',
    },
    users: 150_000,
    arpu: 330,
    margin: 0.52,
    fixedMonthly: 7_000_000,
    startCash: 200_000_000,
    baseChurn: 0.016,
    returnPool: 18_000,
    reachableCap: 175_000,
    // Форма экосистемы другая: дешёвая синергия — подписка, а не логистика
    grades: { excellent: 10e9, solid: 5.7e9, survived: 1.9e9, worthy: 5.7e9 },
    synergy: { taxi: 0.85, scooters: 0.9, ecom: 0.85, subscription: 1.5 },
    launchCostMult: { taxi: 1.0, scooters: 1.0, ecom: 1.0 },
    // Привычка платить: Plus дешевле в запуске и конвертит лучше.
    // Свой контент: лицензия кино не нужна — она уже ваша.
    perks: ['subscription-habit', 'own-content'],
    synergyNote: {
      ru: 'Сильная сторона стриминга: привычка платить по подписке. «Новоград Plus» запускается дешевле и конвертит лучше, а лицензия кино не нужна — контент свой.',
      en: 'Streaming’s edge is the habit of paying monthly. Novograd Plus launches cheaper and converts better, and no cinema licence is needed — the content is yours.',
    },
  },
  {
    id: 'tickets',
    icon: '🎟️',
    fromGame: { ru: 'БИЛЕТВИЛЬ', en: 'BILETVILLE' },
    name: { ru: 'Билетный сервис «Билетвиль»', en: 'Biletville ticketing' },
    short: { ru: 'билеты', en: 'ticketing' },
    hint: {
      ru: 'Вы выиграли рынок билетов. Самая маленькая база и казна из трёх стартов — зато партнёрская сеть организаторов, через которую дешевеет любое привлечение. Сложный класс.',
      en: 'You won the ticketing market. The smallest base and treasury of the three starts — but a partner network of organisers that makes all acquisition cheaper. Hard mode.',
    },
    users: 95_000,
    arpu: 190,
    margin: 0.42,
    fixedMonthly: 4_000_000,
    baseChurn: 0.022,
    returnPool: 14_000,
    reachableCap: 125_000,
    startCash: 160_000_000,
    grades: { excellent: 2.7e9, solid: 1.5e9, survived: 0.5e9, worthy: 1.5e9 },
    synergy: { taxi: 1.1, scooters: 1.0, ecom: 1.0, subscription: 0.9 },
    launchCostMult: { taxi: 1.0, scooters: 1.0, ecom: 1.0 },
    // Партнёрская сеть: афиши и кассы города — дешёвый канал привлечения,
    // а партнёрство с билетами уже в кармане (это вы и есть)
    perks: ['partner-network', 'own-tickets'],
    synergyNote: {
      ru: 'Сильная сторона билетов: партнёрская сеть организаторов. Кросс-селл дешевле через афиши, а партнёрство по билетам не нужно — оно уже ваше.',
      en: 'Ticketing’s edge is the organiser partner network. Cross-sell is cheaper through listings, and no ticketing partnership is needed — it is already yours.',
    },
  },
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
    name: { ru: 'Такси «Новоград»', en: 'Novograd taxi' },
    hint: {
      ru: 'Самый большой смежный рынок города. Но в нём уже десять лет живёт «Таксоград»: часть города не отдаст никогда, а на ваш вход ответит демпингом.',
      en: 'The city’s largest adjacent market. But Taxograd has run it for a decade: part of the city will never switch, and your entry will be answered with a price war.',
    },
    potential: 430_000,      // взрослые, пользующиеся агрегаторами такси
    incumbentName: { ru: 'Таксоград', en: 'Taxograd' },
    incumbentLock: 0.35,     // доля рынка, запертая у конкурента
    launchCost: 60_000_000,  // лицензии, приложение, запуск парка
    fixedMonthly: 6_000_000, // офис вертикали, колл-центр, диспетчеризация
    tripsPerUser: 6.5,       // поездок в месяц у активного клиента
    fare: 260,               // средний чек поездки, ₽
    takeRate: 0.22,          // комиссия платформы с поездки
    // Ворот у такси нет: вы — победитель своего рынка, совет доверяет,
    // и вопрос первых ходов — «что запускаем», а не «когда разрешат».
    // Механика ворот (minMonth + прибыльность актива) остаётся в движке:
    // вертикали следующих фаз (е-ком, подписка) выйдут за ними.
    gate: { minMonth: 1, assetContributionMonths: 0 },
    // Ответ хозяина рынка: конечная промо-война после вашего входа
    warMonths: 9,
    warAcqCut: 0.45,         // демпинг перехватывает часть вашего притока
    warFareCut: 0.15,        // и продавливает цены рынка вниз
  },
  {
    id: 'ecom',
    icon: '📦',
    name: { ru: 'Маркет «Новоград»', en: 'Novograd market' },
    hint: {
      ru: 'Е-ком и дарксторы: у доставки еды здесь лучшая синергия — курьеры уже ездят по городу и возят посылки в непик. Но рынок наполовину заперт федеральными маркетплейсами.',
      en: 'E-commerce and dark stores: food delivery’s best synergy — the couriers already roam the city and carry parcels off-peak. But half the market is locked by national marketplaces.',
    },
    potential: 380_000,
    incumbentName: { ru: 'федеральные маркетплейсы', en: 'national marketplaces' },
    incumbentLock: 0.45,
    launchCost: 80_000_000,   // дарксторы, ассортимент, склад
    fixedMonthly: 6_000_000,
    // Портфельная модель как у еды: выручка на клиента и маржа.
    // Числа подняты после первого замера: спуск выключал е-ком — третья
    // нога не окупала фикс, и «третья вертикаль» была мёртвой механикой.
    arpu: 385,
    margin: 0.34,
    baseChurn: 0.042,
    churnQuality: 0.08,
    marketingSaturation: 15_000_000,
    marketingReach: 0.09,
    crossReach: 0.065,        // доля пула хаба, готовая попробовать за месяц
    // Ворота по метрикам, как гео-экспансия в НОВОЕДЕ: совет согласует
    // третью вертикаль при управляемом стартовом активе
    gate: { minMonth: 8, assetContributionMonths: 3 },
    // Перк 'courier-logistics' стартового актива: маржа выше (общая
    // логистика), но переиспользование мощности имеет цену — пиковые
    // конфликты бьют по качеству еды (см. engine)
    logisticsMarginBonus: 0.08,
    logisticsPeakPenalty: 0.04,
    // --- Мощность логистики: главный рычаг е-кома ---
    // Замер показал мёртвую механику: при любом месяце запуска е-ком
    // проигрывал «не запускать» — вклад с клиента (385 ₽ × 34% ≈ 131 ₽)
    // не окупал ни фикс, ни размытие фокуса третьей вертикалью. Причина
    // была не в числах, а в отсутствии решения: у е-кома не было рычага,
    // которым его чинят в жизни, — склады, машины, слоты доставки.
    logisticsSaturation: 6_000_000,  // бюджет половины эффекта
    logisticsArpuGain: 0.30,   // быстрые слоты и полки — крупнее и чаще корзина
    logisticsChurnCut: 0.018,  // привезли вовремя — клиент остался
    logisticsCrossGain: 0.40,  // готовность базы попробовать посылки
    logisticsMarginGain: 0.05, // масштаб склада: своя мощность дешевле подряда
    // Общий парк курьеров конечен: чем больше мощности уходит в посылки,
    // тем хуже пики у стартового актива. Только для курьерского актива.
    logisticsHubPenalty: 0.10,
    // --- Модель торговли: свой склад (1P) против площадки (3P) ---
    // Второе решение е-кома, и оно не про деньги, а про то, чей товар вы
    // продаёте. Свой склад: весь чек — ваша выручка, но маржа товарная и
    // каждый новый клиент замораживает оборотный капитал. Площадка: выручка
    // только комиссионная, зато маржа комиссии высокая, склад чужой, а
    // ассортимент приносят продавцы — быстрее и без капитала. Цена площадки
    // в том, что качество чужого продавца вы не контролируете.
    // Числа откалиброваны так, что «свой склад» = прежняя модель е-кома.
    ownArpuBase: 0.44,        // доля чека, видимая как выручка у чистой площадки
    ownArpuGain: 0.56,        // ...и добор до полного чека у своего склада
    ownMarginBase: 0.66,      // маржа комиссии площадки
    ownMarginCut: 0.32,       // ...против товарной маржи своего склада (0.34)
    // Склады — это и есть фикс е-кома: у площадки его почти нет. Отсюда
    // перелом: площадка выгоднее, пока база мала, свой склад — когда объём
    // вырос настолько, что товарная маржа перекрывает содержание складов.
    ownFixedBase: 0.55,       // доля фикса у чистой площадки
    ownFixedGain: 0.45,       // ...и добор до полного у своего склада
    platformAttractGain: 0.30, // чужие продавцы наполняют витрину быстрее
    platformChurnAdd: 0.012,   // и роняют качество, которого вы не видите
    workingCapitalPerUser: 900, // ₽ оборотного капитала на нового клиента 1P
  },
];

// Витрина будущих фаз: карточки видны, модель появится после одобрения.
export const FUTURE_VERTICALS = [
  {
    id: 'scooters',
    icon: '🛴',
    name: { ru: 'Самокаты', en: 'Scooters' },
    hint: {
      ru: 'Следующая фаза: короткие поездки, сезонность, парк как капитал.',
      en: 'Next phase: short rides, seasonality, the fleet as capital.',
    },
  },
];

export const verticalById = (id) => VERTICALS.find((v) => v.id === id);

// ============================================================================
// Рычаги управления — портфельный уровень. Их нарочно мало: холдинг управляет
// агрегатами, микроменеджмент остался в исходных играх.
// ============================================================================

export const LEVER_GROUPS = [
  {
    id: 'food',
    icon: '🛵',
    label: { ru: 'Стартовый актив — дойная корова', en: 'Starting asset — the cash cow' },
    desc: {
      ru: 'Насыщенный стартовый актив. Здесь не растут — здесь решают, сколько доить и сколько тратить на удержание.',
      en: 'The saturated starting asset. You do not grow here — you decide how hard to milk it and how much to spend on retention.',
    },
    open: true,
  },
  {
    id: 'taxi',
    icon: '🚕',
    label: { ru: 'Такси — вторая нога', en: 'Taxi — the second leg' },
    desc: {
      ru: 'Растущая вертикаль: цена поездки, мощность парка и холодное привлечение. Мощность ведут за спросом.',
      en: 'The growth vertical: fares, fleet capacity and cold acquisition. Capacity follows demand.',
    },
    open: true,
  },
  {
    id: 'ecom',
    icon: '📦',
    label: { ru: 'Е-ком — третья нога', en: 'E-commerce — the third leg' },
    desc: {
      ru: 'Дарксторы и посылки против федеральных маркетплейсов. Живёт кросс-селлом из вашей базы и общей логистикой.',
      en: 'Dark stores and parcels against national marketplaces. Lives off cross-sell from your base and shared logistics.',
    },
    open: true,
  },
  {
    id: 'holding',
    icon: '🏙️',
    label: { ru: 'Экосистема — склейка', en: 'Ecosystem — the glue' },
    desc: {
      ru: 'То, что превращает набор бизнесов в холдинг: кросс-селл по общей базе, подписка Plus и управляющая компания против размытого фокуса.',
      en: 'What turns a set of businesses into a holding: cross-sell across the shared base, the Plus subscription, and the management company against diluted focus.',
    },
    open: true,
  },
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
    key: 'finance',
    group: 'holding',
    label: { ru: 'Финансовая команда', en: 'Finance team' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 20_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Казначейство, контроль расходов, подготовка к раундам. Слабая финансовая служба стоит денег молча: эквайринг по невыгодной ставке, комиссии, списания, штрафы — всё это уходит в «прочие расходы» и не спрашивает разрешения. Сильная режет эту строку, лучше упаковывает холдинг к раунду и объясняет, из чего собирается ваша оценка.',
      en: 'Treasury, cost control, preparing for funding rounds. A weak finance function costs money silently: unfavourable card-processing rates, commissions, write-offs, penalties — all of it lands in “miscellaneous” and never asks permission. A strong one cuts that line, packages the holding better for a round, and explains what your valuation is actually built from.',
    },
  },
  {
    key: 'foodTake',
    group: 'food',
    label: { ru: 'Монетизация актива', en: 'Asset monetisation' },
    unit: { ru: '%', en: '%' },
    min: 80, max: 130, step: 1, def: 100, scale: 0.01,
    // Политика, а не настройка: пять режимов вместо ползунка. Это решение
    // уровня совета директоров — у него должны быть имена, а не проценты.
    policy: [
      { v: 90, label: { ru: 'Щадящая', en: 'Gentle' },
        note: { ru: 'Комиссии ниже привычного: частота растёт, база бережётся — но вы недобираете выручку.', en: 'Fees below the norm: frequency grows and the base is preserved — but you leave revenue behind.' } },
      { v: 100, label: { ru: 'Рыночная', en: 'Market' },
        note: { ru: 'Монетизация как все: клиенты не замечают вас в чеке.', en: 'Monetisation like everyone else: customers do not notice you in the bill.' } },
      { v: 105, label: { ru: 'Плотная', en: 'Firm' },
        note: { ru: 'Чуть выше рынка: выручка растёт, отток ускоряется едва заметно.', en: 'A notch above market: revenue up, churn barely faster.' } },
      { v: 115, label: { ru: 'Дожим', en: 'Milking' },
        note: { ru: 'На пороге терпения: деньги сейчас, ускоренный отток — и тающий пул кросс-селла.', en: 'At the tolerance threshold: money now, faster churn — and a thinning cross-sell pool.' } },
      { v: 128, label: { ru: 'Выжать всё', en: 'Squeeze dry' },
        note: { ru: 'За порогом: клиенты бегут к конкуренту. Стратегия одного года, не трёх.', en: 'Past the threshold: customers flee to the competitor. A one-year strategy, not a three-year one.' } },
    ],
    tip: {
      ru: 'Насколько жёстко доить насыщенный актив: комиссии, сборы, реклама в приложении. Дожатая корова хуже кормит и кросс-селл: уходящие уносят с собой будущих клиентов такси.',
      en: 'How hard to milk the saturated asset: fees, commissions, in-app ads. An over-milked cow also starves your cross-sell: leavers take your future taxi customers with them.',
    },
  },
  {
    key: 'foodOps',
    group: 'food',
    label: { ru: 'Сервис и удержание', en: 'Service and retention' },
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
    label: { ru: 'Тарифная политика такси', en: 'Taxi fare policy' },
    unit: { ru: '%', en: '%' },
    min: 85, max: 125, step: 1, def: 100, scale: 0.01,
    policy: [
      { v: 88, label: { ru: 'Демпинг', en: 'Dumping' },
        note: { ru: 'Часть каждой поездки субсидируете вы: покупаете рост, сжигая маржу.', en: 'You subsidise part of every ride: buying growth by burning margin.' } },
      { v: 95, label: { ru: 'Ниже рынка', en: 'Below market' },
        note: { ru: 'Заметно дешевле «Таксограда»: рост быстрее, вклад с поездки тоньше.', en: 'Visibly cheaper than Taxograd: faster growth, thinner per-trip contribution.' } },
      { v: 100, label: { ru: 'Рынок', en: 'Market' },
        note: { ru: 'Цена как у всех: конкурируете сервисом и подачей, а не рублём.', en: 'Priced like everyone: you compete on service and pickup, not roubles.' } },
      { v: 108, label: { ru: 'Премиум', en: 'Premium' },
        note: { ru: 'Дороже рынка: маржа сейчас, спрос и рост — медленнее.', en: 'Above market: margin now, slower demand and growth.' } },
      { v: 120, label: { ru: 'Снять сливки', en: 'Skim' },
        note: { ru: 'Максимальная маржа с поездки, отток и торможение роста в подарок.', en: 'Maximum per-trip margin, with churn and stalled growth thrown in.' } },
    ],
    tip: {
      ru: 'Цена относительно рынка. Дешевле — быстрее набираете клиентов и злите юнит-экономику; дороже — маржа сейчас, рост потом. Во время войны рынок продавлен демпингом «Таксограда», и высокий тариф бьёт больнее.',
      en: 'Price versus the market. Cheaper grows the base faster and hurts unit economics; dearer means margin now, growth later. During the war the market is dumped down by Taxograd, and a high fare hurts twice as much.',
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
  {
    key: 'ecomOps',
    group: 'ecom',
    label: { ru: 'Ассортимент и обработка заказов', en: 'Range and order handling' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 12_000_000, step: 500_000, def: 3_000_000,
    tip: {
      ru: 'Качество е-кома: глубина ассортимента, сроки, возвраты. Против федеральных маркетплейсов удержание — единственная защита: их ассортимент вам не переплюнуть.',
      en: 'E-commerce quality: range depth, delivery times, returns. Against national marketplaces retention is your only defence — you will not out-range them.',
    },
  },
  {
    key: 'ecomOwnShare',
    group: 'ecom',
    label: { ru: 'Модель торговли', en: 'Trading model' },
    unit: { ru: '%', en: '%' },
    min: 0, max: 100, step: 50, def: 100, scale: 0.01,
    policy: [
      { v: 0, label: { ru: 'Площадка', en: 'Marketplace' },
        note: { ru: 'Товар чужой: вы берёте комиссию. Капитала не нужно, ассортимент наполняют продавцы — зато качество их работы вы не контролируете.', en: 'The goods are not yours: you take a commission. No capital needed and sellers fill the catalogue — but you do not control the quality of their work.' } },
      { v: 50, label: { ru: 'Смешанная', en: 'Mixed' },
        note: { ru: 'Ходовое — своё, длинный хвост — от продавцов. Половина капитала, половина контроля.', en: 'Fast movers in-house, the long tail from sellers. Half the capital, half the control.' } },
      { v: 100, label: { ru: 'Свой склад', en: 'Own inventory' },
        note: { ru: 'Товар ваш: весь чек — ваша выручка, но маржа товарная, а каждый новый клиент замораживает оборотный капитал.', en: 'The goods are yours: the whole basket is your revenue, but the margin is a retail margin and every new customer freezes working capital.' } },
    ],
    tip: {
      ru: 'Чей товар вы продаёте. Свой склад даёт больше вклада с клиента, но требует денег заранее: закупленный товар лежит на складе до продажи. Площадка растёт без капитала и быстрее набирает ассортимент, но с чека вам достаётся только комиссия.',
      en: 'Whose goods you sell. Own inventory yields more contribution per customer but demands money upfront: purchased stock sits in the warehouse until sold. A marketplace grows without capital and builds range faster, but you only keep a commission on each basket.',
    },
  },
  {
    key: 'ecomLogistics',
    group: 'ecom',
    label: { ru: 'Мощность логистики', en: 'Logistics capacity' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 15_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Склады, машины, слоты доставки. Дорого и постоянно — зато привезли вовремя: корзина крупнее, отток ниже, база охотнее пробует посылки. У актива с собственными курьерами парк общий: мощность, ушедшая в посылки, снимается с пиков стартового сервиса.',
      en: 'Warehouses, vans, delivery slots. Expensive and permanent — but on-time delivery means bigger baskets, lower churn and a base that is readier to try parcels. If your starting asset owns the couriers, the fleet is shared: capacity moved to parcels is taken off the peaks of the starting service.',
    },
  },
  {
    key: 'ecomMarketing',
    group: 'ecom',
    label: { ru: 'Маркетинг е-кома', en: 'E-commerce marketing' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 0, max: 25_000_000, step: 500_000, def: 0,
    tip: {
      ru: 'Холодное привлечение против маркетплейсов: дорого. Главный канал е-кома — кросс-селл из вашей же базы: сравнивайте цену клиента в отчёте.',
      en: 'Cold acquisition against the marketplaces: expensive. E-commerce’s main channel is cross-sell from your own base — compare cost per customer in the report.',
    },
  },
  {
    key: 'plusPrice',
    group: 'holding',
    label: { ru: 'Цена «Новоград Plus»', en: 'Novograd Plus price' },
    unit: { ru: '₽/мес', en: '₽/mo' },
    min: 199, max: 399, step: 100, def: 299, scale: 1,
    policy: [
      { v: 199, label: { ru: '199 ₽ — массовая', en: '₽199 — mass' },
        note: { ru: 'Подписка почти в убыток: выгоды стоят дороже цены. Ставка на массовость и удержание.', en: 'The subscription runs near a loss: perks cost more than the price. A bet on scale and retention.' } },
      { v: 299, label: { ru: '299 ₽ — базовая', en: '₽299 — standard' },
        note: { ru: 'Выгоды примерно окупаются: подписка зарабатывает на частоте и удержании, а не на цене.', en: 'Perks roughly break even: the subscription earns through frequency and retention, not price.' } },
      { v: 399, label: { ru: '399 ₽ — премиум', en: '₽399 — premium' },
        note: { ru: 'Подписка прибыльна сама по себе, но подписываются немногие — склейка растёт медленно.', en: 'Profitable on its own, but few subscribe — the glue grows slowly.' } },
    ],
    tip: {
      ru: 'Цена подписки против её массовости. Подписчик пользуется всеми сервисами чаще и уходит реже — Plus покупает удержание за маржу. Дилемма Amazon Prime.',
      en: 'Price versus reach. A subscriber uses every service more and churns less — Plus buys retention with margin. The Amazon Prime dilemma.',
    },
  },
];

export const DEFAULT_DECISIONS = {
  ...Object.fromEntries(LEVERS.map((l) => [l.key, l.def * (l.scale ?? 1)])),
  verticals: [],   // какие вертикали и сервисы запущены: 'taxi' | 'ecom' | 'plus'
  partners: [],    // включённые партнёрства: 'cinema' | 'tickets'
};

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
