// Живое место в мировой таблице (lbLiveRank). Место, записанное при
// отправке, — снимок: «место 1» из пустой таблицы через месяц становится
// неправдой. Эти тесты фиксируют контракт пересчёта по свежему топу.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lbLiveRank } from '../leaderboard.js';

const top = (scores, total) => {
  const arr = scores.map((score, i) => ({ name: `p${i}`, score }));
  arr.total = total ?? arr.length;
  return arr;
};

test('счёт между строками топа получает место по числу строк лучше', () => {
  assert.deepEqual(lbLiveRank(top([100, 50, 10]), 60), { rank: 2, exact: true });
});

test('лучший счёт — место 1, даже если строка ещё не в таблице', () => {
  assert.deepEqual(lbLiveRank(top([100, 50]), 200), { rank: 1, exact: true });
});

test('равный счёт делит место с равным, а не встаёт после него', () => {
  assert.deepEqual(lbLiveRank(top([100, 50, 10]), 50), { rank: 2, exact: true });
});

test('хуже всех строк, но таблица загружена целиком — точное последнее место', () => {
  assert.deepEqual(lbLiveRank(top([100, 50], 2), 5), { rank: 3, exact: true });
});

test('хуже всех загруженных строк при более глубокой таблице — оценка «N+»', () => {
  assert.deepEqual(lbLiveRank(top([100, 50], 40), 5), { rank: 3, exact: false });
});

test('мусор на входе не роняет расчёт', () => {
  assert.equal(lbLiveRank(null, 5), null);
  assert.equal(lbLiveRank(top([100]), Number.NaN), null);
});
