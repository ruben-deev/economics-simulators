// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'cinema',
  title: 'КИНОПОТОК · streaming economics simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки»: game.html там превращается в game-7.html
  // и не говорит ни о содержимом, ни о том, какая это из двух игр.
  output: 'dist/kinopotok-streaming-simulator.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/clone.js',
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
    '../../shared/charts.js',
    'src/ui/app.js',
  ],
  entry: 'init();',
};
