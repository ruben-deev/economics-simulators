// ============================================================================
// Случайные события. Каждое событие возвращает набор модификаторов на неделю.
// Часть событий требует решения игрока — это точки, где видно цену компромисса.
//
// Погоды здесь нет: она действует каждую неделю и живёт в weather.js.
// Событие — это то, что случается редко и требует реакции; погода —
// постоянный фон, к которому нужно уметь готовиться заранее.
//
// Тексты двуязычны: { ru, en }. Разворачивает их i18n.tx().
// ============================================================================

import { weightedPick } from '../../../../shared/rng.js';

// Нейтральные модификаторы недели
export function neutralModifiers() {
  return {
    demandMult: 1,          // множитель спроса
    capacityMult: 1,        // множитель производительности курьеров
    courierChurnAdd: 0,     // прибавка к оттоку курьеров
    courierSupplyMult: 1,   // множитель притока откликов
    restaurantChurnAdd: 0,  // прибавка к оттоку ресторанов
    satisfactionAdd: 0,     // прибавка к удовлетворённости клиентов
    awarenessAdd: 0,        // разовый прирост узнаваемости
    oneOffCost: 0,          // разовые расходы, ₽
    // Поштучные разовые расходы: цена решения зависит от вашего размера.
    // Доплата «всем курьерам» стоит по числу курьеров, раздача «всей базе» —
    // по числу клиентов. Именно это делает выбор выбором: маленькой компании
    // дёшево то, что большой не по карману, и наоборот.
    oneOffCostPerCourier: 0,
    oneOffCostPerCustomer: 0,
    variableCostAdd: 0,     // прибавка к себестоимости заказа, ₽
    notes: [],
  };
}

