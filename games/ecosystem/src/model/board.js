// ============================================================================
// Совет директоров холдинга: цель на год и последствия её провала.
//
// Три цели повторяют путь настоящих экосистем и тянут в разные стороны:
//
//   первый год  — вторая нога: покажите, что вы умеете не только еду;
//   второй год  — склейка: клиенты должны пользоваться НЕСКОЛЬКИМИ сервисами,
//                 иначе это не экосистема, а два бизнеса под одной вывеской;
//   третий год  — прибыльная экосистема, а не зоопарк: инвесторы хотят видеть
//                 деньги, и не ценой растерянной базы.
//
// Стратегия, выигрывающая первый год (рост такси любой ценой), проваливает
// третий. Это и есть смысл: экспансия — решение с ценой, а не путь по стрелке.
//
// Планки выставлены замером опорных стратегий (см. HANDOFF: цели вида
// «N прибыльных месяцев» нельзя калибровать случайными стратегиями —
// прибыльность бинарный порог качества).
// ============================================================================

import { CONFIG, assetById } from './config.js';

const clampNum = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const GOAL_TYPES = {
  secondLeg: 'secondLeg',   // клиенты новой вертикали к концу года
  glue: 'glue',             // доля клиентов с двумя и более сервисами
  profit: 'profit',         // прибыльные месяцы, база не сжимается
};

export function makeGoal(year, state, uniqueUsers) {
  if (year === 1) {
    // Планка масштабируется базой стартового актива: у маленького хаба
    // (билеты) пул кросс-селла меньше, и та же вторая нога растёт медленнее.
    // Замер по доведённым опорам с доставкой (база 210 тыс): средняя даёт
    // ~105 тыс, размашистая ~128 тыс, выжидательная с запуском на 8-м
    // месяце — ~46 тыс и цель проваливает.
    const asset = assetById(state.assetId);
    const target = Math.round(clampNum(asset.users * 0.29, 28_000, 60_000) / 1000) * 1000;
    return {
      year,
      type: GOAL_TYPES.secondLeg,
      target,
      reward: 0.10,
      penalty: 'dilution',
    };
  }
  if (year === 2) {
    const asset = assetById(state.assetId);
    return {
      year,
      type: GOAL_TYPES.glue,
      // Доля клиентов, пользующихся двумя и более сервисами холдинга.
      // Это и есть замеряемый кросс-селл — то, за что инвестор платит премию.
      // Замер: доведённые опоры к 24-му месяцу дают 29–31%, стратегия без
      // кросс-селла — считаные проценты. Планка 20% отделяет работающую
      // склейку от двух бизнесов под одной вывеской.
      target: 0.20,
      // И не ценой хаба: сжать стартовый актив ради красивой доли нельзя.
      // Пол масштабируется базой актива — у билетов он в разы ниже.
      uniqueFloor: Math.round(Math.max(asset.users * 0.85, uniqueUsers * 0.9)),
      reward: 0.13,
      penalty: 'marketingCap',
    };
  }
  const asset = assetById(state.assetId);
  return {
    year,
    type: GOAL_TYPES.profit,
    // Прибыльных месяцев из двенадцати. Замер: доведённые опоры закрывают
    // в плюс все двенадцать; планка 7 оставляет буфер на событийные месяцы,
    // но отделяет работающую экосистему от вечно инвестирующей.
    // Калибровать такие цели случайными стратегиями нельзя: прибыльность —
    // бинарный порог качества (см. HANDOFF).
    target: 7,
    uniqueFloor: Math.round(Math.max(asset.users * 0.9, uniqueUsers * 0.95)),
    reward: 0.18,
    penalty: 'valuation',
  };
}

/** Текущий прогресс — показывается каждый месяц, а не только в конце года. */
export function goalProgress(goal, ctx) {
  if (!goal) return null;
  const { taxiUsers, multiShare, profitableMonths, uniqueUsers } = ctx;
  if (goal.type === GOAL_TYPES.secondLeg) {
    return { value: taxiUsers, target: goal.target, done: taxiUsers >= goal.target };
  }
  if (goal.type === GOAL_TYPES.glue) {
    return {
      value: multiShare,
      target: goal.target,
      unique: uniqueUsers,
      uniqueFloor: goal.uniqueFloor,
      done: multiShare >= goal.target && uniqueUsers >= goal.uniqueFloor,
    };
  }
  return {
    value: profitableMonths,
    target: goal.target,
    unique: uniqueUsers,
    uniqueFloor: goal.uniqueFloor,
    done: profitableMonths >= goal.target && uniqueUsers >= goal.uniqueFloor,
  };
}

/**
 * Провал не заканчивает партию — он делает следующий год труднее.
 * Именно поэтому план приходится пересобирать, а не начинать заново.
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
    // Акционеры вводят деньги сами и на своих условиях
    state.pendingDilution = 0.15;
    outcome.effect = 'dilution';
  } else if (goal.penalty === 'marketingCap') {
    // Бюджеты привлечения режут на полгода: совет больше не верит в «купим рост»
    state.restrictions = {
      marketingCap: CONFIG.boardMarketingCap,
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
