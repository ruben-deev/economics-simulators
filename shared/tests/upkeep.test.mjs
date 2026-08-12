// Стоимость построенного — одна механика на все три игры, проверяем её один раз.

import test from 'node:test';
import assert from 'node:assert/strict';
import { platformUpkeep, infraCost } from '../upkeep.js';

test('содержание пропорционально вложенному и не бывает отрицательным', () => {
  assert.equal(platformUpkeep(0, 0.01), 0);
  assert.equal(platformUpkeep(1_000_000, 0.01), 10_000);
  assert.equal(platformUpkeep(2_000_000, 0.01), 20_000);
  assert.equal(platformUpkeep(-5, 0.01), 0, 'отрицательный запас — это ноль, а не отрицательный счёт');
});

test('инфраструктура растёт с нагрузкой и дешевеет от технологий, но не до нуля', () => {
  assert.equal(infraCost(0, 3, 0), 0);
  assert.equal(infraCost(100, 3, 0), 300);
  assert.ok(infraCost(100, 3, 1) < infraCost(100, 3, 0), 'технологии удешевляют');
  assert.ok(infraCost(100, 3, 1) > 0, 'но не отменяют счёт полностью');
  assert.equal(infraCost(100, 3, 5), infraCost(100, 3, 1), 'уровень выше единицы ничего не добавляет');
  assert.ok(infraCost(200, 3, 0) === infraCost(100, 3, 0) * 2, 'линейно по нагрузке');
});
