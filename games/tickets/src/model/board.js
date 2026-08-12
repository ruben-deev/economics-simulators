// ============================================================================
// Совет акционеров: цели на год и последствия их провала.
//
// Одна цель на всю партию позволила бы выбрать стратегию на первом ходу и
// больше к ней не возвращаться. Здесь цели тянут в разные стороны и заставляют
// пересобирать план:
//
//   первый год  — оборот: покажите, что через вас вообще покупают;
//   второй год  — выручка и прибыль: оборот чужой, выручка ваша;
//   третий год  — доля организаторов: рынок делится не билетами, а договорами.
//
// Стратегия, выигрывающая первый год (низкие ставки ради оборота), проваливает
// второй. Это и есть смысл: take rate — не настройка, а решение на год.
// ============================================================================

import { CONFIG } from './config.js';

export const GOAL_TYPES = {
  gmv: 'gmv',         // оборот за последний месяц года
  revenue: 'revenue', // выручка и прибыльные месяцы
  share: 'share',     // доля организаторов против конкурента
};

export function makeGoal(year, state, yourOrgs, rivalOrgs) {
  if (year === 1) {
    return {
      year,
      type: GOAL_TYPES.gmv,
      target: 520_000_000,     // оборот за месяц к концу первого года
      reward: 0.10,
      penalty: 'dilution',
    };
  }
  if (year === 2) {
    return {
      year,
      type: GOAL_TYPES.revenue,
      target: 3,               // прибыльных месяцев из двенадцати
      gmvFloor: 700_000_000,
      reward: 0.13,
      penalty: 'marketingCap',
    };
  }
  const total = yourOrgs + rivalOrgs;
  return {
    year,
    type: GOAL_TYPES.share,
    target: 0.30,
    orgFloor: Math.round(Math.max(420, yourOrgs * 1.15)),
    reward: 0.18,
    penalty: 'valuation',
    startShare: total > 0 ? yourOrgs / total : 0.5,
  };
}

export function goalProgress(goal, ctx) {
  if (!goal) return null;
  const { gmv, profitableMonths, orgs, rivalOrgs } = ctx;
  if (goal.type === GOAL_TYPES.gmv) {
    return { value: gmv, target: goal.target, done: gmv >= goal.target };
  }
  if (goal.type === GOAL_TYPES.revenue) {
    return {
      value: profitableMonths,
      target: goal.target,
      gmv,
      gmvFloor: goal.gmvFloor,
      done: profitableMonths >= goal.target && gmv >= goal.gmvFloor,
    };
  }
  const total = orgs + rivalOrgs;
  const share = total > 0 ? orgs / total : 0;
  return {
    value: share,
    target: goal.target,
    orgs,
    orgFloor: goal.orgFloor,
    done: share >= goal.target && orgs >= goal.orgFloor,
  };
}

/**
 * Провал не заканчивает партию — он делает следующий год труднее.
 * Именно поэтому стратегию приходится пересобирать, а не начинать заново.
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
    state.pendingDilution = 0.18;
    outcome.effect = 'dilution';
  } else if (goal.penalty === 'marketingCap') {
    // Маркетинг режут на полгода: акционеры больше не верят в «купим охват».
    // Это ломает ровно ту стратегию, которая работала до сих пор.
    state.restrictions = {
      marketingCap: 55_000_000,
      until: month + CONFIG.boardCapMonths,
    };
    state.flags.valuationBonus -= 0.10;
    outcome.effect = 'marketingCap';
  } else {
    state.flags.valuationBonus -= 0.15;
    outcome.effect = 'valuation';
  }
  return outcome;
}
