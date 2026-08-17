// ============================================================================
// Случайные события. Каждое событие возвращает набор модификаторов на месяц.
// События с выбором — точки, где видна цена компромисса.
//
// Поштучные цены — правило всего набора игр: доплата «всем водителям» стоит
// по числу водителей, компенсация «всей базе» — по числу клиентов. Цена
// решения растёт вместе с компанией, поэтому верного для всех ответа нет.
//
// Тексты двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

import { weightedPick } from '../../../../shared/rng.js';

// Нейтральные модификаторы месяца
export function neutralModifiers() {
  return {
    foodDemandMult: 1,       // множитель выручки еды (спрос/частота)
    taxiDemandMult: 1,       // множитель спроса на поездки
    taxiCapacityMult: 1,     // множитель производительности парка
    foodChurnAdd: 0,         // прибавка к оттоку клиентов еды
    taxiChurnAdd: 0,         // прибавка к оттоку клиентов такси
    driverChurnAdd: 0,       // прибавка к оттоку водителей
    driverLossShare: 0,      // разовый уход доли парка (событие, а не ставка оттока)
    driverSupplyMult: 1,     // множитель притока водителей
    crossSellMult: 1,        // множитель конверсии кросс-селла
    costPerTripAdd: 0,       // прибавка к себестоимости поездки, ₽
    oneOffCost: 0,           // разовые расходы, ₽
    // Поштучные разовые расходы — цена зависит от вашего размера
    oneOffCostPerDriver: 0,
    oneOffCostPerFoodUser: 0,
    oneOffCostPerTaxiUser: 0,
    oneOffCostPerUniqueUser: 0,
    valuationBonus: 0,
    trustMonths: 0,          // месяцы подорванного доверия к экосистеме
    endWar: false,           // перемирие с хозяином рынка такси
    lockAdd: 0,              // закреплённая за конкурентом доля рынка растёт
    regulationRisk: false,
    // --- сюжетные повороты: эффекты длиной в несколько месяцев и навсегда ---
    fedMonths: 0,            // набег федеральной экосистемы: месяцы давления
    fedSoft: false,          // оборона выбрана: давление мягче
    crisisMonths: 0,         // экономический спад: месяцы слабого спроса
    crisisCut: false,        // расходы срезаны: дешевле, но исполнение страдает
    tripsPerUserAdd: 0,      // прибавка частоты поездок на срок контракта (аэропорт)
    crossCacMult: 1,         // постоянный множитель цены кросс-селла (кобренд)
    crossReachMult: 1,       // постоянный множитель ёмкости кросс-селла (кобренд)
    // Антимонопольное дело: три исхода расходятся навсегда и в разных валютах
    splitLogistics: false,   // логистика отделена: своя больше не возит дешевле рынка
    plusConvMult: 1,         // постоянный множитель конверсии в подписку
    plusChurnAdd: 0,         // постоянная прибавка к оттоку подписчиков
    ecoReliefCut: 0,         // ослабление экосистемного удержания навсегда
    legalMonths: 0,          // месяцы разбирательства: юристы каждый месяц
    supervisionOn: false,    // надзор за единым аккаунтом остаётся навсегда
    scootDemandMult: 1,      // множитель спроса на самокаты (погода)
    scootForceStreet: false, // парк выкатывается на улицу вопреки плану года
    notes: [],
  };
}

