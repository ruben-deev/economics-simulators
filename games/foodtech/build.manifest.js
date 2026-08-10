// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'foodtech',
  title: 'НОВОЕДА · food delivery economics simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки»: game.html там превращается в game-7.html
  // и не говорит ни о содержимом, ни о том, какая это из двух игр.
  // {version} подставляется из package.json: по имени файла должно быть
  // видно, какая это сборка — иначе две присланные версии не различить.
  output: 'dist/novoeda-delivery-simulator-v{version}.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/clone.js',
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
