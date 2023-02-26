const Logger = require('../logger/logger');
const commands = require('./consoleCommands');

let log = new Logger();

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function prompt(){
    rl.question("", res => {
        prompt();
        var args = res.split(" ");
        var command = commands[args[0]];
        if(!args[0]) return;
        if(!command) return log.error("Command not found!");
        command(args);
    });
}

prompt();