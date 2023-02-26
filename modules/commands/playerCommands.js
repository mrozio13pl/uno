const Logger = require('../logger/logger');
const userLevels = require("../user/userLevels");
const userRoles = require("../user/userRoles");

let log = new Logger();

class Commands {
    constructor(server) {
        this.list = {};
        this.server = server;
    }
    command = (name, permission, description, executor) => {
        this.list[name] = executor;
        this.list[name].displayName = name;
        this.list[name].permissionLevel = permission;
        this.list[name].permissionLevelName = Object.keys(userLevels).find(key => userLevels[key] === permission);
        this.list[name].description = description;
    }
    init = function(){
        this.command("help", userLevels.GUEST, "Provides help for commands.", (socket, args) => {
            const player = this.server.players.filter(player => player.id === socket.id)[0];
            let requestedCommand = this.list[args[1]];
            if(!requestedCommand) {
                this.server.sendTo(socket, "Avainable commands:");
                Object.keys(this.list).forEach(name => {
                    const command = this.list[name];
                    if(command.permissionLevel > player.permissionLevel) return;
                    this.server.sendTo(socket, '/' + command.displayName + (command.permissionLevel ? ' [' + command.permissionLevelName + ']' : "") + ' - ' + command.description);
                })
            }
            else if(requestedCommand && requestedCommand.permissionLevel <= player.permissionLevel){
                this.server.sendTo(socket, '/' + requestedCommand.displayName + (requestedCommand.permissionLevel ? ' [' + requestedCommand.permissionLevelName + ']' : "") + ' - ' + requestedCommand.description);
            }
        })
        this.command("id", userLevels.GUEST, "Gives your ID", (socket, args) => {
            const player = this.server.data(socket).player;
            if(player) this.server.sendTo(socket, `Your ID is ${player.publicID}`);
            else this.server.sendTo(socket, "Unknown ID");
        })
        this.command("login", userLevels.GUEST, "Applies permissions.", (socket, args) => {
            const password = args[1];
            const roles = Object.values(userRoles);
            for(let i = 0; i < roles.length; i++)
                if(roles[i].password === password){
                    const data = this.server.data(socket);
                    if(data.player.permissionLevel >= roles[i].level) return this.server.sendTo(socket, "You are already logged in!");
                    let role = Object.keys(userLevels).find(key => userRoles[key] === roles[i])
                    this.server.sendTo(socket, `Logged as ${role}.`);
                    log.warn(`\x1b[32m${data.player.nickname}\x1b[0m logged as \x1b[33m${role}\x1b[0m in \x1b[35m${data.room.roomID}\x1b[0m \x1b[90m(${socket._socket.address().address})\x1b[0m`);
                    data.player.permissionLevel = roles[i].level;
                    return;
                }
            this.server.sendTo(socket, "Couldn't log in!");
        })
        this.command("logout", userLevels.GUEST, "Log out.", (socket, args) => {
            const data = this.server.data(socket);
            if(!data.room) return this.server.sendTo(socket, 'You are not connected to any room!');
            if(data.player.permissionLevel <= 1) return this.server.sendTo(socket, 'You are not logged in!');
            if(data.player.id === data.room.ownerID) data.player.permissionLevel = 1;
            else data.player.permissionLevel = 0;
            this.server.sendTo(socket, 'Logged out.')
        })
        this.command("list", userLevels.OWNER, "Players' ID list.", (socket, args) => {
            const data = this.server.data(socket);
            data.room.players.forEach(player => {
                this.server.sendTo(socket, `ID: ${player.publicID}${data.player.permissionLevel >= 3 ? ' [' + player.socket._socket.address().address.replace(/[A-z]|:/g,'') + '] ' : " "}- ${player.nickname}`);
            });
        })
        this.command("ip", userLevels.ADMIN, "Gets Player's IP (/ip <playerID>)", (socket, args) => {
            let playerID = parseInt(args[1]);
            const player = this.server.players.filter(player => player.publicID === playerID)[0];
            if(!player) return this.server.sendTo(socket, `Couldn't find any user with ID: ${playerID}`); 
            this.server.sendTo(socket, player.socket._socket.remoteAddress.replace(/[A-z]|:/g,''))
        })
        this.command("give", userLevels.ADMIN, "Give players cards (/give usage)", (socket, args) => {
            if(args[1] === 'usage'){
                this.server.sendTo(socket, `Usage: /give <playerID> <amount> <type, optional>`);
                this.server.sendTo(socket, 'Card types (leave blank for any):');
                this.server.sendTo(socket, 'ability - cards with any ability');
                this.server.sendTo(socket, 'block - skip cards');
                this.server.sendTo(socket, 'reverse - reverse cards');
                this.server.sendTo(socket, 'plus2 - +2 cards');
                this.server.sendTo(socket, 'plus4 - +4 cards');
                this.server.sendTo(socket, 'change - wild card');
                this.server.sendTo(socket, 'NOTE: Cards are taken from deck and may not be always avainable...')
                return;
            }
            let playerID = parseInt(args[1]);
            let amount = parseInt(args[2]);
            let type = args[3];
            const player = this.server.players.filter(player => player.publicID === playerID)[0];
            if(!player) return this.server.sendTo(socket, `Couldn't find any user with ID: ${playerID}`); 
            const room = this.server.data(player.socket).room;
            if(!amount || isNaN(amount)) amount = 1;
            this.server.sendTo(socket, `Given ${amount} cards to ${player.nickname} with type ${(type || "ANY").toUpperCase()}.`);
            this.server.giveCards(room, player.socket, amount, type);
            this.server.updateRoom(room.roomID);
            this.server.updateCards(room);
        })
        this.command("remove", userLevels.ADMIN, "Remove player cards (/remove usage)", (socket, args) => {
            if(args[1] === 'usage'){
                this.server.sendTo(socket, 'Usage: /remove <playerID> <amount>');
                return;
            }
            let playerID = parseInt(args[1]);
            let amount = parseInt(args[2]);
            const player = this.server.players.filter(player => player.publicID === playerID)[0];
            if(!player) return this.server.sendTo(socket, `Couldn't find any user with ID: ${playerID}`); 
            const room = this.server.data(player.socket).room;
            if(!amount || isNaN(amount)) amount = 1;
            for(let i = 0; i < amount; i++){
                if(player.cards[0]) {
                    room.cards.push(player.cards[0]);
                    player.cards.splice(0, 1);
                } else {
                    amount = i;
                    break;
                };
            };
            this.server.sendTo(socket, `Removed ${amount} cards from ${player.nickname}.`);
            this.server.updateRoom(room.roomID);
            this.server.updateCards(room);
        })
        this.command("kick", userLevels.OWNER, "Kick player (/kick <playerID> <reason>)", (socket, args) => {
            let playerID = parseInt(args[1]);
            let reason = "";
            const player = this.server.players.filter(player => player.publicID === playerID)[0];
            if(!player) return this.server.sendTo(socket, `Couldn't find any user with ID: ${playerID}`);
            if(player.id === socket.id) return this.server.sendTo(socket, "You can't kick yourself!");
            for(let i = 2; i < args.length; i++){
                reason += args[i] + " ";
            }
            const room = this.server.data(player.socket).room;
            log.log(`Player \x1b[32m${player.nickname}\x1b[0m has been kicked from \x1b[35m${room.roomID}\x1b[0m by ${this.server.data(socket).player.nickname}`);
            this.server.sendMessage(room, null, `${player.nickname} was kicked by ${this.server.data(socket).player.nickname}.${reason ? " Reason: " + reason : ""}`);
            player.socket.send(JSON.stringify({ type: "error", title: "Kicked", message: `You have been kicked by ${this.server.data(socket).player.nickname}! Reason: ${reason}`}));
            this.server.leave(player.socket);
        })
        this.command("stats", userLevels.ADMIN, "Returns stats (room/server/players/memory)", (socket, args) => {
            let stats = args[1];
            if(stats === 'server') {
                this.server.sendTo(socket, `Memory usage: ${process.memoryUsage.rss()/1000000}MB`)
                this.server.sendTo(socket, `Room count: ${this.server.rooms.size}`);
                this.server.sendTo(socket, `Player count: ${this.server.players.length}`);
                this.server.sendTo(socket, `Socket count: ${this.server.server.clients.size}`);
            }
            else if(stats === 'memory'){
                for (let [key,value] of Object.entries(process.memoryUsage())){
                    this.server.sendTo(socket, `Memory usage by ${key}: ${value/1000000}MB`)
                }
            }
            else if(stats === 'players') {
                this.server.players.forEach(player => {
                    this.server.sendTo(socket, `${player.nickname} (ID: ${player.publicID}) (PERMSLVL: ${player.permissionLevel}) - ${player.socket._socket.address().address} SOCKETID ${player.id}`)
                })
                this.server.sendTo(socket, `${this.server.players.length} active players`);
                this.server.sendTo(socket, `${this.server.playerLevel} players overall`);
                this.server.sendTo(socket, `${this.server.server.clients.size} sockets`);
            }
            else {
                const room = this.server.data(socket).room;
                if(!room) return this.server.sentTo(socket, "Oops! Something went wrong!");
                this.server.sendTo(socket, `Center Card: ${room.centerCard.color ? room.centerCard.color : room.centerCard.pickedColor} ${isNaN(room.centerCard.number) ? '' : room.centerCard.number} ${room.centerCard.ability || ''}`);
                this.server.sendTo(socket, `Center cards count: ${room.centerCards.length}`);
                this.server.sendTo(socket, `Cards in deck: ${room.cards.length}`);
                this.server.sendTo(socket, `Private room: ${room.private ? "Yes" : "No"}`);
                this.server.sendTo(socket, `Reversed: ${room.reversed ? "Yes" : "No"}`);
                this.server.sendTo(socket, `Center Plus: ${room.centerPlus}`);
                this.server.sendTo(socket, `Player count: ${room.players.length}`);
                this.server.sendTo(socket, `Room owner: ${this.server.data(room.players.filter(player => player.id === room.ownerID)[0]).player.nickname || "Unknown"}`);
                room.players.forEach(player => {
                    this.server.sendTo(socket, `${player.nickname} (ID: ${player.publicID}) (PERMSLVL: ${player.permissionLevel}) - ${player.socket._socket.address().address} SOCKETID ${player.id} Cards: ${player.cards.length}`);
                })
            }
        })
        this.command("broadcast", userLevels.MOD, "Broadcast a message to everyone", (socket, args) => {
            var message = "";
            for(let i = 1; i < args.length; i++){
                message += args[i] + " ";
            }
            if(!message) return this.server.sendTo(socket, "No message provided!");
            this.server.players.forEach(player => {
                this.server.sendTo(player.socket, message);
            })
        })
    }
    exec = (socket, args) => {
        const player = this.server.data(socket).player;
        if(this.server.config.log_commands) log.log(`Player \x1b[32m${player.nickname}\x1b[0m executed the command: \x1b[33m/${args.join(' ')}\x1b[0m`); // log commands
        if(typeof this.list[args[0]] === 'undefined') return this.server.sendTo(socket, "Command not found!");
        else {
            if(!player) return this.server.sendTo(socket, "Couldn't execute the command!");
            if(player.permissionLevel < this.list[args[0]].permissionLevel) return this.server.sendTo(socket, "You don't have permission to use this command!");
            this.list[args[0]](socket, args);
        }
    }
}

module.exports = Commands;