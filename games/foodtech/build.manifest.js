// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'foodtech',
  version: '1.24.7',
  title: 'НОВОЕДА · food delivery economics simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки»: game.html там превращается в game-7.html
  // и не говорит ни о содержимом, ни о том, какая это из двух игр.
  // {version} подставляется из поля version ниже. Версии игр независимы:
  // правка в кинотеатре не должна переименовывать файл доставки и делать вид,
  // что он тоже обновился.
  output: 'dist/novoeda-delivery-simulator-v{version}.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/clone.js',
    '../../shared/upkeep.js',
    '../../shared/valuation.js',
    '../../shared/records.js',
    '../../shared/difficulty.js',
    '../../shared/finance.js',
    '../../shared/meta.js',
    '../../shared/leaderboard.js',
    '../../shared/rng.js',
    'src/model/config.js',
    'src/model/weather.js',
    'src/model/board.js',
    'src/model/events.js',
    'src/model/engine.js',
    '../../shared/format.js',
    '../../shared/tables.js',
  '../../shared/sliders.js',
    '../../shared/charts.js',
    '../../shared/challenge.js',
    '../../shared/metrics.js',
    '../../shared/sharecard.js',
    'src/ui/app.js',
  ],
  // Точка входа: вызывается после склейки модулей
  entry: 'init();',
};
