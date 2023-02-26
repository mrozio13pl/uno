const GameServer = require('./server');
const Console = require('./modules/commands/console');

var server = new GameServer();
server.main();