const commands = require("./playerCommands");

class PlayerCommands {
    constructor(server){
        this.server = server;
    }
    exec(socket, command){
        this.commands = new commands(this.server);
        this.commands.init();
        this.commands.exec(socket, command.split(" "));
    }
}

module.exports = PlayerCommands;