// Событие без выбора: effects применяются автоматически.
// Событие с выбором: options[] — игрок решает до расчёта недели.
export const EVENTS = [
  {
    id: 'holiday', weight: 7, minWeek: 4,
    title: { ru: 'Длинные выходные', en: 'A long holiday weekend' },
    text: {
      ru: 'Праздники: заказов заметно больше, средний чек выше.',
      en: 'Public holidays: noticeably more orders, and a bigger basket on each one.',
    },
    effects: { demandMult: 1.3 },
    lesson: {
      ru: 'Сезонность надо планировать наймом заранее, а не постфактум.',
      en: 'Seasonality has to be staffed for in advance, not explained afterwards.',
    },
  },
  {
    id: 'competitor_promo', weight: 9, minWeek: 6,
    title: { ru: 'Конкурент раздаёт промокоды', en: 'A rival floods the city with promo codes' },
    text: {
      ru: 'Крупный конкурент залил рынок скидками — часть ваших клиентов ушла пробовать.',
      en: 'A large competitor has drowned the market in discounts, and some of your customers went to try it.',
    },
    effects: { demandMult: 0.88, satisfactionAdd: -0.08 },
    lesson: {
      ru: 'Клиенты в фудтехе почти не лояльны: удержание держится на скорости и ассортименте, а не на бренде.',
      en: 'Food delivery customers are barely loyal: retention rests on speed and selection, not on your brand.',
    },
  },
  {
    id: 'viral', weight: 5, minWeek: 8,
    title: { ru: 'Вирусный ролик о сервисе', en: 'A video about your service goes viral' },
    text: {
      ru: 'Блогер снял добрый ролик про вашего курьера. Бесплатная узнаваемость.',
      en: 'A blogger filmed a warm story about one of your couriers. Free awareness.',
    },
    effects: { awarenessAdd: 0.06, demandMult: 1.05 },
    lesson: {
      ru: 'Органический охват снижает CAC, но им нельзя управлять — это не строка бюджета.',
      en: 'Organic reach lowers CAC, but you cannot manage it — it is not a budget line.',
    },
  },
  {
    id: 'outage', weight: 6, minWeek: 5,
    title: { ru: 'Сбой в приложении', en: 'App outage' },
    text: {
      ru: 'Платёжный шлюз лежал полтора дня. Заказы терялись, поддержка перегружена.',
      en: 'The payment gateway was down for a day and a half. Orders were lost and support drowned.',
    },
    effects: { demandMult: 0.85, satisfactionAdd: -0.12, oneOffCost: 1_200_000 },
    lesson: {
      ru: 'Технический долг — это тоже строка P&L, просто отложенная.',
      en: 'Technical debt is a P&L line too — just a deferred one.',
    },
  },
  {
    id: 'fuel', weight: 6, minWeek: 6,
    title: { ru: 'Топливо и самокаты подорожали', en: 'Fuel and scooters get more expensive' },
    text: {
      ru: 'Курьеры требуют компенсацию расходов.',
      en: 'Couriers are demanding that their costs be covered.',
    },
    effects: { variableCostAdd: 12, courierChurnAdd: 0.02 },
    lesson: {
      ru: 'Инфляция издержек бьёт по марже мгновенно, а цену клиенту поднять можно не всегда.',
      en: 'Cost inflation hits margin immediately, while raising the customer price is not always an option.',
    },
  },
  {
    id: 'food_inspection', weight: 4, minWeek: 12,
    title: { ru: 'Проверка Роспотребнадзора', en: 'Food safety inspection' },
    text: {
      ru: 'Проверяют условия перевозки готовой еды у партнёров.',
      en: 'Inspectors are checking how partners transport prepared food.',
    },
    effects: { restaurantChurnAdd: 0.03, oneOffCost: 800_000 },
    lesson: {
      ru: 'Регуляторные риски масштабируются вместе с вами.',
      en: 'Regulatory risk scales with you.',
    },
  },

  // --- События с выбором ---
  {
    id: 'courier_strike', weight: 7, minWeek: 8,
    title: { ru: 'Курьеры угрожают забастовкой', en: 'Couriers threaten to strike' },
    text: {
      ru: 'Курьерский чат бурлит: ставка за заказ не покрывает пробки и ожидание у ресторана. Требуют разовую доплату.',
      en: 'The courier chat is boiling over: the per-order rate does not cover traffic and waiting at restaurants. They want a one-off payment.',
    },
    lesson: {
      ru: 'Труд в гиг-экономике — это рынок, а не ресурс: цена предложения меняется быстрее ваших планов.',
      en: 'Gig labour is a market, not a resource: the price of supply moves faster than your plans do.',
    },
    options: [
      {
        label: { ru: 'Выплатить доплату (2 500 ₽ на курьера)', en: 'Pay up (₽2,500 per courier)' },
        detail: {
          ru: 'Цена зависит от штата: сотне курьеров это четверть миллиона, полутора тысячам — почти четыре.',
          en: 'The price scales with the fleet: a quarter of a million for a hundred couriers, nearly four for fifteen hundred.',
        },
        effects: { oneOffCostPerCourier: 2_500, courierChurnAdd: -0.02, courierSupplyMult: 1.2 },
      },
      {
        label: { ru: 'Проигнорировать', en: 'Ignore it' },
        detail: {
          ru: 'Дёшево, пока курьеры простаивают и очередь заявок полна. Дорого, когда каждый на счету.',
          en: 'Cheap while couriers sit idle and the applications queue is full. Expensive when every one of them counts.',
        },
        effects: { courierChurnAdd: 0.07, capacityMult: 0.93 },
      },
    ],
  },
  {
    id: 'big_chain', weight: 6, minWeek: 10,
    title: { ru: 'Крупная сеть ресторанов идёт на переговоры', en: 'A large restaurant chain comes to the table' },
    text: {
      ru: 'Сеть из 40 популярных ресторанов готова подключиться, но только на льготной комиссии 10%.',
      en: 'A chain of 40 popular restaurants will join — but only at a preferential 10% commission.',
    },
    lesson: {
      ru: 'Переговорная сила крупных партнёров — причина, по которой средняя комиссия всегда ниже прайса.',
      en: 'The bargaining power of large partners is why your average commission is always below your rate card.',
    },
    options: [
      {
        label: { ru: 'Согласиться на 10%', en: 'Accept 10%' },
        detail: {
          ru: '+40 ресторанов сразу, но комиссия по всему городу просядет навсегда. Щедро, пока ресторанов мало; расточительно, когда их сотни.',
          en: '+40 restaurants at once, but the citywide commission sags for good. Generous while you have few restaurants; wasteful once you have hundreds.',
        },
        effects: { restaurantsAdd: 40, commissionOverrideDelta: -0.008, demandMult: 1.06 },
      },
      {
        label: { ru: 'Держать прайс', en: 'Hold your rate card' },
        detail: {
          ru: 'Маржа сохранена, ассортимент — нет.',
          en: 'Margin preserved, selection not so much.',
        },
        effects: { restaurantChurnAdd: 0.01 },
      },
    ],
  },
  {
    id: 'investor_pressure', weight: 5, minWeek: 16,
    title: { ru: 'Инвесторы требуют показать рост', en: 'Investors demand growth' },
    text: {
      ru: 'Совет директоров хочет увидеть +25% заказов к следующему кварталу и намекает на агрессивное промо.',
      en: 'The board wants orders up 25% by next quarter and is hinting at aggressive promotions.',
    },
    lesson: {
      ru: 'Рост, купленный за скидки, исчезает вместе со скидками. Проверьте retention, а не GMV.',
      en: 'Growth bought with discounts disappears with the discounts. Check retention, not GMV.',
    },
    options: [
      {
        label: { ru: 'Залить рынок промо (350 ₽ на клиента базы)', en: 'Flood the market with promos (₽350 per customer)' },
        detail: {
          ru: 'Раздача по всей базе: маленькой базе почти бесплатно, большой — очень дорого. Спрос вверх, оценка выше.',
          en: 'A blast across the whole base: nearly free with a small base, very expensive with a large one. Demand up, valuation up.',
        },
        effects: { oneOffCostPerCustomer: 350, demandMult: 1.09, valuationBonus: 0.003 },
      },
      {
        label: { ru: 'Отстоять юнит-экономику', en: 'Defend the unit economics' },
        detail: {
          ru: 'Инвесторы недовольны, оценка ниже.',
          en: 'Investors are unhappy and the valuation suffers.',
        },
        effects: { valuationBonus: -0.003 },
      },
    ],
  },
  {
    id: 'city_regulation', weight: 4, minWeek: 20,
    title: { ru: 'Мэрия обсуждает регулирование курьеров', en: 'City hall debates courier regulation' },
    text: {
      ru: 'Городу не нравятся самокаты на тротуарах. Обсуждают обязательное страхование курьеров.',
      en: 'The city dislikes scooters on pavements and is discussing mandatory courier insurance.',
    },
    lesson: {
      ru: 'Стоимость соответствия регулированию — постоянная, а не переменная: она бьёт по маленьким сильнее.',
      en: 'Compliance cost is fixed, not variable — which is why it hurts small players hardest.',
    },
    options: [
      {
        label: { ru: 'Застраховать всех сейчас (3 000 ₽ на курьера)', en: 'Insure everyone now (₽3,000 per courier)' },
        detail: {
          ru: 'Платите по сегодняшнему штату. Выгодно, если собираетесь расти: будущих курьеров это уже не коснётся.',
          en: 'You pay for today’s fleet. A good deal if you are going to grow: future couriers are already covered.',
        },
        effects: { oneOffCostPerCourier: 3_000, courierChurnAdd: -0.02, awarenessAdd: 0.02 },
      },
      {
        label: { ru: 'Ждать закона', en: 'Wait for the law' },
        detail: {
          ru: 'Экономим сейчас. Если штраф придёт — платить будете по штату на день штрафа, по двойной ставке.',
          en: 'Save now. If the fine lands, you will pay for the fleet you have on that day — at double the rate.',
        },
        effects: { regulationRisk: true },
      },
    ],
  },
];

