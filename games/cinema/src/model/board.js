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
    const total = yourSubs + rivalSubs;
    return {
      year,
      // Второй год — год экспансии: каталог собран, конвейер работает,
      // рынок делится именно сейчас. Цель — доля дуополии.
      // Аудит 2026-08 поменял цели годов 2 и 3 местами: прежняя цель
      // «3 прибыльных месяца во втором году» умерла вместе с ростом
      // постоянки и пересборкой спроса — у ДОВЕДЁННЫХ опор ноль прибыльных
      // месяцев в году 2 на 72 партиях, а цель, которую не берёт никто,
      // учит тому же, что цель, которую берут все. Прибыльность же честно
      // живёт в третьем годе (harvest) — туда она и переехала.
      // Планка 0.52 — между медианой (0.49) и 90-м процентилем (0.60)
      // доли доведённых опор на 24-м месяце.
      type: GOAL_TYPES.share,
      target: 0.52,
      subsFloor: Math.round(Math.max(2_000_000, yourSubs * 1.05)),
      reward: 0.12,
      penalty: 'contentCap',
      startShare: total > 0 ? yourSubs / total : 0.5,
    };
  }
  return {
    year,
    // Третий год — год обороны и жатвы: права истекают, конкурент делает
    // последний рывок, база неизбежно тает (у доведённых опор остаётся
    // 55–65% от пика). Цель — впервые заработать: минимум 2 прибыльных
    // месяца, и не ценой базы — удержать хотя бы 55% (медиана опор 60%,
    // 25-й процентиль 57%). Берут её ~36% партий доведённых опор —
    // сознательно самая жёсткая цель партии, но живая.
    type: GOAL_TYPES.profit,
    target: 2,
    subsFloor: Math.round(Math.max(2_500_000, yourSubs * 0.55)),
    reward: 0.18,
    penalty: 'valuation',
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
