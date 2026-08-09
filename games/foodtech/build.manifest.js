// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'foodtech',
  title: 'НОВОЕДА · food delivery economics simulator',
  html: 'index.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/rng.js',
    'src/model/config.js',
    'src/model/weather.js',
    'src/model/events.js',
    'src/model/engine.js',
    '../../shared/format.js',
    '../../shared/charts.js',
    'src/ui/app.js',
  ],
  // Точка входа: вызывается после склейки модулей
  entry: 'init();',
};
