// Валюта показа. Проверяется главное свойство: модель остаётся рублёвой, а
// пересчёт живёт только в форматировании — иначе одна и та же партия давала
// бы разный счёт на разных языках, и мировая таблица потеряла бы смысл.
import test from 'node:test';
import assert from 'node:assert/strict';

import { setLang, t, setStrings, curSymbol, currency } from '../i18n.js';
import { money, moneyExact, amount, amountIn, cash, isCurUnit, num } from '../format.js';

setStrings({
  label: { ru: 'ARPU, {cur}', en: 'ARPU, {cur}' },
  plain: { ru: 'без валюты', en: 'no currency' },
});

test('русская версия считает и показывает рубли один к одному', () => {
  setLang('ru');
  assert.equal(currency().rate, 1);
  assert.equal(cash(149), 149, 'рублёвая величина не пересчитывается');
  assert.equal(money(5_500_000_000), '5.50 млрд ₽');
  assert.equal(amount(149), '149 ₽');
  assert.equal(amount(22), '22 ₽', 'копеек в интерфейсе нет');
  assert.equal(t('label'), 'ARPU, ₽');
});

test('английская версия показывает доллары по зафиксированному курсу', () => {
  setLang('en');
  assert.equal(currency().rate, 100, 'курс — круглый: 100 ₽ = $1');
  assert.equal(curSymbol(), '$');
  assert.equal(cash(149), 1.49);
  assert.equal(money(5_500_000_000), '$55.0M');
  assert.equal(money(-1_500_000), '−$15,000', 'минус типографский, знак валюты после него');
  assert.equal(amount(149), '$1.49', 'ставка не схлопывается в ноль');
  assert.equal(amount(3800), '$38', 'а крупная сумма не обрастает копейками');
  assert.equal(moneyExact(220_000_000), '$2,200,000');
  assert.equal(t('label'), 'ARPU, $');
});

test('единица рычага теряет чужой знак валюты, но сохраняет хвост', () => {
  assert.equal(isCurUnit('₽/нед'), true);
  assert.equal(isCurUnit('$/wk'), true);
  assert.equal(isCurUnit('чел'), false);
  setLang('ru');
  // Разряды разделяет неразрывный пробел локали — сверяем с ним же
  assert.equal(amountIn(600_000, '₽/нед'), `${num(600_000)} ₽/нед`);
  setLang('en');
  assert.equal(amountIn(600_000, '$/wk'), '$6,000/wk', 'знак валюты один, а не два');
});

test('строка без {cur} не трогается, а не-денежные числа не пересчитываются', () => {
  setLang('en');
  assert.equal(t('plain'), 'no currency');
  assert.equal(num(195_500), '195,500', 'клиенты остаются клиентами');
  setLang('ru');
});