// needsTaxi: событие имеет смысл только при запущенном такси.
// needsWar: только пока идёт промо-война с «Таксоградом».
// once: сюжетное событие, случается не больше раза за партию.
//
// Замечание к аудиту доминации. «Капитальные» опции (аэропорт, кобренд,
// оборона от федеральной экосистемы) при замере политикой с автоматическими
// раундами выигрывают почти всегда: у такой политики деньги бесплатны, и
// любой положительный NPV доминирует по построению. Контрольный замер с
// дорогим капиталом (раунды только на грани смерти) даёт живой выбор:
// оборона 75/25, утечка 40/60, аэропорт после перевода на срочный контракт —
// ровно 15/30 со сменой знака по состояниям. Это и есть смысл этих событий:
// капитальное решение зависит от стоимости капитала, а не от таблички
// «правильных ответов». У аэропорта отдельная физика, знать про которую
// полезно при любой правке такси: +5% частоты запускают маховик предложения
// (загрузка выше -> водители реже простаивают -> парк растёт -> возят ещё
// больше), и выгода почти не зависит от размера прибавки — при дешёвых
// деньгах контракт, перекрывающий окно оценки, даёт +23..31% итога, а
// контракт, истёкший задолго до финала, только +2..3% (его честная касса).
export const EVENTS = [
  {
    id: 'fuel', weight: 6, minMonth: 3, needsTaxi: true,
    title: { ru: 'Топливо подорожало', en: 'Fuel prices jump' },
    text: {
      ru: 'Бензин вырос в цене — экономика поездки просела у всего рынка, водители требуют компенсаций.',
      en: 'Petrol prices are up: trip economics sagged across the market, and drivers are demanding compensation.',
    },
    effects: { costPerTripAdd: 9, driverChurnAdd: 0.02 },
    lesson: {
      ru: 'Инфляция издержек бьёт по марже мгновенно, а поднять тариф мешает конкурент.',
      en: 'Cost inflation hits margin instantly, while the competitor keeps you from raising fares.',
    },
  },
  {
    id: 'super_app_viral', weight: 5, minMonth: 4,
    title: { ru: 'Супер-апп хвалят в соцсетях', en: 'The super-app goes viral' },
    text: {
      ru: 'Популярный блогер показал, как в одном приложении заказывает такси и всё остальное. Бесплатное внимание к экосистеме.',
      en: 'A popular blogger showed off ordering a ride and everything else in one app. Free attention for the ecosystem.',
    },
    effects: { crossSellMult: 1.35, foodDemandMult: 1.03 },
    lesson: {
      ru: 'Органика снижает цену привлечения, но ей нельзя управлять — это не строка бюджета.',
      en: 'Organic reach lowers acquisition cost, but you cannot manage it — it is not a budget line.',
    },
  },

  // --- События с выбором ---
  {
    id: 'driver_strike', weight: 7, minMonth: 4, needsTaxi: true,
    title: { ru: 'Водители готовят забастовку', en: 'Drivers threaten to strike' },
    text: {
      ru: 'Чат водителей кипит: комиссия платформы съедает заработок, подача в спальные районы не окупается. Требуют разовую выплату.',
      en: 'The driver chat is boiling: the platform’s take eats their earnings and suburban pickups do not pay. They want a one-off payment.',
    },
    lesson: {
      ru: 'Труд в гиг-экономике — рынок, а не ресурс: цена предложения меняется быстрее ваших планов.',
      en: 'Gig labour is a market, not a resource: the price of supply moves faster than your plans.',
    },
    options: [
      {
        label: { ru: 'Выплатить (3 000 ₽ на водителя)', en: 'Pay up ($30 per driver)' },
        detail: {
          ru: 'Цена растёт со штатом: тысяче водителей — три миллиона, пяти тысячам — пятнадцать.',
          en: 'The price scales with the fleet: three million for a thousand drivers, fifteen for five thousand.',
        },
        effects: { oneOffCostPerDriver: 3_000, driverChurnAdd: -0.02, driverSupplyMult: 1.2 },
      },
      {
        label: { ru: 'Проигнорировать', en: 'Ignore it' },
        detail: {
          ru: 'Забастовка уводит почти треть парка разом. Дёшево, пока водителей избыток; дорого, когда каждая машина на счету.',
          en: 'The strike takes almost a third of the fleet at once. Cheap while drivers are plentiful; expensive when every car counts.',
        },
        effects: { driverLossShare: 0.29, taxiCapacityMult: 0.93 },
      },
    ],
  },
  {
    id: 'taxi_regulation', weight: 4, minMonth: 8, needsTaxi: true,
    title: { ru: 'Мэрия обсуждает закон о такси', en: 'City hall debates a taxi law' },
    text: {
      ru: 'Обсуждают обязательные лицензии и страхование водителей агрегаторов.',
      en: 'Mandatory licences and insurance for platform drivers are on the table.',
    },
    lesson: {
      ru: 'Стоимость соответствия регулированию бьёт по маленьким сильнее — это постоянная, а не переменная.',
      en: 'Compliance cost hits small players hardest — it is fixed, not variable.',
    },
    options: [
      {
        label: { ru: 'Лицензировать всех сейчас (2 500 ₽ на водителя)', en: 'License everyone now ($25 per driver)' },
        detail: {
          ru: 'Платите по сегодняшнему парку. Выгодно, если собираетесь расти.',
          en: 'You pay for today’s fleet. A good deal if you plan to grow.',
        },
        effects: { oneOffCostPerDriver: 2_500, driverChurnAdd: -0.015 },
      },
      {
        label: { ru: 'Ждать закона', en: 'Wait for the law' },
        detail: {
          ru: 'Экономим сейчас. Если штраф придёт — заплатите по парку на день штрафа, по двойной ставке.',
          en: 'Save now. If the fine lands, you pay for the fleet you have that day — at double the rate.',
        },
        effects: { regulationRisk: true },
      },
    ],
  },
  {
    id: 'cofounder', weight: 6, minMonth: 6, once: true,
    title: { ru: 'Сооснователь за долю', en: 'A co-founder for a stake' },
    text: {
      ru: 'К вам приходит операционный директор из компании, которая прошла этот путь до вас. Готов войти сооснователем и вести вертикали руками — но не за зарплату, а за 14% компании.',
      en: 'A COO from a company that has already walked this road comes to you. They are ready to join as a co-founder and run the verticals hands-on — not for a salary, but for 14% of the company.',
    },
    lesson: {
      ru: 'Доля отдаётся один раз и навсегда, а стоит она процента от всего, что вы построите потом. Сильный партнёр окупается только там, где расфокус реально дорог: на одной вертикали платить нечем.',
      en: 'A stake is given once and forever, and it costs a percentage of everything you build afterwards. A strong partner pays off only where the loss of focus is genuinely expensive: with a single vertical there is nothing to pay for.',
    },
    // Отказ стоит первым намеренно: доля отдаётся навсегда, и вариант «ничего
    // не менять» не должен оказываться тем, что нажимают не глядя.
    //
    // К аудиту доминации: в агрегате отказ побеждает 61/72 (85%), но это
    // контекстная зависимость, а не викторина. На одной вертикали отказ
    // выигрывает 36/36 — и ровно этому событие учит (см. lesson: «на одной
    // вертикали платить нечем»); на полной экосистеме выбор живой, 25/36.
    // Агрегат пересекает планку 80% из-за того, что один из контекстов имеет
    // известный ответ ЗАМЫСЛОМ — как у vanity_*, только ответ зависит от
    // формы холдинга, и его надо увидеть, а не вспомнить.
    options: [
      {
        label: { ru: 'Остаться единственным основателем', en: 'Stay the sole founder' },
        detail: {
          ru: 'Вся компания ваша. Расфокус придётся оплачивать управляющей компанией — деньгами, а не долей.',
          en: 'The whole company stays yours. The loss of focus will have to be paid for with the management budget — in cash, not equity.',
        },
        effects: {},
      },
      {
        label: { ru: 'Взять сооснователя (14% компании)', en: 'Take the co-founder (14% of the company)' },
        detail: {
          ru: 'Конгломератный штраф за расфокус падает на четверть до конца партии. Доля уходит сразу — и из итоговой оценки тоже.',
          en: 'The conglomerate focus penalty drops by a quarter for the rest of the game. The stake leaves immediately — and out of the final valuation too.',
        },
        effects: { cofounder: true },
      },
      {
        // Протокол «СКРЕПКА»: экономика — точная копия «остаться единственным
        // основателем», различие чисто сюжетное. Доли не просит — на то и шутка.
        secret: true,
        label: { ru: 'Взять сооснователем нейросеть «СКРЕПКА»', en: 'Take the PAPERCLIP neural network as co-founder' },
        detail: {
          ru: 'Доли не просит, зарплаты не просит, живёт в серверной. Вы остаётесь единственным основателем-человеком; расфокус по-прежнему ваш.',
          en: 'Asks for no stake, no salary, lives in the server room. You remain the only human founder; the loss of focus is still yours.',
        },
        effects: {},
      },
    ],
  },
  {
    id: 'data_leak', weight: 4, minMonth: 10,
    title: { ru: 'Утечка данных единого аккаунта', en: 'Unified account data leak' },
    text: {
      ru: 'Подрядчик слил часть базы единого логина — того самого, на котором держится кросс-селл. Пресса уже звонит.',
      en: 'A contractor leaked part of the single-login base — the very thing your cross-sell rests on. The press is already calling.',
    },
    lesson: {
      ru: 'Общая база — главный актив экосистемы и её главная уязвимость: доверие теряется на всех сервисах сразу.',
      en: 'The shared customer base is the ecosystem’s main asset and its main vulnerability: trust is lost across every service at once.',
    },
    options: [
      {
        // Цена поднята с 120 ₽ + 5 млн после аудита доминации: «признать»
        // побеждало в 100% состояний — при дешёвом извинении это викторина.
        label: { ru: 'Признать и компенсировать (380 ₽ на клиента базы)', en: 'Own it and compensate ($3.80 per customer)' },
        detail: {
          ru: 'Плюс 20 млн на аудит безопасности. Цена растёт с базой: чем лучше шёл кросс-селл, тем дороже извинение.',
          en: 'Plus $200K for a security audit. The price scales with the base: the better your cross-sell went, the dearer the apology.',
        },
        effects: { oneOffCostPerUniqueUser: 380, oneOffCost: 20_000_000 },
      },
      {
        label: { ru: 'Замять', en: 'Bury it' },
        detail: {
          ru: 'Бесплатно сегодня. Доверие к единому аккаунту падает: кросс-селл работает вполсилы несколько месяцев, отток выше.',
          en: 'Free today. Trust in the single account drops: cross-sell runs at half power for months, churn ticks up.',
        },
        effects: { trustMonths: 2, foodChurnAdd: 0.005, taxiChurnAdd: 0.005 },
      },
    ],
  },
  {
    id: 'truce_offer', weight: 8, minMonth: 6, needsWar: true,
    title: { ru: '«Таксоград» предлагает перемирие', en: 'Taxograd offers a truce' },
    text: {
      ru: 'Хозяин рынка такси устал жечь деньги и предлагает разойтись: он прекращает демпинг, вы не трогаете его корпоративных клиентов и аэропорт.',
      en: 'The incumbent is tired of burning money and offers a deal: they stop the predatory fares, you stay away from their corporate accounts and the airport.',
    },
    lesson: {
      ru: 'Ценовые войны кончаются переговорами. Вопрос лишь, кто к этому моменту потерял больше — и что отдал за мир.',
      en: 'Price wars end in negotiations. The only questions are who lost more by then — and what peace cost.',
    },
    options: [
      {
        label: { ru: 'Принять перемирие', en: 'Accept the truce' },
        detail: {
          ru: 'Война кончается сразу, но часть рынка закрепляется за конкурентом навсегда.',
          en: 'The war ends now, but part of the market is locked to the incumbent for good.',
        },
        // Снижено с 0.08 после аудита доминации: за 8% рынка перемирие
        // не брал никто и никогда («воевать дальше» побеждало в 100%),
        // на 0.04 — в 88%. При 0.03 выбор живой: 75/25 и зазор ~2%.
        effects: { endWar: true, lockAdd: 0.03 },
      },
      {
        label: { ru: 'Воевать дальше', en: 'Fight on' },
        detail: {
          ru: 'Демпинг продолжается до конца войны, но потолок рынка остаётся вашим.',
          en: 'The dumping continues to the end of the war, but the market ceiling stays yours.',
        },
        effects: {},
      },
    ],
  },
  {
    id: 'food_rival', weight: 6, minMonth: 5,
    title: { ru: 'Федеральный игрок пробует ваш рынок', en: 'A national player probes your market' },
    text: {
      ru: 'Столичный конкурент запустил в Новограде промокампанию против вашего стартового актива: насыщенный рынок перестал быть только вашим.',
      en: 'A national competitor has launched a promo push in Novograd against your starting asset: the saturated market is no longer only yours.',
    },
    lesson: {
      ru: 'Дойная корова тоже требует защиты: насыщенный рынок — это не рента, а позиция, которую держат.',
      en: 'Even a cash cow needs defending: a saturated market is not rent, it is a position you hold.',
    },
    options: [
      {
        // Поднято со 150 ₽ после аудита доминации (83% за этот вариант):
        // защита базы должна стоить настолько дорого, чтобы дожатой или
        // маленькой базе иногда было правильнее переждать.
        label: { ru: 'Ответное промо (220 ₽ на клиента хаба)', en: 'Counter-promo ($2.20 per hub customer)' },
        detail: {
          ru: 'Дорого при большой базе, но база и защищена: отток месяца почти не растёт.',
          en: 'Expensive with a large base — but the base is protected: churn barely moves.',
        },
        effects: { oneOffCostPerFoodUser: 220, foodDemandMult: 0.98 },
      },
      {
        label: { ru: 'Держать маржу', en: 'Hold your margin' },
        detail: {
          ru: 'Деньги целы, но часть клиентов уходит пробовать чужие скидки.',
          en: 'The money stays, but some customers leave to try the newcomer’s discounts.',
        },
        effects: { foodDemandMult: 0.94, foodChurnAdd: 0.014 },
      },
    ],
  },
  {
    id: 'invest_pressure', weight: 5, minMonth: 12, needsTaxi: true,
    title: { ru: 'Инвесторы требуют показать рост такси', en: 'Investors demand taxi growth' },
    text: {
      ru: 'Совет сравнивает вас с федеральными экосистемами и намекает на агрессивное промо в такси.',
      en: 'The board benchmarks you against national ecosystems and hints at aggressive taxi promos.',
    },
    lesson: {
      ru: 'Рост, купленный скидками, исчезает вместе со скидками. Проверьте удержание, а не GMV.',
      en: 'Growth bought with discounts disappears with the discounts. Check retention, not GMV.',
    },
    options: [
      {
        // Цена калибровалась дважды. Сначала 420 → 600: на поздних месяцах
        // ставка оценки перевешивала любую цену промо (12/12). Затем
        // сглаживание окна роста (windowGrowthStable) само убило позднюю
        // выгоду — инвестор перестал веритьOneMonth-бампу, и 600 стало
        // перелечено (2/24). На 400 ₽ выбор живой (8/24) и честно зависит
        // от срока: ранний бамп ещё разгоняет рост, поздний — уже нет.
        label: { ru: 'Залить промо (400 ₽ на клиента такси)', en: 'Flood promos ($4 per taxi customer)' },
        detail: {
          ru: 'Раздача по всей базе такси: маленькой базе почти бесплатно, большой — очень дорого.',
          en: 'A blast across the taxi base: nearly free when small, very dear when large.',
        },
        effects: { oneOffCostPerTaxiUser: 400, taxiDemandMult: 1.12, valuationBonus: 0.004 },
      },
      {
        label: { ru: 'Отстоять юнит-экономику', en: 'Defend the unit economics' },
        detail: {
          ru: 'Инвесторы недовольны, оценка ниже.',
          en: 'Investors are unhappy and the valuation suffers.',
        },
        effects: { valuationBonus: -0.004 },
      },
    ],
  },

  // --- Сюжетные повороты: случаются раз за партию и меняют рельеф игры ---
  {
    id: 'fed_ecosystem', weight: 9, minMonth: 14, once: true,
    title: { ru: 'Федеральная экосистема выходит в Новоград', en: 'A national ecosystem enters Novograd' },
    text: {
      ru: 'Столичный гигант открыл в городе сразу несколько сервисов — включая двойника вашего хаба и такси, с подпиской и рекламой на каждом углу. Ваш домашний рынок перестал быть только вашим.',
      en: 'A national giant has opened several services in the city at once — a twin of your hub and a taxi arm among them, with a subscription and ads on every corner. Your home market is no longer only yours.',
    },
    lesson: {
      ru: 'Экосистемы конкурируют с экосистемами. Защита — не цена, а склейка: клиента двух ваших сервисов переманить вдвое сложнее.',
      en: 'Ecosystems compete with ecosystems. The defence is not price but glue: a customer on two of your services is twice as hard to poach.',
    },
    options: [
      {
        label: { ru: 'Оборонительная кампания (340 ₽ на клиента базы)', en: 'Defensive campaign ($3.40 per customer)' },
        detail: {
          ru: 'Дорого по всей базе, но набег выдыхается вдвое быстрее и бьёт заметно слабее.',
          en: 'Expensive across the whole base, but the raid runs out of steam twice as fast and hits far softer.',
        },
        effects: { oneOffCostPerUniqueUser: 340, fedMonths: 4, fedSoft: true },
      },
      {
        label: { ru: 'Пережить набег', en: 'Ride out the raid' },
        detail: {
          ru: 'Бесплатно сейчас, но шесть месяцев дорогого привлечения и повышенного оттока в обеих вертикалях.',
          en: 'Free today — but six months of dear acquisition and higher churn in both verticals.',
        },
        effects: { fedMonths: 6 },
      },
    ],
  },
  {
    id: 'econ_crisis', weight: 7, minMonth: 16, once: true,
    title: { ru: 'Экономический спад', en: 'An economic downturn' },
    text: {
      ru: 'Реальные доходы горожан просели: заказывают реже, ездят экономнее. Рынок сжался на несколько месяцев — у всех.',
      en: 'Real incomes have sagged: people order less and ride cheaper. The market has shrunk for months — for everyone.',
    },
    lesson: {
      ru: 'Спад — проверка структуры расходов: переменные сжимаются сами, постоянные приходится резать руками — и у среза есть цена.',
      en: 'A downturn stress-tests your cost structure: variable costs shrink on their own, fixed ones must be cut by hand — and cuts have a price.',
    },
    options: [
      {
        label: { ru: 'Срезать постоянные расходы', en: 'Cut fixed costs' },
        detail: {
          ru: 'Фиксы обеих вертикалей на время спада минус 25%, но исполнение страдает — отток выше.',
          en: 'Both verticals’ fixed costs drop 25% for the downturn, but execution suffers — churn rises.',
        },
        effects: { crisisMonths: 4, crisisCut: true },
      },
      {
        label: { ru: 'Держать сервис', en: 'Hold service levels' },
        detail: {
          ru: 'Дороже пережидать, зато качество и удержание целы — база выйдет из спада живой.',
          en: 'Costlier to wait out, but quality and retention stay intact — the base leaves the downturn alive.',
        },
        effects: { crisisMonths: 4 },
      },
      {
        // Протокол «СКРЕПКА»: экономика — копия «держать сервис»
        secret: true,
        label: { ru: 'Поручить спад нейросети «СКРЕПКА»', en: 'Hand the downturn to the PAPERCLIP neural network' },
        detail: {
          ru: 'СКРЕПКА пересчитала все расходы и решила ничего не резать: «люди — не строка таблицы». Дороже, зато база выйдет из спада живой.',
          en: 'PAPERCLIP recalculated every cost and cut nothing: “people are not a spreadsheet row”. Costlier, but the base leaves the downturn alive.',
        },
        effects: { crisisMonths: 4 },
      },
    ],
  },
  {
    id: 'driver_poach', weight: 6, minMonth: 8, once: true, needsTaxi: true,
    title: { ru: '«Таксоград» переманивает водителей', en: 'Taxograd poaches your drivers' },
    text: {
      ru: 'Конкурент объявил бонус за переход: гарантированный доход первый месяц. Ваши водители читают эту рекламу прямо сейчас.',
      en: 'The incumbent announced a switching bonus: guaranteed income for the first month. Your drivers are reading that ad right now.',
    },
    lesson: {
      ru: 'Предложение труда мобильнее спроса: водитель меняет приложение за вечер, а вы парк за вечер не восстановите.',
      en: 'Labour supply moves faster than demand: a driver switches apps in an evening; you cannot rebuild a fleet in one.',
    },
    options: [
      {
        label: { ru: 'Контр-бонус (4 000 ₽ на водителя)', en: 'Counter-bonus ($40 per driver)' },
        detail: {
          ru: 'Цена по сегодняшнему парку. Водители остаются, и приток даже растёт.',
          en: 'Priced by today’s fleet. Drivers stay, and applications even pick up.',
        },
        effects: { oneOffCostPerDriver: 4_000, driverChurnAdd: -0.02, driverSupplyMult: 1.15 },
      },
      {
        label: { ru: 'Не ввязываться', en: 'Sit it out' },
        detail: {
          ru: 'Бесплатно, но к конкуренту разом уедет почти треть парка, и подача просядет.',
          en: 'Free — but almost a third of the fleet drives off to the rival at once, and pickups sag.',
        },
        effects: { driverLossShare: 0.30, taxiCapacityMult: 0.95 },
      },
    ],
  },
  {
    id: 'airport_tender', weight: 6, minMonth: 12, once: true, needsTaxi: true,
    title: { ru: 'Тендер на аэропорт', en: 'The airport tender' },
    text: {
      ru: 'Аэропорт выбирает официального перевозчика на выделенных стоянках. Годовой контракт — дорого и вперёд, зато весь год дальние поездки ваши.',
      en: 'The airport is choosing an official operator for its dedicated ranks. A one-year contract — dear and paid up front, but the long rides are yours all year.',
    },
    lesson: {
      ru: 'Инфраструктурные контракты платятся вперёд, а действуют срок — это капитальное решение, и считать его надо против цены денег и остатка партии.',
      en: 'Infrastructure contracts are paid up front and run for a term — a capital decision, to be weighed against the price of money and the time left.',
    },
    options: [
      {
        // Контракт срочный (12 мес, CONFIG.airportContractMonths). Вечная
        // прибавка выигрывала 24/24 при любой разумной цене: тонкая маржа
        // такси умножает вечный плюс частоты, а поздний буст целиком попадал
        // в окно роста оценки. Со сроком выбор живой — и честно зависит от
        // того, сколько партии осталось.
        label: { ru: 'Выиграть тендер (110 млн ₽)', en: 'Win the tender ($1.1M)' },
        detail: {
          ru: 'Разово дорого, зато каждый клиент такси ездит чаще — ближайшие 12 месяцев.',
          en: 'A steep one-off — but every taxi customer rides more often, for the next 12 months.',
        },
        effects: { oneOffCost: 110_000_000, tripsPerUserAdd: 0.35 },
      },
      {
        label: { ru: 'Уступить', en: 'Pass' },
        detail: {
          ru: 'Аэропорт достаётся «Таксограду» — его позиции в городе чуть крепче.',
          en: 'The airport goes to Taxograd — its grip on the city tightens a little.',
        },
        effects: { lockAdd: 0.02 },
      },
    ],
  },
  {
    id: 'bank_card', weight: 5, minMonth: 10, once: true,
    title: { ru: 'Банк предлагает кобрендовую карту', en: 'A bank proposes a co-branded card' },
    text: {
      ru: 'Крупный банк хочет карту с кешбэком на ваши сервисы. Единый счёт клиента — это дешёвый кросс-селл и первый шаг к финтеху.',
      en: 'A major bank wants a card with cashback on your services. A single customer account means cheap cross-sell — and a first step into fintech.',
    },
    lesson: {
      ru: 'Платёжная привычка — самая крепкая склейка экосистемы: тот, кто платит вашей картой, уже наполовину подписчик.',
      en: 'A payment habit is the strongest ecosystem glue: whoever pays with your card is already half a subscriber.',
    },
    options: [
      {
        label: { ru: 'Запустить карту (25 млн ₽)', en: 'Launch the card ($250K)' },
        detail: {
          ru: 'Интеграция и маркетинг запуска. Кросс-селл дешевеет на 10%, а круг готовых попробовать второй сервис немного расширяется — до конца партии.',
          en: 'Integration and launch marketing. Cross-sell gets 10% cheaper and the circle willing to try a second service grows a little — for the rest of the game.',
        },
        effects: { oneOffCost: 25_000_000, crossCacMult: 0.9, crossReachMult: 1.12 },
      },
      {
        label: { ru: 'Отказаться', en: 'Decline' },
        detail: {
          ru: 'Без обязательств: банк уйдёт к другому партнёру.',
          en: 'No strings attached: the bank will find another partner.',
        },
        effects: {},
      },
    ],
  },
  {
    // Кризис середины партии: единственное событие, которое движок выдаёт
    // принудительно (месяцы 16–22), потому что середина партии иначе
    // проседает — решения кончаются после запусков и возвращаются только
    // в третьем акте. Бьёт ровно по механике экосистемы: связывание
    // сервисов — это и есть то, за что регулятор берётся в реальности.
    // Три исхода расходятся навсегда и платятся разными валютами:
    // маржа логистики / сила подписки / деньги и время.
    id: 'antitrust', weight: 10, minMonth: 16, once: true, needsGlue: true,
    title: { ru: 'Антимонопольное дело о связывании сервисов', en: 'An antitrust case over service tying' },
    text: {
      ru: 'Служба по конкуренции считает, что холдинг связывает сервисы: своя логистика достаётся своему же е-кому дешевле рынка, а подписка запирает клиента внутри экосистемы. Дело открыто, решение за вами.',
      en: 'The competition authority argues the holding is tying its services: your own logistics serves your own e-commerce below market, and the subscription locks customers inside the ecosystem. The case is open; the move is yours.',
    },
    lesson: {
      ru: 'Экосистема выгодна ровно тем, чем раздражает регулятора: преимущество внутри холдинга — это барьер снаружи. Платить придётся структурой, продуктом или временем.',
      en: 'An ecosystem is valuable for exactly what irritates the regulator: an internal advantage is an external barrier. You pay with structure, with product, or with time.',
    },
    options: [
      {
        label: { ru: 'Отделить логистику', en: 'Split off logistics' },
        detail: {
          ru: 'Доставка становится отдельной компанией и возит всем по рынку. Дело закрыто сразу, разово — 60 ₽ на клиента холдинга за реорганизацию. Цена в другом: е-ком навсегда теряет часть маржи, свою логистику он теперь покупает как все.',
          en: 'The delivery arm becomes a separate company serving everyone at market rates. The case closes at once; the reorganisation costs a one-off $0.60 per holding customer. The real price is elsewhere: e-commerce permanently loses margin — it now buys logistics like everyone else.',
        },
        // Разделение — это ещё и разовая реорганизация: юристы, перевод
        // договоров, новые контуры. Цена растёт с размером холдинга, поэтому
        // «бесплатно» этот исход не бывает даже без е-кома.
        effects: { splitLogistics: true, oneOffCostPerUniqueUser: 60 },
      },
      {
        label: { ru: 'Открыть подписку конкурентам', en: 'Open the subscription to rivals' },
        detail: {
          ru: 'Выгоды Plus перестают быть эксклюзивом холдинга: те же кешбэки клиент получит у конкурента. Денег это не стоит и структуру не ломает — но бьёт по самой склейке: подписчики уходят заметно чаще, а клиент двух сервисов больше не держится за вас так крепко.',
          en: 'Plus perks stop being exclusive: a customer gets the same cashback at a rival. It costs no money and breaks no structure — but it hits the glue itself: subscribers churn markedly more, and a two-service customer no longer holds on to you as tightly.',
        },
        effects: { plusChurnAdd: 0.05, plusConvMult: 0.85, ecoReliefCut: 0.12 },
      },
      {
        label: { ru: 'Судиться (юристы 10 млн ₽/мес, 6 мес.)', en: 'Litigate ($100K/mo for 6 months)' },
        detail: {
          ru: 'Структура холдинга остаётся как есть. Полгода юристов и внимания прессы, а единый аккаунт до конца партии остаётся под надзором: согласия собираются строже, и ёмкость кросс-селла ниже.',
          en: 'The holding’s structure stays as it is. Six months of lawyers and press attention — and the unified account stays under supervision to the end: consent is collected more strictly and cross-sell capacity is lower.',
        },
        effects: { legalMonths: 6, supervisionOn: true },
      },
    ],
  },
  {
    id: 'taxi_outage', weight: 5, minMonth: 6, needsTaxi: true,
    title: { ru: 'Сбой в приложении такси', en: 'Taxi app outage' },
    text: {
      ru: 'Диспетчеризация лежала вечер пятницы — самые дорогие часы недели. Заказы уходили к конкуренту.',
      en: 'Dispatch was down on Friday evening — the dearest hours of the week. Orders went to the incumbent.',
    },
    effects: { taxiDemandMult: 0.88, taxiChurnAdd: 0.012, oneOffCost: 4_000_000 },
    lesson: {
      ru: 'Технический долг — тоже строка P&L, просто отложенная.',
      en: 'Technical debt is a P&L line too — just a deferred one.',
    },
  },

  // --- Год конгломерата: события открываются с 37-го месяца, пул основной
  // партии не меняется — зачтённые результаты неприкосновенны ---
  {
    id: 'scoot_warm_winter',
    weight: 14, minMonth: 37, once: true,
    needsScooters: true,
    // Только календарная зима: январь, февраль, декабрь
    calMonths: [0, 1, 11],
    title: { ru: 'Аномально тёплая зима', en: 'Freak warm winter' },
    text: {
      ru: 'Синоптики разводят руками: плюс десять в разгар зимы, и весь город хочет кататься прямо сейчас. А ваш парк, скорее всего, зимует по плану.',
      en: 'Forecasters shrug: ten above zero in the dead of winter, and the whole city wants to ride right now. Your fleet, most likely, is wintering according to plan.',
    },
    // Погода поднимает спрос независимо от решения — вопрос лишь в том,
    // стоит ли парк там, где этот спрос можно собрать
    effects: { scootDemandMult: 5 },
    options: [
      {
        label: { ru: 'Экстренно выкатить парк (бригады, 2 млн ₽)', en: 'Roll the fleet out overnight (crews, $20K)' },
        detail: {
          ru: 'Ночной вывоз со склада: уличный месяц вне плана. Парк соберёт аномальный спрос — но зима есть зима: реагенты никуда не делись, износ двойной.',
          en: 'An overnight rollout from the warehouse: an off-plan street month. The fleet collects the freak demand — but winter is winter: the road salt is still there, wear is doubled.',
        },
        effects: { scootForceStreet: true, oneOffCost: 2_000_000 },
      },
      {
        label: { ru: 'Не верить погоде: план есть план', en: 'Distrust the weather: the plan is the plan' },
        detail: {
          ru: 'Парк остаётся, где стоит по плану года. Если он и так на улице — спрос ваш бесплатно; если на складе — тёплые недели пройдут мимо.',
          en: 'The fleet stays wherever the year plan says. If it is already out — the demand is yours for free; if it is in storage, the warm weeks pass you by.',
        },
        effects: {},
      },
    ],
    lesson: {
      ru: 'Сезонность — это ожидание, погода — реализация: капитал зарабатывает, только когда он на улице в правильный месяц.',
      en: 'Seasonality is the expectation, weather is the realization: capital earns only when it is on the street in the right month.',
    },
  },
];

