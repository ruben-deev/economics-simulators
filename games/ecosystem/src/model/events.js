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
    notes: [],
  };
}

// needsTaxi: событие имеет смысл только при запущенном такси.
// needsWar: только пока идёт промо-война с «СитиДрайвом».
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
      ru: 'Популярный блогер показал, как заказывает еду и такси в одном приложении. Бесплатное внимание к экосистеме.',
      en: 'A popular blogger showed off ordering food and a ride in one app. Free attention for the ecosystem.',
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
        label: { ru: 'Выплатить (3 000 ₽ на водителя)', en: 'Pay up (₽3,000 per driver)' },
        detail: {
          ru: 'Цена растёт со штатом: тысяче водителей — три миллиона, пяти тысячам — пятнадцать.',
          en: 'The price scales with the fleet: three million for a thousand drivers, fifteen for five thousand.',
        },
        effects: { oneOffCostPerDriver: 3_000, driverChurnAdd: -0.02, driverSupplyMult: 1.2 },
      },
      {
        label: { ru: 'Проигнорировать', en: 'Ignore it' },
        detail: {
          ru: 'Дёшево, пока водителей избыток. Дорого, когда каждая машина на счету.',
          en: 'Cheap while drivers are plentiful. Expensive when every car counts.',
        },
        effects: { driverChurnAdd: 0.08, taxiCapacityMult: 0.93 },
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
        label: { ru: 'Лицензировать всех сейчас (2 500 ₽ на водителя)', en: 'License everyone now (₽2,500 per driver)' },
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
        label: { ru: 'Признать и компенсировать (250 ₽ на клиента базы)', en: 'Own it and compensate (₽250 per customer)' },
        detail: {
          ru: 'Плюс 15 млн на аудит безопасности. Цена растёт с базой: чем лучше шёл кросс-селл, тем дороже извинение.',
          en: 'Plus ₽15M for a security audit. The price scales with the base: the better your cross-sell went, the dearer the apology.',
        },
        effects: { oneOffCostPerUniqueUser: 250, oneOffCost: 15_000_000 },
      },
      {
        label: { ru: 'Замять', en: 'Bury it' },
        detail: {
          ru: 'Бесплатно сегодня. Доверие к единому аккаунту падает: кросс-селл работает вполсилы несколько месяцев, отток выше.',
          en: 'Free today. Trust in the single account drops: cross-sell runs at half power for months, churn ticks up.',
        },
        effects: { trustMonths: 4, foodChurnAdd: 0.012, taxiChurnAdd: 0.012 },
      },
    ],
  },
  {
    id: 'truce_offer', weight: 8, minMonth: 6, needsWar: true,
    title: { ru: '«СитиДрайв» предлагает перемирие', en: 'CityDrive offers a truce' },
    text: {
      ru: 'Хозяин рынка такси устал жечь деньги и предлагает разойтись: он прекращает демпинг, вы не трогаете его корпоративных клиентов и аэропорт.',
      en: 'The incumbent is tired of burning money and offers a deal: they stop dumping, you stay away from their corporate accounts and the airport.',
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
    title: { ru: 'Федеральный агрегатор еды пробует город', en: 'A national food platform probes the city' },
    text: {
      ru: 'Федеральный игрок запустил в Новограде промокампанию: ваш насыщенный рынок перестал быть только вашим.',
      en: 'A national player has launched a promo push in Novograd: your saturated market is no longer only yours.',
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
        label: { ru: 'Ответное промо (220 ₽ на клиента еды)', en: 'Counter-promo (₽220 per food customer)' },
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
        label: { ru: 'Залить промо (250 ₽ на клиента такси)', en: 'Flood promos (₽250 per taxi customer)' },
        detail: {
          ru: 'Раздача по всей базе такси: маленькой базе почти бесплатно, большой — очень дорого.',
          en: 'A blast across the taxi base: nearly free when small, very dear when large.',
        },
        effects: { oneOffCostPerTaxiUser: 250, taxiDemandMult: 1.12, valuationBonus: 0.004 },
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
  return EVENTS.find((e) => e.id === id) ?? null;
}

// Выбирает событие месяца (или null). Вероятность события ~40%.
// ctx: { taxiOn, atWar } — событиям нужен контекст холдинга.
export function rollEvent(rng, month, flags = {}, ctx = {}) {
  if (month < 2) return null;
  if (rng() > 0.4) return null;
  const pool = EVENTS.filter((e) => month >= (e.minMonth ?? 0)
    && (!e.needsTaxi || ctx.taxiOn)
    && (!e.needsWar || ctx.atWar));
  if (flags.regulationRisk && ctx.taxiOn) pool.push(REGULATION_FINE);
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
    'driverSupplyMult', 'crossSellMult']);
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
