// ============================================================================
// Случайные события. Каждое событие возвращает набор модификаторов на неделю.
// Часть событий требует решения игрока — это точки, где видно цену компромисса.
//
// Погоды здесь нет: она действует каждую неделю и живёт в weather.js.
// Событие — это то, что случается редко и требует реакции; погода —
// постоянный фон, к которому нужно уметь готовиться заранее.
// ============================================================================

import { weightedPick } from './rng.js';

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
    variableCostAdd: 0,     // прибавка к себестоимости заказа, ₽
    notes: [],
  };
}

// Событие без выбора: effects применяются автоматически.
// Событие с выбором: options[] — игрок решает до расчёта недели.
export const EVENTS = [
  {
    id: 'holiday', weight: 7, minWeek: 4,
    title: 'Длинные выходные',
    text: 'Праздники: заказов заметно больше, средний чек выше.',
    effects: { demandMult: 1.3 },
    lesson: 'Сезонность надо планировать наймом заранее, а не постфактум.',
  },
  {
    id: 'competitor_promo', weight: 9, minWeek: 6,
    title: 'Конкурент раздаёт промокоды',
    text: 'Крупный конкурент залил рынок скидками — часть ваших клиентов ушла пробовать.',
    effects: { demandMult: 0.88, satisfactionAdd: -0.08 },
    lesson: 'Клиенты в фудтехе почти не лояльны: удержание держится на скорости и ассортименте, а не на бренде.',
  },
  {
    id: 'viral', weight: 5, minWeek: 8,
    title: 'Вирусный ролик о сервисе',
    text: 'Блогер снял добрый ролик про вашего курьера. Бесплатная узнаваемость.',
    effects: { awarenessAdd: 0.06, demandMult: 1.05 },
    lesson: 'Органический охват снижает CAC, но им нельзя управлять — это не строка бюджета.',
  },
  {
    id: 'outage', weight: 6, minWeek: 5,
    title: 'Сбой в приложении',
    text: 'Платёжный шлюз лежал полтора дня. Заказы терялись, поддержка перегружена.',
    effects: { demandMult: 0.85, satisfactionAdd: -0.12, oneOffCost: 1_200_000 },
    lesson: 'Технический долг — это тоже строка P&L, просто отложенная.',
  },
  {
    id: 'fuel', weight: 6, minWeek: 6,
    title: 'Топливо и самокаты подорожали',
    text: 'Курьеры требуют компенсацию расходов.',
    effects: { variableCostAdd: 12, courierChurnAdd: 0.02 },
    lesson: 'Инфляция издержек бьёт по марже мгновенно, а цену клиенту поднять можно не всегда.',
  },
  {
    id: 'food_inspection', weight: 4, minWeek: 12,
    title: 'Проверка Роспотребнадзора',
    text: 'Проверяют условия перевозки готовой еды у партнёров.',
    effects: { restaurantChurnAdd: 0.03, oneOffCost: 800_000 },
    lesson: 'Регуляторные риски масштабируются вместе с вами.',
  },

  // --- События с выбором ---
  {
    id: 'courier_strike', weight: 7, minWeek: 8,
    title: 'Курьеры угрожают забастовкой',
    text: 'Курьерский чат бурлит: ставка за заказ не покрывает пробки и ожидание у ресторана. Требуют разовую доплату.',
    lesson: 'Труд в гиг-экономике — это рынок, а не ресурс: цена предложения меняется быстрее ваших планов.',
    options: [
      {
        label: 'Выплатить бонус (1,5 млн ₽)',
        detail: 'Разовые расходы, но отток курьеров резко падает.',
        effects: { oneOffCost: 1_500_000, courierChurnAdd: -0.02, courierSupplyMult: 1.25 },
      },
      {
        label: 'Проигнорировать',
        detail: 'Экономим деньги, но теряем людей и скорость.',
        effects: { courierChurnAdd: 0.10, capacityMult: 0.9 },
      },
    ],
  },
  {
    id: 'big_chain', weight: 6, minWeek: 10,
    title: 'Крупная сеть ресторанов идёт на переговоры',
    text: 'Сеть из 40 популярных ресторанов готова подключиться, но только на льготной комиссии 10%.',
    lesson: 'Переговорная сила крупных партнёров — причина, по которой средняя комиссия всегда ниже прайса.',
    options: [
      {
        label: 'Согласиться на 10%',
        detail: '+40 ресторанов сразу, но комиссия по всему городу просядет.',
        effects: { restaurantsAdd: 40, commissionOverrideDelta: -0.02, demandMult: 1.06 },
      },
      {
        label: 'Держать прайс',
        detail: 'Маржа сохранена, ассортимент — нет.',
        effects: { restaurantChurnAdd: 0.01 },
      },
    ],
  },
  {
    id: 'investor_pressure', weight: 5, minWeek: 16,
    title: 'Инвесторы требуют показать рост',
    text: 'Совет директоров хочет увидеть +25% заказов к следующему кварталу и намекает на агрессивное промо.',
    lesson: 'Рост, купленный за скидки, исчезает вместе со скидками. Проверьте retention, а не GMV.',
    options: [
      {
        label: 'Залить рынок промо',
        detail: 'Спрос вверх, маржа вниз, зато оценка компании выше.',
        effects: { demandMult: 1.18, variableCostAdd: 35, valuationBonus: 0.15 },
      },
      {
        label: 'Отстоять юнит-экономику',
        detail: 'Инвесторы недовольны, оценка ниже.',
        effects: { valuationBonus: -0.1 },
      },
    ],
  },
  {
    id: 'city_regulation', weight: 4, minWeek: 20,
    title: 'Мэрия обсуждает регулирование курьеров',
    text: 'Городу не нравятся самокаты на тротуарах. Обсуждают обязательное страхование курьеров.',
    lesson: 'Стоимость соответствия регулированию — постоянная, а не переменная: она бьёт по маленьким сильнее.',
    options: [
      {
        label: 'Ввести страховку добровольно',
        detail: '+8 ₽ к себестоимости заказа, но курьеры довольны и репутация растёт.',
        effects: { variableCostAdd: 8, courierChurnAdd: -0.02, awarenessAdd: 0.03 },
      },
      {
        label: 'Ждать закона',
        detail: 'Экономим сейчас, рискуем штрафом позже.',
        effects: { regulationRisk: true },
      },
    ],
  },
];

// Выбирает событие недели (или null). Вероятность события ~35%.
export function rollEvent(rng, week, flags = {}) {
  if (week < 2) return null;
  if (rng() > 0.35) return null;
  const pool = EVENTS.filter((e) => week >= (e.minWeek ?? 0));
  if (flags.regulationRisk) {
    pool.push({
      id: 'regulation_fine', weight: 12, title: 'Штраф за нарушение правил перевозки',
      text: 'Вы решили дождаться закона — закон дождался вас. Городская инспекция выписала штраф.',
      effects: { oneOffCost: 4_000_000, awarenessAdd: -0.03 },
      lesson: 'Отложенный риск не исчезает, он лишь накапливает проценты.',
    });
  }
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
  mods.notes.push(event.title);
  return mods;
}
