// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'ecosystem',
  version: '1.27.14',
  title: 'НОВОГРАД · ecosystem economics simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки». {version} подставляется из поля version:
  // версии игр независимы, правка в других играх этот файл не переименовывает.
  output: 'dist/novograd-ecosystem-simulator-v{version}.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/clone.js',
    '../../shared/valuation.js',
    '../../shared/records.js',
    '../../shared/difficulty.js',
    '../../shared/finance.js',
    '../../shared/meta.js',
    '../../shared/leaderboard.js',
    '../../shared/rng.js',
    'src/model/config.js',
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
