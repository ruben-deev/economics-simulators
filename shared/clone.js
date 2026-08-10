// Глубокий клон состояния — своими руками, а не structuredClone.
//
// structuredClone появился в Safari только в 15.4 (март 2022). На сборках
// постарше его просто нет, и игра падала на первой же строке createInitialState:
// пользователь видел пустую страницу и «не стартует». Никакой другой API в коде
// не требует браузера новее 2021 года, так что одна эта функция стоила игре
// целого класса машин.
//
// Состояние игры — только простые данные: объекты, массивы, числа, строки,
// булевы и null. Ни Map, ни Set, ни Date в нём нет и быть не должно: состояние
// уезжает в localStorage через JSON и обратно, а JSON их всё равно не переживёт.
export function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) out[i] = deepClone(value[i]);
    return out;
  }
  const out = {};
  for (const key of Object.keys(value)) out[key] = deepClone(value[key]);
  return out;
}
