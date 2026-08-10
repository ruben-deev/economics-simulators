// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'cinema',
  title: 'КИНОПОТОК · streaming economics simulator',
  html: 'index.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/rng.js',
    'src/model/config.js',
    'src/model/market.js',
    'src/model/slate.js',
    'src/model/pricing.js',
    'src/model/rival.js',
    'src/model/board.js',
    'src/model/crises.js',
    'src/model/events.js',
    'src/model/engine.js',
    '../../shared/format.js',
    '../../shared/charts.js',
    'src/ui/app.js',
  ],
  entry: 'init();',
};