// Штраф прилетает только тем, кто решил дождаться закона
const REGULATION_FINE = {
  id: 'regulation_fine', weight: 12, needsTaxi: true,
  title: { ru: 'Штраф за нелицензированный парк', en: 'Fine for an unlicensed fleet' },
  text: {
    ru: 'Вы решили дождаться закона — закон дождался вас: инспекция пересчитала машины.',
    en: 'You decided to wait for the law. The law waited for you: inspectors counted the cars.',
  },
  effects: { oneOffCostPerDriver: 7_000, driverChurnAdd: 0.02 },
  lesson: {
    ru: 'Отложенный риск не исчезает, он лишь накапливает проценты.',
    en: 'Deferred risk does not disappear, it only accrues interest.',
  },
};

export function eventById(id) {
  if (id === REGULATION_FINE.id) return REGULATION_FINE;
  return EVENTS.find((e) => e.id === id)
    ?? VANITY_EVENTS.find((e) => e.id === id) ?? null;
}

// Месяц, к которому кризис середины партии приходит гарантированно, если
// случай его не принёс: провал агентности в середине партии лечится не
// вероятностью, а расписанием.
// ============================================================================
// Престижные траты. Единственное семейство событий, где «правильный ответ»
// известен заранее — и в этом весь смысл.
//
// Такое предложение приходит к каждой выросшей компании: титульное
// спонсорство, ребрендинг, собственный форум. Подача приятная, слова
// красивые, эффект — есть, но однократный и мизерный против цены, а цена
// растёт вместе с вашим размером. Всё, что нужно, чтобы отказаться, лежит
// в самом предложении: разделите цену на измеримую отдачу.
//
// Это осознанное исключение из правила «нет доминируемых решений»: набор
// учит считать, а считать имеет смысл ровно там, где ответ не очевиден до
// подсчёта. Какое именно предложение придёт — случайно, поэтому запомнить
// «всегда отказывайся от стадиона» нельзя: узнавать нужно не название,
// а признак — трату, которую не к чему привязать.
// ============================================================================
export const VANITY_FAMILY = 'vanity';

