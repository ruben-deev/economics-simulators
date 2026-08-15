import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIFFICULTIES, difficultyById, taggedGame, DIFFICULTY_KEY,
} from '../difficulty.js';
import {
  financeHalfCost, financeStrength, financeMiscRate, financeSpend, financeRoundGain,
} from '../finance.js';

// Числа условной игры: форма механики общая, значения у игр свои
const CONF = {
  saturationShare: 0.05,
  saturationFloor: 1_000_000,
  miscRateBase: 0.03,
  miscRateCut: 0.02,
  roundGain: 0.25,
};

test('уровни сложности: порядок и отдельные таблицы рекордов', () => {
  assert.deepEqual(DIFFICULTIES.map((d) => d.id), ['easy', 'normal', 'hard']);
  // Зачётный уровень без суффикса: прежние рекорды остаются в своих таблицах
  assert.equal(difficultyById('normal').tagSuffix, '');
  const suffixes = DIFFICULTIES.map((d) => d.tagSuffix);
  assert.equal(new Set(suffixes).size, 3, 'у каждого уровня своя таблица');
  assert.equal(taggedGame('НОВОЕДА', 'normal'), 'НОВОЕДА');
  assert.equal(taggedGame('НОВОЕДА', 'hard'), 'НОВОЕДА·сложный');
  assert.equal(taggedGame('НОВОГРАД+', 'easy'), 'НОВОГРАД+·лёгкий');
  // Неизвестный уровень — зачётный: испорченное хранилище не ломает игру
  assert.equal(difficultyById(undefined).id, 'normal');
  assert.equal(difficultyById('чужое').id, 'normal');
  assert.equal(DIFFICULTY_KEY, 'series-difficulty');

  // Сложность дороже, а «прочие расходы» выше — по возрастанию уровня
  assert.ok(difficultyById('easy').financeFree);
  assert.ok(!difficultyById('normal').financeFree);
  assert.ok(difficultyById('normal').saturationMult < difficultyById('hard').saturationMult);
  assert.ok(difficultyById('easy').miscMult < difficultyById('normal').miscMult);
  assert.ok(difficultyById('normal').miscMult < difficultyById('hard').miscMult);
});

test('финансовая команда: цена растёт с выручкой, сила насыщается', () => {
  const revenue = 100_000_000;
  const half = financeHalfCost(CONF, 'normal', revenue);
  assert.ok(Math.abs(half - revenue * 0.05 * 0.55) < 1e-6, 'половина силы — доля выручки');
  assert.ok(financeHalfCost(CONF, 'normal', revenue * 2) > half, 'крупной компании служба дороже');
  assert.equal(financeHalfCost(CONF, 'normal', 0), CONF.saturationFloor * 0.55,
    'у совсем маленькой выручки работает пол');
  assert.ok(financeHalfCost(CONF, 'hard', revenue) > financeHalfCost(CONF, 'normal', revenue));

  assert.equal(financeStrength(CONF, 'normal', revenue, 0), 0);
  assert.ok(Math.abs(financeStrength(CONF, 'normal', revenue, half) - 0.5) < 1e-9);
  assert.ok(financeStrength(CONF, 'normal', revenue, half * 100) < 1, 'полной силы не купить');
  assert.equal(financeStrength(CONF, 'easy', revenue, 0), 1, 'на лёгком команда уже собрана');
});

test('прочие расходы и раунд: что именно чинит команда', () => {
  assert.ok(financeMiscRate(CONF, 'normal', 0) > financeMiscRate(CONF, 'normal', 1));
  assert.ok(financeMiscRate(CONF, 'hard', 0) > financeMiscRate(CONF, 'normal', 0));
  assert.ok(financeMiscRate(CONF, 'easy', 1) >= 0.005, 'ставка не уходит в ноль');

  assert.equal(financeSpend('easy', 5_000_000), 0, 'на лёгком команду содержит не игрок');
  assert.equal(financeSpend('normal', 5_000_000), 5_000_000);

  assert.equal(financeRoundGain(CONF, 0), 1);
  assert.ok(Math.abs(financeRoundGain(CONF, 1) - 1.25) < 1e-9);
  // Конфиг без упаковки к раунду не ломается
  assert.equal(financeRoundGain({}, 1), 1);
});
