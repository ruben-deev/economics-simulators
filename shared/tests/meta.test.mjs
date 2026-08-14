// Мета-прогрессия набора: строки результата, наследие, обратные бонусы.
// localStorage подменяется — тесты гоняются в node без браузера.

import test from 'node:test';
import assert from 'node:assert/strict';

// Подмена localStorage ДО импорта модуля: meta.js читает его лениво,
// но страховка от порядка импортов лишней не будет.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  parseResultLine, addResultLine, savedLines, legacyUnlocks, legacyFor,
  rememberNovogradResult, novogradBest, conglomerateUnlocked, tripleCrown,
  LEGACY_GAMES, NOVOGRAD_WORTHY,
} = await import('../meta.js');
const { resultString } = await import('../records.js');

const line = (tag, score) => resultString({ tag, version: '1.0.0', seed: 'мета', score, turns: 36 });

test('строка результата разбирается только с честной контрольной суммой', () => {
  const ok = line('НОВОЕДА', 2_000_000_000);
  const parsed = parseResultLine(ok);
  assert.equal(parsed.tag, 'НОВОЕДА');
  assert.equal(parsed.score, 2_000_000_000);
  assert.equal(parseResultLine(ok.replace('2000000000', '9000000000')), null,
    'подделанный счёт не проходит проверку суммы');
  assert.equal(parseResultLine('мусор'), null);
});

test('введённые строки открывают наследие, пороги — грейд «крепкий»', () => {
  store.clear();
  let unlocks = legacyUnlocks();
  assert.deepEqual(unlocks, { delivery: false, streaming: false, tickets: false });

  // Слабый финал не открывает
  addResultLine(line('НОВОЕДА', 5e8));
  assert.equal(legacyUnlocks().delivery, false, 'ниже порога — не считается');

  addResultLine(line('НОВОЕДА', 1.5e9));
  addResultLine(line('КИНОРЕКА', 4e10));
  assert.deepEqual(legacyUnlocks(), { delivery: true, streaming: true, tickets: false });
  assert.equal(tripleCrown(), false, 'короны нет без третьей игры');

  addResultLine(line('БИЛЕТВИЛЬ', 5e9));
  assert.equal(tripleCrown(), true);
  assert.equal(savedLines().length, 4);

  // Дубли не копятся
  addResultLine(line('БИЛЕТВИЛЬ', 5e9));
  assert.equal(savedLines().length, 4);
});

test('локальные рекорды старых игр открывают наследие сами', () => {
  store.clear();
  const g = LEGACY_GAMES[0];
  store.set(g.recordsKey, JSON.stringify([{ score: g.threshold + 1, outcome: 'finished' }]));
  assert.equal(legacyUnlocks().delivery, true);
});

test('legacyFor: свой актив — только от своей игры, лицензия и партнёрство — всегда', () => {
  store.clear();
  addResultLine(line('КИНОРЕКА', 4e10));
  const forDelivery = legacyFor('delivery');
  assert.deepEqual(forDelivery, { asset: false, cinema: true, tickets: false });
  const forStreaming = legacyFor('streaming');
  assert.equal(forStreaming.asset, true, 'стриминговому активу финал КИНОРЕКИ — свой');
});

test('обратный бонус открывается достойным финалом НОВОГРАДА', () => {
  store.clear();
  assert.equal(conglomerateUnlocked(), false);
  rememberNovogradResult(NOVOGRAD_WORTHY - 1);
  assert.equal(conglomerateUnlocked(), false);
  rememberNovogradResult(NOVOGRAD_WORTHY + 1);
  assert.equal(conglomerateUnlocked(), true);
  assert.equal(novogradBest(), NOVOGRAD_WORTHY + 1);
  // Худший результат не затирает лучший
  rememberNovogradResult(1);
  assert.equal(novogradBest(), NOVOGRAD_WORTHY + 1);
});
