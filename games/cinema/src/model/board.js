// ============================================================================
// Совет директоров: цели на год и последствия их провала.
//
// Зачем это в модели. Одна цель на всю партию («максимизируйте оценку»)
// позволяет выбрать стратегию на первом ходу и больше к ней не возвращаться.
// Совет ставит цель на год, и цели устроены так, что тянут в разные стороны:
// первый год — рост базы, второй — доказать, что бизнес умеет быть прибыльным,
// третий — отобрать рынок у конкурента. Стратегия, выигрывающая первый год,
// проваливает второй.
//
// Цели известны заранее — они объявляются в первый месяц года. Это не рулетка,
// а планирование: вы знаете, к чему идёте, и решаете, чем ради этого жертвуете.
// ============================================================================

import { CONFIG } from './config.js';

export const GOAL_TYPES = {
  subscribers: 'subscribers',   // база на конец года
  profit: 'profit',             // сколько месяцев года закрыты в плюс
  share: 'share',               // доля рынка против конкурента
};

/**
 * Цель года. Считается от фактического состояния на начало года,
 * поэтому всегда остаётся вызовом и не превращается в формальность.
 *
 * Числа выставлены не на глаз, а по замеру: две с лишним сотни разных
 * стратегий прогнаны на три года, и на каждой границе года посмотрено
 * распределение. Планка стоит там, где её берёт заметно лучшая половина
 * и не берёт середина. Раньше было наоборот: первый год проходил кто угодно
 * (900 тыс. при медиане 3.6 млн), а второй и третий требовали роста базы
 * в 1.5 и 1.35 раза при том, что медианный рост во второй год — 1.04,
 * а в третий база вообще сжимается: 0.61. Цели, которые не берёт никто,
 * учат ровно тому же, что цели, которые берут все, — то есть ничему.
 */
export function makeGoal(year, state, yourSubs, rivalSubs) {
  if (year === 1) {
    return {
      year,
      type: GOAL_TYPES.subscribers,
      target: 3_400_000,
      reward: 0.10,
      penalty: 'dilution',
    };
  }
  if (year === 2) {
    return {
      year,
      type: GOAL_TYPES.profit,
      // Не разово, а устойчиво: минимум 3 прибыльных месяца из 12.
      // И при этом не ценой базы: сокращать расходы, теряя подписчиков,
      // — не то, за что хвалят. Отсюда «хотя бы не сжаться».
      target: 3,
      subsFloor: Math.round(Math.max(2_000_000, yourSubs * 1.05)),
      reward: 0.12,
      penalty: 'contentCap',
    };
  }
  const total = yourSubs + rivalSubs;
  return {
    year,
    // Третий год — год обороны: права истекают, партнёрские контракты
    // заканчиваются, конкурент вырос. Удержать базу здесь уже достижение,
    // поэтому нижняя граница ниже единицы, а не выше.
    type: GOAL_TYPES.share,
    // Планка поднята с 0.35 по замеру: медианная доля на конец партии 0.45,
    // и прежнюю цель брали две трети стратегий — то есть это была не цель.
    target: 0.60,
    subsFloor: Math.round(Math.max(2_500_000, yourSubs * 0.75)),
    reward: 0.18,
    penalty: 'valuation',
    startShare: total > 0 ? yourSubs / total : 0.5,
  };
}

/** Текущий прогресс по цели — для отображения каждый месяц, а не только в конце. */
export function goalProgress(goal, ctx) {
  if (!goal) return null;
  const { subs, rivalSubs, profitableMonths } = ctx;
  if (goal.type === GOAL_TYPES.subscribers) {
    return { value: subs, target: goal.target, done: subs >= goal.target };
  }
  if (goal.type === GOAL_TYPES.profit) {
    return {
      value: profitableMonths,
      target: goal.target,
      subs,
      subsFloor: goal.subsFloor,
      done: profitableMonths >= goal.target && subs >= goal.subsFloor,
    };
  }
  const total = subs + rivalSubs;
  const share = total > 0 ? subs / total : 0;
  return {
    value: share,
    target: goal.target,
    subs,
    subsFloor: goal.subsFloor,
    done: share >= goal.target && subs >= goal.subsFloor,
  };
}

/**
 * Применяет последствия. Провал не убивает партию — он делает следующий год
 * труднее, и именно это заставляет пересобирать стратегию, а не начинать заново.
 */
export function applyGoalOutcome(state, goal, progress, month) {
  const passed = Boolean(progress?.done);
  const outcome = { year: goal.year, type: goal.type, passed, effect: null };

  if (passed) {
    state.flags.valuationBonus += goal.reward;
    outcome.effect = 'reward';
    return outcome;
  }

  if (goal.penalty === 'dilution') {
    // Совет вводит деньги сам — на своих условиях. Долю режет заметно.
    state.pendingDilution = 0.18;
    outcome.effect = 'dilution';
  } else if (goal.penalty === 'contentCap') {
    // Бюджет на контент режется на полгода: инвесторы больше не верят в «мы
    // всё вложим в рост». Это ломает стратегию, которая работала до сих пор.
    state.restrictions = {
      contentCap: 140_000_000,
      until: month + CONFIG.boardCapMonths,
    };
    state.flags.valuationBonus -= 0.10;
    outcome.effect = 'contentCap';
  } else {
    state.flags.valuationBonus -= 0.15;
    outcome.effect = 'valuation';
  }
  return outcome;
}
