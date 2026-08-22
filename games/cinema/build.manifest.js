// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'cinema',
  version: '1.26.1',
  title: 'КИНОРЕКА · streaming economics simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки»: game.html там превращается в game-7.html
  // и не говорит ни о содержимом, ни о том, какая это из двух игр.
  // {version} подставляется из поля version ниже. Версии игр независимы:
  // правка в кинотеатре не должна переименовывать файл доставки и делать вид,
  // что он тоже обновился.
  output: 'dist/kinoreka-streaming-simulator-v{version}.html',
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
    '../../shared/controls.js',
    '../../shared/meta.js',
    '../../shared/leaderboard.js',
    '../../shared/rng.js',
    'src/model/config.js',
    'src/model/market.js',
    'src/model/slate.js',
    'src/model/pricing.js',
    'src/model/partners.js',
    'src/model/rival.js',
    'src/model/board.js',
    'src/model/crises.js',
    'src/model/events.js',
    'src/model/engine.js',
    '../../shared/format.js',
    '../../shared/tables.js',
  '../../shared/sliders.js',
    '../../shared/charts.js',
    'src/ui/app.js',
  ],
  entry: 'init();',
};
