import test from 'node:test';
import assert from 'node:assert/strict';

import { DIFFICULTIES, difficultyById, taggedGame } from '../difficulty.js';
import {
  FINANCE_STRENGTH, financeMiscRate, financeSpend, financeRoundGain, financeStrength,
} from '../finance.js';

// Числа условной игры: форма механики общая, значения у игр свои
const CONF = { miscRateBase: 0.03, miscRateCut: 0.02, roundGain: 0.25 };

test('уровень сложности убран: он один и таблица рекордов одна', () => {
  assert.equal(DIFFICULTIES.length, 1, 'уровень остался ровно один');
  // Старые сейвы и уже отправленные рекорды приходят с прежними значениями —
  // любое из них должно разрешаться, а не ронять партию.
  for (const id of ['easy', 'normal', 'hard', 'нет такого', undefined]) {
    assert.equal(difficultyById(id).id, 'normal', `${id} разрешается в единственный уровень`);
    assert.equal(difficultyById(id).tagSuffix, '', 'суффикса у тега больше нет');
  }
  // Тег партии не получает суффикса: записи всех прежних уровней попадают
  // в одну таблицу, а не в три.
  assert.equal(taggedGame('КИНОРЕКА'), 'КИНОРЕКА');
});

test('прочие расходы: постоянная доля выручки, а не рычаг', () => {
  // Раньше строку резала сила нанятой команды. Замер показал, что при
  // сильной игре правильный ответ всегда «не нанимать», и рычаг убран:
  // служба зафиксирована на уровне нормально устроенной компании.
  assert.equal(FINANCE_STRENGTH, 0.5);
  assert.equal(financeStrength(), 0.5, 'сила не зависит ни от бюджета, ни от выручки');
  const rate = financeMiscRate(CONF);
  assert.ok(Math.abs(rate - (0.03 - 0.02 * 0.5)) < 1e-12,
    `ставка ровно посередине между конторой без службы и с полной: ${rate}`);
  assert.ok(rate < CONF.miscRateBase, 'и ниже, чем совсем без службы');
  assert.equal(financeMiscRate(CONF), financeMiscRate(CONF), 'и она постоянна');
});

test('нижний пол «прочих» уважается', () => {
  const rate = financeMiscRate({ miscRateBase: 0.01, miscRateCut: 0.09, miscFloor: 0.004 });
  assert.equal(rate, 0.004, 'ниже пола ставка не опускается');
});

test('игрок за службу отдельно не платит', () => {
  assert.equal(financeSpend(), 0, 'она внутри постоянных расходов');
  assert.ok(Math.abs(financeRoundGain(CONF) - (1 + 0.25 * 0.5)) < 1e-12,
    'упаковка к раунду соответствует постоянной силе службы');
});