const vanityDecline = {
  label: { ru: 'Вежливо отказаться', en: 'Politely decline' },
  detail: {
    ru: 'Ничего не происходит. Совсем ничего: ни расходов, ни последствий.',
    en: 'Nothing happens. Nothing at all: no spending, no consequences.',
  },
  effects: {},
};

const vanityLesson = {
  ru: 'Признак престижной траты — её не к чему привязать: нет метрики, которая изменится настолько, чтобы окупить чек. Считается это до покупки, а не после: цена известна, отдача обещана словами. Такие расходы окупаются только в презентации — и растут вместе с компанией, потому что просят у того, у кого есть.',
  en: 'The mark of a vanity spend is that there is nothing to tie it to: no metric moves enough to repay the cheque. The arithmetic is available before you buy, not after: the price is known, the return is promised in adjectives. Spending like this pays off only in a presentation — and it scales with the company, because they ask those who have.',
};

export const VANITY_EVENTS = [
  {
    id: 'vanity_stadium', family: VANITY_FAMILY, weight: 4, minMonth: 10, once: true,
    title: { ru: 'Титульное спонсорство стадиона', en: 'Naming rights for the stadium' },
    text: {
      ru: 'Городской стадион ищет титульного спонсора. «Арена Новоград» — имя холдинга на трибунах, в трансляциях и на всех афишах города. Отдел продаж клуба говорит о «десятках миллионов контактов» и «эмоциональной связи с брендом».',
      en: 'The city stadium is looking for a title sponsor. “Novograd Arena” — the holding’s name on the stands, in broadcasts and on every poster in town. The club’s sales team talks about “tens of millions of impressions” and “an emotional bond with the brand”.',
    },
    lesson: vanityLesson,
    options: [
      {
        label: { ru: 'Купить имя стадиона', en: 'Buy the naming rights' },
        detail: {
          ru: 'Разово 520 ₽ на каждого клиента холдинга. Измеримая отдача — внимание одного месяца: кросс-селл в этом месяце сработает на 12% лучше. Дальше имя просто висит.',
          en: 'A one-off $5.20 per holding customer. The measurable return is one month of attention: cross-sell works 12% better this month. After that the name just hangs there.',
        },
        effects: { oneOffCostPerUniqueUser: 520, crossSellMult: 1.12 },
      },
      vanityDecline,
    ],
  },
  {
    id: 'vanity_rebrand', family: VANITY_FAMILY, weight: 4, minMonth: 12, once: true,
    title: { ru: 'Агентство предлагает ребрендинг', en: 'An agency pitches a rebrand' },
    text: {
      ru: 'Известное агентство показало презентацию: новый логотип, новая палитра, «единый визуальный язык экосистемы». Половина слайдов — про то, как холдинг будет выглядеть в подборках дизайнерских премий.',
      en: 'A famous agency presented: a new logo, a new palette, “a unified visual language for the ecosystem”. Half the slides are about how the holding will look in design-award roundups.',
    },
    lesson: vanityLesson,
    options: [
      {
        label: { ru: 'Заказать ребрендинг', en: 'Commission the rebrand' },
        detail: {
          ru: 'Разово 400 ₽ на каждого клиента холдинга: сам проект, перекраска приложений, вывесок и машин. Измеримая отдача — месяц свежести: отток в этом месяце ниже на 0.4 п.п.',
          en: 'A one-off $4 per holding customer: the project itself plus repainting the apps, signage and vehicles. The measurable return is a month of novelty: churn is 0.4pp lower this month.',
        },
        effects: { oneOffCostPerUniqueUser: 400, foodChurnAdd: -0.004, taxiChurnAdd: -0.004 },
      },
      vanityDecline,
    ],
  },
  {
    id: 'vanity_forum', family: VANITY_FAMILY, weight: 4, minMonth: 14, once: true,
    title: { ru: 'Свой форум для города', en: 'Your own city forum' },
    text: {
      ru: 'Команда предлагает сделать «Новоград Форум»: сцена, приглашённые спикеры, гости из отрасли, пресса. Аргумент — «мы станем компанией, которая задаёт повестку города».',
      en: 'The team proposes a “Novograd Forum”: a stage, guest speakers, industry visitors, press. The argument is that “we become the company that sets the city’s agenda”.',
    },
    lesson: vanityLesson,
    options: [
      {
        label: { ru: 'Провести форум', en: 'Hold the forum' },
        detail: {
          ru: 'Разово 320 ₽ на каждого клиента холдинга: площадка, продакшн, гости. Измеримая отдача — месяц публикаций: спрос стартового сервиса в этом месяце выше на 2%.',
          en: 'A one-off $3.20 per holding customer: venue, production, guests. The measurable return is a month of coverage: demand for the starting service is 2% higher this month.',
        },
        effects: { oneOffCostPerUniqueUser: 320, foodDemandMult: 1.02 },
      },
      vanityDecline,
    ],
  },
];

