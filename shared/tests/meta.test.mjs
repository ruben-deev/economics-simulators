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
  LEGACY_GAMES, NOVOGRAD_WORTHY, META_BEST_KEY, legacyRatio, LEGACY_RATIO_CAP,
  resetEcosystemProgress, NOVOGRAD_SAVE_KEY,
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
  assert.equal(forDelivery.asset, false, 'финал КИНОРЕКИ не делает своим актив доставки');
  assert.equal(forDelivery.cinema, true, 'лицензия кино — от финала КИНОРЕКИ');
  assert.equal(forDelivery.tickets, false);
  assert.equal(forDelivery.assetScore, 0, 'чужой финал не переносит числа в ваш актив');
  const forStreaming = legacyFor('streaming');
  assert.equal(forStreaming.asset, true, 'стриминговому активу финал КИНОРЕКИ — свой');
});

test('в НОВОГРАД переносятся числа финала, а не только отметка «сыграно»', () => {
  store.clear();
  const g = LEGACY_GAMES.find((x) => x.assetId === 'delivery');
  // Крепкая победа — ровно порог: перенос по числам ещё нулевой
  addResultLine(line(g.tag, g.threshold));
  assert.equal(legacyRatio('delivery'), 1, 'крепкая победа — единица шкалы');
  assert.equal(legacyFor('delivery').assetScore, g.threshold, 'счёт финала доступен движку');

  // Победа вдвое крупнее порога переносит вдвое больше
  addResultLine(line(g.tag, g.threshold * 2));
  assert.equal(legacyRatio('delivery'), 2);

  // Сверху шкала срезана: рекордная прошлая партия не решает новую
  addResultLine(line(g.tag, g.threshold * 50));
  assert.equal(legacyRatio('delivery'), LEGACY_RATIO_CAP, 'перенос ограничен потолком');

  // Числа чужой игры в ваш актив не текут
  assert.equal(legacyRatio('tickets'), 0);
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

test('порог достойного финала приходит от актива, а не общий на всех', () => {
  store.clear();
  // Сложный стартовый актив: его потолок втрое ниже, поэтому НОВОГРАД
  // передаёт свой порог. Счёт ниже общего порога всё равно засчитывается.
  const hardWorthy = NOVOGRAD_WORTHY / 4;
  rememberNovogradResult(hardWorthy - 1, hardWorthy);
  assert.equal(conglomerateUnlocked(), false, 'ниже своего порога — не открыт');
  rememberNovogradResult(hardWorthy + 1, hardWorthy);
  assert.equal(conglomerateUnlocked(), true, 'выше своего порога — открыт');

  // Запись прошлой версии несла только счёт: заслуженный бейдж не пропадает
  store.clear();
  localStorage.setItem(META_BEST_KEY, JSON.stringify({ best: NOVOGRAD_WORTHY + 1 }));
  assert.equal(conglomerateUnlocked(), true, 'старая запись читается по общему порогу');
});

test('сброс экосистемного прогресса не трогает таблицы рекордов', () => {
  store.clear();
  const g = LEGACY_GAMES[0];
  // Заработанные рекорды игр и строка наследия, плюс сохранение НОВОГРАДА
  localStorage.setItem(g.recordsKey, JSON.stringify([{ score: g.threshold * 2 }]));
  addResultLine(line(g.tag, g.threshold * 2));
  rememberNovogradResult(5e9);
  localStorage.setItem(NOVOGRAD_SAVE_KEY, '{"state":{}}');
  assert.equal(legacyUnlocks().delivery, true);

  const cleared = resetEcosystemProgress();
  assert.ok(cleared.length >= 2, 'сброшены строки, лучший финал и сохранение');
  assert.equal(novogradBest(), 0, 'лучший финал НОВОГРАДА забыт');
  assert.equal(savedLines().length, 0, 'введённые строки наследия забыты');
  assert.equal(localStorage.getItem(NOVOGRAD_SAVE_KEY), null, 'партия НОВОГРАДА сброшена');
  assert.equal(conglomerateUnlocked(), false, 'обратный бонус закрыт заново');

  // А вот заработанное в самих играх остаётся
  assert.ok(localStorage.getItem(g.recordsKey), 'таблица рекордов игры цела');
  assert.equal(legacyUnlocks().delivery, true,
    'наследие из локального рекорда остаётся: игра-то сыграна');
});
