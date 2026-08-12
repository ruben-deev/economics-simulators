// ============================================================================
// Совет директоров: цель на квартал и последствия её провала.
//
// Зачем это здесь. Партия в НОВОЕДЕ — пятьдесят две недели, и до сих пор она
// ничем не размечалась: год делился только на сезоны погоды. Пятьдесят два
// одинаковых хода — это не длинная партия, а ровная. В двух других играх ту же
// работу делает совет: цель объявлена заранее, известна с первого хода и
// заставляет пересобирать план, потому что цели тянут в разные стороны.
//
//   первый квартал  — заказы: покажите, что через вас вообще заказывают;
//   второй          — вклад с заказа: оборот чужой, вклад ваш;
//   третий          — прибыльные недели, и не ценой растерянной базы;
//   четвёртый       — доля города: рынок делится не заказами, а клиентами.
//
// Стратегия, выигрывающая первый квартал (рост любой ценой), проваливает
// второй. Это и есть смысл: цена доставки и комиссия — решение на квартал,
// а не настройка, которую один раз выставили и забыли.
//
// Планки выставлены замером: сто двадцать случайных стратегий прогнаны на всю
// партию, и планка стоит там, где её берёт заметно лучшая половина, а середина
// не берёт. Цель, которую берут все, учит ровно тому же, что цель, которую
// не берёт никто, — то есть ничему.
// ============================================================================

import { CONFIG } from './config.js';

export const GOAL_TYPES = {
  orders: 'orders',           // заказов за неделю к концу квартала
  unit: 'unit',               // вклад с заказа
  profit: 'profit',           // прибыльные недели, база не сжимается
  share: 'share',             // доля города
};

/**
 * Цель квартала. Считается от фактического состояния на его начало, поэтому
 * остаётся вызовом и для отстающих, и для ушедших вперёд.
 */
export function makeGoal(quarter, state, orders, customers) {
  if (quarter === 1) {
    return {
      quarter,
      type: GOAL_TYPES.orders,
      // 68-й процентиль по замеру: половина стратегий не доходит, лучшая треть берёт
      target: 45_000,
      reward: 0.08,
      penalty: 'dilution',
    };
  }
  if (quarter === 2) {
    return {
      quarter,
      type: GOAL_TYPES.unit,
      // Вклад с заказа, а не прибыль: на этом сроке прибыли ещё нет ни у кого,
      // а вот довезти заказ дороже, чем взять за него денег, — уже стыдно.
      target: 60,
      ordersFloor: Math.round(Math.max(9_000, orders * 0.85)),
      reward: 0.10,
      penalty: 'marketingCap',
    };
  }
  if (quarter === 3) {
    return {
      quarter,
      type: GOAL_TYPES.profit,
      // Прибыльных недель из тринадцати. Замер: у случайной стратегии их ноль
      // даже на 85-м процентиле — к третьему кварталу в плюс выходят единицы.
      // Доведённая стратегия закрывает в плюс все тринадцать, так что планка
      // в шесть недель отделяет работающий бизнес от почти работающего,
      // а не наказывает за неудачный месяц.
      target: 6,
      // И не ценой базы: срезать расходы, растеряв клиентов, — не то,
      // за что хвалят.
      customersFloor: Math.round(Math.max(20_000, customers * 0.9)),
      reward: 0.12,
      penalty: 'marketingCap',
    };
  }
  return {
    quarter,
    type: GOAL_TYPES.share,
    target: 0.45,
    customersFloor: Math.round(Math.max(30_000, customers * 0.95)),
    reward: 0.15,
    penalty: 'valuation',
  };
}

/** Текущий прогресс — показывается каждую неделю, а не только в конце квартала. */
export function goalProgress(goal, ctx) {
  if (!goal) return null;
  const { orders, cmPerOrder, profitableWeeks, customers, marketShare } = ctx;
  if (goal.type === GOAL_TYPES.orders) {
    return { value: orders, target: goal.target, done: orders >= goal.target };
  }
  if (goal.type === GOAL_TYPES.unit) {
    return {
      value: cmPerOrder,
      target: goal.target,
      orders,
      ordersFloor: goal.ordersFloor,
      done: cmPerOrder >= goal.target && orders >= goal.ordersFloor,
    };
  }
  if (goal.type === GOAL_TYPES.profit) {
    return {
      value: profitableWeeks,
      target: goal.target,
      customers,
      customersFloor: goal.customersFloor,
      done: profitableWeeks >= goal.target && customers >= goal.customersFloor,
    };
  }
  return {
    value: marketShare,
    target: goal.target,
    customers,
    customersFloor: goal.customersFloor,
    done: marketShare >= goal.target && customers >= goal.customersFloor,
  };
}

/**
 * Провал не заканчивает партию — он делает следующий квартал труднее.
 * Именно поэтому план приходится пересобирать, а не начинать заново.
 */
export function applyGoalOutcome(state, goal, progress, week) {
  const passed = Boolean(progress?.done);
  const outcome = { quarter: goal.quarter, type: goal.type, passed, effect: null };

  if (passed) {
    state.flags.valuationBonus += goal.reward;
    outcome.effect = 'reward';
    return outcome;
  }

  if (goal.penalty === 'dilution') {
    // Акционеры вводят деньги сами и на своих условиях
    state.pendingDilution = 0.15;
    outcome.effect = 'dilution';
  } else if (goal.penalty === 'marketingCap') {
    // Маркетинг режут на квартал: совет больше не верит в «купим рост».
    // Это ломает ровно ту стратегию, которая работала до сих пор.
    state.restrictions = {
      marketingCap: CONFIG.boardMarketingCap,
      until: week + CONFIG.boardCapWeeks,
    };
    state.flags.valuationBonus -= 0.08;
    outcome.effect = 'marketingCap';
  } else {
    state.flags.valuationBonus -= 0.12;
    outcome.effect = 'valuation';
  }
  return outcome;
}