export const FORCED_CRISIS_ID = 'antitrust';
export const FORCED_CRISIS_MONTH = 22;

// Выбирает событие месяца (или null). Вероятность события ~45%.
// ctx: { taxiOn, atWar, glued, seen, lastId } — контекст холдинга и история:
// сюжетные события (once) не повторяются, обычные не идут два месяца подряд.
export function rollEvent(rng, month, flags = {}, ctx = {}) {
  if (month < 2) return null;
  const seen = new Set(ctx.seen ?? []);
  // Кризис середины партии не отдан на волю случая: если к сроку он не
  // выпал сам, а холдингу есть что делить, он приходит принудительно.
  if (month >= FORCED_CRISIS_MONTH && ctx.glued && !seen.has(FORCED_CRISIS_ID)
    && ctx.lastId !== FORCED_CRISIS_ID) {
    const forced = EVENTS.find((e) => e.id === FORCED_CRISIS_ID);
    if (forced) return { ...forced };
  }
  if (rng() > 0.45) return null;
  // Престижная трата приходит не больше одной за партию: их урок один,
  // и повторять его дороже, чем он стоит.
  const vanitySeen = VANITY_EVENTS.some((e) => seen.has(e.id));
  const pool = [...EVENTS, ...(vanitySeen ? [] : VANITY_EVENTS)]
    .filter((e) => month >= (e.minMonth ?? 0)
    && (!e.needsTaxi || ctx.taxiOn)
    && (!e.needsWar || ctx.atWar)
    && (!e.needsGlue || ctx.glued)
    && (!e.needsScooters || ctx.scooters)
    && (!e.calMonths || e.calMonths.includes((month - 1) % 12))
    && !(e.once && seen.has(e.id))
    && e.id !== ctx.lastId);
  if (flags.regulationRisk && ctx.taxiOn && !seen.has(REGULATION_FINE.id)) {
    pool.push(REGULATION_FINE);
  }
  const picked = weightedPick(rng, pool);
  return picked ? { ...picked } : null;
}

// Собирает модификаторы месяца из события и выбранной игроком опции
export function applyEvent(mods, event, optionIndex) {
  if (!event) return mods;
  const effects = { ...(event.effects ?? {}) };
  if (event.options && event.options[optionIndex]) {
    Object.assign(effects, event.options[optionIndex].effects);
  }
  const multiplicative = new Set(['foodDemandMult', 'taxiDemandMult', 'taxiCapacityMult',
    'driverSupplyMult', 'crossSellMult', 'crossCacMult', 'crossReachMult', 'scootDemandMult']);
  for (const [key, value] of Object.entries(effects)) {
    if (multiplicative.has(key)) {
      mods[key] *= value;
    } else if (key === 'notes') {
      continue;
    } else if (typeof value === 'number' && key in mods) {
      mods[key] += value;
    } else {
      mods[key] = value;
    }
  }
  mods.notes.push(event.id);
  return mods;
}
