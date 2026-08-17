// Оценка компании — одна механика на все три игры, проверяем её один раз.
//
// Два правила, ради которых этот модуль и появился: последний ход нельзя
// купить, и сжатие должно стоить денег.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  windowAvg, windowGrowth, windowGrowthStable, revenueMultiple, roundTerms,
} from '../valuation.js';

const hist = (values) => values.map((v) => ({ revenue: v }));

test('окно усредняет, а не берёт последний ход', () => {
  const h = hist([100, 100, 100, 100, 100, 1000]);
  assert.equal(windowAvg(h, 6, (r) => r.revenue), 250);
  assert.equal(windowAvg(h, 1, (r) => r.revenue), 1000, 'окно в один ход — это и есть последний ход');
  assert.equal(windowAvg([], 6, (r) => r.revenue), 0, 'пустая история — ноль, а не деление на ноль');
});

test('рывок в последний ход почти не двигает окно', () => {
  const ровно = hist([100, 100, 100, 100, 100, 100]);
  const срывком = hist([100, 100, 100, 100, 100, 400]);
  const базово = windowAvg(ровно, 6, (r) => r.revenue);
  const срывка = windowAvg(срывком, 6, (r) => r.revenue);
  // Учетверить выручку в последний месяц — это плюс половина к окну,
  // а не вчетверо, как было бы при расчёте по последнему ходу.
  assert.ok(срывка / базово < 1.6, `рывок дал ×${(срывка / базово).toFixed(2)}`);
});

test('темп роста считает окно против предыдущего окна', () => {
  const растущий = hist([10, 10, 20, 20]);
  assert.equal(windowGrowth(растущий, 2, (r) => r.revenue), 1, 'удвоение — это плюс сто процентов');
  const ровный = hist([10, 10, 10, 10]);
  assert.equal(windowGrowth(ровный, 2, (r) => r.revenue), 0);
  const падающий = hist([20, 20, 10, 10]);
  assert.equal(windowGrowth(падающий, 2, (r) => r.revenue), -0.5);
});

test('без истории на два окна рост не выдумывается', () => {
  assert.equal(windowGrowth(hist([10, 10]), 2, (r) => r.revenue, 0.3), 0.3, 'возвращается заявленный запасной');
  assert.equal(windowGrowth([], 2, (r) => r.revenue, 0.3), 0, 'а если и выручки нет — ноль');
});

test('устойчивый рост верит короткому окну лишь с подтверждением длинного', () => {
  // Ступенька: выручка удвоилась прямо в свежем окне. Короткое окно
  // (2 против 2) читает её как +100% роста, длинное (4 против 4) — вдвое.
  const ступенька = hist([10, 10, 10, 10, 10, 10, 20, 20]);
  const короткое = windowGrowth(ступенька, 2, (r) => r.revenue);
  const устойчивое = windowGrowthStable(ступенька, 2, (r) => r.revenue);
  assert.ok(устойчивое < короткое,
    `ступенька в коротком окне ${короткое}, в устойчивом ${устойчивое}`);

  // Настоящий устойчивый рост показывает один темп в обоих окнах — не теряет
  const ровныйРост = hist([10, 11, 12, 13, 14, 15, 17, 18]);
  const к = windowGrowth(ровныйРост, 2, (r) => r.revenue);
  const у = windowGrowthStable(ровныйРост, 2, (r) => r.revenue);
  assert.ok(Math.abs(к - у) < 0.06, `устойчивый рост почти не штрафуется: ${к} против ${у}`);

  // Падение видно по худшему окну: сжатие замечается сразу
  const обвал = hist([20, 20, 20, 20, 20, 20, 10, 10]);
  assert.ok(windowGrowthStable(обвал, 2, (r) => r.revenue)
    <= windowGrowth(обвал, 2, (r) => r.revenue) + 1e-9);

  // Пока истории на длинное окно нет — работает короткое
  assert.equal(
    windowGrowthStable(hist([10, 10, 20, 20]), 2, (r) => r.revenue),
    windowGrowth(hist([10, 10, 20, 20]), 2, (r) => r.revenue));
});

test('за сжатие платят меньший множитель, и это правило общее', () => {
  const k = { base: 2, growthWeight: 5, marginWeight: 4, marginPenalty: 1.5 };
  const рост = revenueMultiple(0.4, 0.2, k);
  const покой = revenueMultiple(0, 0.2, k);
  const сжатие = revenueMultiple(-0.4, 0.2, k);
  assert.ok(рост > покой, 'растущий стоит дороже стоящего');
  assert.ok(сжатие < покой, 'сжимающийся — дешевле; иначе жадность бесплатна');
  assert.ok(revenueMultiple(-5, 0.2, k) >= 0.5, 'множитель не уходит ниже пола');
});

test('маржа тянет вверх до предела, а убыток — вниз', () => {
  const k = { base: 2, growthWeight: 5, marginWeight: 4, marginPenalty: 1.5 };
  assert.ok(revenueMultiple(0, 0.25, k) > revenueMultiple(0, 0.05, k));
  assert.ok(revenueMultiple(0, -0.3, k) < revenueMultiple(0, 0, k));
  assert.equal(revenueMultiple(0, 0.9, k), revenueMultiple(0, 0.25, k),
    'выше потолка маржа ничего не добавляет');
});

test('у раунда есть пол под оценкой и потолок на долю', () => {
  // Компания на третьей неделе стоит копейки — но за раунд не отдают всё
  const ранний = roundTerms(1_000_000, 120_000_000, { floor: 250_000_000 });
  assert.equal(ранний.pre, 250_000_000, 'ниже пола оценка не опускается');
  assert.ok(ранний.dilution < 0.4, `ранний раунд не должен стоить компании: ${ранний.dilution}`);

  const огромный = roundTerms(1_000_000, 100_000_000_000, { floor: 250_000_000 });
  assert.equal(огромный.dilution, 0.75, 'потолок на долю держит даже при безумном чеке');

  const крошечный = roundTerms(50_000_000_000, 1_000, { floor: 250_000_000 });
  assert.equal(крошечный.dilution, 0.02, 'и пол снизу тоже есть: раунд не бывает бесплатным');
});

test('чем дороже компания, тем дешевле ей деньги', () => {
  const бедный = roundTerms(1_000_000_000, 400_000_000, { floor: 200_000_000 });
  const богатый = roundTerms(9_000_000_000, 400_000_000, { floor: 200_000_000 });
  assert.ok(богатый.dilution < бедный.dilution,
    `${богатый.dilution.toFixed(3)} против ${бедный.dilution.toFixed(3)}`);
});
