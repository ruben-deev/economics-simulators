// Манифест сборки одного файла. Пути — относительно каталога игры.
// Порядок модулей важен: зависимость идёт раньше того, кто её использует.

export default {
  name: 'tickets',
  title: 'БИЛЕТОН · ticketing marketplace simulator',
  html: 'index.html',
  // Имя понятное в папке «Загрузки»: game.html там превращается в game-7.html
  // и не говорит ни о содержимом, ни о том, какая это из игр.
  // {version} подставляется из package.json: по имени файла должно быть
  // видно, какая это сборка — иначе две присланные версии не различить.
  output: 'dist/bileton-ticketing-simulator-v{version}.html',
  css: ['../../shared/styles.css'],
  modules: [
    '../../shared/i18n.js',
    'src/strings.js',
    '../../shared/clone.js',
    '../../shared/rng.js',
    'src/model/config.js',
    'src/model/market.js',
    'src/model/supply.js',
    'src/model/demand.js',
    'src/model/channel.js',
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
