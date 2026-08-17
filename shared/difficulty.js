// ============================================================================
// Уровень сложности — настройка НАБОРА, а не отдельной игры.
//
// Выбранный уровень лежит в общем localStorage сайта и действует во всех
// четырёх симуляторах сразу: играть НОВОЕДУ на лёгком, а НОВОГРАД на сложном
// бессмысленно — это один курс, а не четыре разные игры.
//
// Механики на всех уровнях одинаковые. Меняется ровно одно: сколько стоит
// финансовая команда — та, что режет строку «прочие расходы», лучше
// упаковывает компанию к раунду и разбирает решения месяца. Всё остальное
// (город, рынок, события, цели совета) не подменяется: сложность меняет
// цену денег, а не правила.
//
//   лёгкий  — команда уже собрана и не стоит ничего: новичок видит игру,
//             а не её бухгалтерию;
//   обычный — команду покупают, и она дешёвая;
//   сложный — та же команда стоит вчетверо дороже, и её приходится
//             взвешивать против всего остального.
//
// Таблицы рекордов у каждого уровня свои: результаты, снятые при разной
// цене денег, несравнимы. Тег партии получает суффикс уровня (у обычного
// суффикса нет — так прежние рекорды остаются в своей таблице).
// ============================================================================

export const DIFFICULTY_KEY = 'series-difficulty';

export const DIFFICULTIES = [
  {
    id: 'easy',
    label: { ru: 'Лёгкий', en: 'Easy' },
    short: { ru: 'тренировка', en: 'training' },
    // Финансовая команда уже собрана и оплачена не игроком
    financeFree: true,
    // Множитель цены команды (см. финансовый блок конфига каждой игры)
    saturationMult: 1,
    // Множитель базовой ставки «прочих расходов»
    miscMult: 0.8,
    tagSuffix: '·лёгкий',
    note: {
      ru: 'Финансовая команда уже собрана и не стоит ничего: «прочие расходы» минимальны, отчётность полная, команда разбирает ваши решения. Так видно саму игру, а не её бухгалтерию.',
      en: 'The finance team is already in place and costs nothing: miscellaneous expenses are minimal, the reporting is complete and the team comments on your decisions. This shows you the game rather than its bookkeeping.',
    },
  },
  {
    id: 'normal',
    label: { ru: 'Обычный', en: 'Normal' },
    short: { ru: 'зачётный', en: 'ranked' },
    financeFree: false,
    saturationMult: 0.55,
    miscMult: 1,
    tagSuffix: '',
    note: {
      ru: 'Финансовую команду нанимаете вы, и она недорогая: половина силы примерно за 3% выручки в месяц. Основной уровень — на него рассчитан баланс, на нём играется общая таблица рекордов.',
      en: 'You hire the finance team yourself, and it is cheap: half its strength for roughly 3% of monthly revenue. The main level — the balance is built around it, and the shared leaderboard is played here.',
    },
  },
  {
    id: 'hard',
    label: { ru: 'Сложный', en: 'Hard' },
    short: { ru: 'вызов', en: 'challenge' },
    financeFree: false,
    saturationMult: 2.2,
    miscMult: 1.35,
    tagSuffix: '·сложный',
    note: {
      ru: 'Та же команда стоит вчетверо дороже, а «прочие расходы» выше на треть. Каждый рубль в финансы — рубль, не ушедший в маркетинг, качество и удержание.',
      en: 'The same team costs four times as much, and miscellaneous expenses run a third higher. Every rouble spent on finance is a rouble not spent on marketing, quality and retention.',
    },
  },
];

export const difficultyById = (id) => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

// Текущий уровень набора. Значение по умолчанию — зачётный: на нём игра
// откалибрована, и в него попадает всякий, кто ничего не выбирал.
export function currentDifficulty() {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    return saved ? difficultyById(saved).id : 'normal';
  } catch {
    return 'normal';
  }
}

export function setDifficulty(id) {
  const level = difficultyById(id).id;
  try { localStorage.setItem(DIFFICULTY_KEY, level); } catch { /* приватный режим */ }
  return level;
}

/**
 * Тег партии для строки результата и мировой таблицы: у каждого уровня своя
 * таблица. У обычного суффикса нет — прежние рекорды остаются на месте.
 */
export function taggedGame(base, id = currentDifficulty()) {
  return `${base}${difficultyById(id).tagSuffix}`;
}
