// ============================================================================
// Финансовая команда — общая механика набора.
//
// Единственный рычаг всех четырёх игр, который управляет не бизнесом, а тем,
// как бизнес считают и показывают. Слабая финансовая служба стоит денег
// молча: эквайринг по невыгодной ставке, комиссии, списания, штрафы,
// неразнесённая административка. Это строка «прочие расходы» — она растёт
// сама, вместе с выручкой, и её режет не бизнес-решение, а служба.
//
// Сильная команда, помимо этой строки: лучше упаковывает компанию к раунду
// (оценку считает рынок — упаковка меняет только отдаваемую долю), делает
// читаемым разбор оценки и разбирает решения периода.
//
// Цена команды считается ДОЛЕЙ выручки, а не абсолютом: финансовая служба
// растёт вместе с компанией. Первый замер с фиксированной ценой показал
// мёртвый рычаг у маленького бизнеса — его не окупало ничто.
//
// Числа (доля выручки, ставка «прочих») у каждой игры свои и живут в её
// конфиге: у доставки, стриминга и билетов разные выручки и маржи. Общей
// остаётся форма механики и множители уровня сложности.
//
// conf = { saturationShare, saturationFloor, miscRateBase, miscRateCut,
//          roundGain?, transparencyAt?, adviceAt? }
// ============================================================================

import { difficultyById } from './difficulty.js';

// Сколько стоит «половина силы» при текущем размере бизнеса
export function financeHalfCost(conf, difficulty, revenue) {
  const d = difficultyById(difficulty);
  return Math.max(conf.saturationFloor, (Number(revenue) || 0) * conf.saturationShare)
    * d.saturationMult;
}

// Сила команды, 0…1. На лёгком уровне команда уже собрана и стоит ноль.
export function financeStrength(conf, difficulty, revenue, budget) {
  if (difficultyById(difficulty).financeFree) return 1;
  const b = Number(budget) || 0;
  return b > 0 ? b / (b + financeHalfCost(conf, difficulty, revenue)) : 0;
}

// Доля выручки, уходящая «прочими расходами» при такой силе команды
export function financeMiscRate(conf, difficulty, strength) {
  const d = difficultyById(difficulty);
  return Math.max(
    conf.miscFloor ?? 0.005,
    conf.miscRateBase * (d.miscMult ?? 1) - conf.miscRateCut * strength,
  );
}

// Что за команду платит игрок: на лёгком уровне её содержит не он
export function financeSpend(difficulty, budget) {
  return difficultyById(difficulty).financeFree ? 0 : (Number(budget) || 0);
}

// Насколько лучше компания упакована к раунду
export function financeRoundGain(conf, strength) {
  return 1 + (conf.roundGain ?? 0) * strength;
}