// Штраф прилетает только тем, кто решил дождаться закона
const REGULATION_FINE = {
  id: 'regulation_fine', weight: 12,
  title: { ru: 'Штраф за нарушение правил перевозки', en: 'Fine for breaching transport rules' },
  text: {
    ru: 'Вы решили дождаться закона — закон дождался вас. Городская инспекция выписала штраф.',
    en: 'You decided to wait for the law. The law waited for you: the city inspectorate has issued a fine.',
  },
  effects: { oneOffCostPerCourier: 8_000, awarenessAdd: -0.03 },
  lesson: {
    ru: 'Отложенный риск не исчезает, он лишь накапливает проценты.',
    en: 'Deferred risk does not disappear, it only accrues interest.',
  },
};

export function eventById(id) {
  if (id === REGULATION_FINE.id) return REGULATION_FINE;
  return EVENTS.find((e) => e.id === id) ?? null;
}

// Выбирает событие недели (или null). Вероятность события ~35%.
export function rollEvent(rng, week, flags = {}) {
  if (week < 2) return null;
  if (rng() > 0.35) return null;
  const pool = EVENTS.filter((e) => week >= (e.minWeek ?? 0));
  if (flags.regulationRisk) pool.push(REGULATION_FINE);
  const picked = weightedPick(rng, pool);
  return picked ? { ...picked } : null;
}

// Собирает модификаторы недели из события и выбранной игроком опции
export function applyEvent(mods, event, optionIndex) {
  if (!event) return mods;
  const effects = { ...(event.effects ?? {}) };
  if (event.options && event.options[optionIndex]) {
    Object.assign(effects, event.options[optionIndex].effects);
  }
  for (const [key, value] of Object.entries(effects)) {
    if (key === 'demandMult' || key === 'capacityMult' || key === 'courierSupplyMult') {
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
