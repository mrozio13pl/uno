const WebSocket = require('ws');
const Logger = require('./modules/logger/logger');
const PlayerCommands = require('./modules/commands/player');
const config = require('./config');
const badwords = require('./modules/badWords');

let log = new Logger();

class Server {
    constructor() {
        this.version = config.version;
        this.config = config;

        log.info("Version:\x1b[32m", this.version, '\x1b[0m');

        if(!this.config.port || isNaN(this.config.port)) { // port validation
            log.warn("Port is missing in the settings or is invalid!");
            this.config.port = 9090; 
        };
        this.server = new WebSocket.Server({ port: this.config.port });
        this.rooms = new Map();
        this.players = new Array();
        this.playerCommands = new PlayerCommands(this);
        this.playerLevel = 0;

        badwords.load();
    };
    create(socket, data) {
        if (!data.nickname || (this.players.filter(e => e.id === socket.id)[0] && this.rooms.get(this.players.filter(e => e.id === socket.id)[0].roomID)) || this.players.filter(player => player.id === socket.id).length > 1) return; // owner nick and id
        const room = {};
        do {
            room.roomID = Math.random().toString(36).substring(2, 8); // unique room id
        } while (this.rooms.has(room.roomID));
        room.players = [];
        room.centerCard = {};
        room.centerCards = [];
        room.centerPlus = 0;
        room.ownerID = socket.id;
        room.private = data.private;
        room.reversed = false;
        room.chatColors = ["#e530fb", "#ff1375", "#7be973", "#fffa58", "#78f3ff", "#7074f1", "#70ad50", "#3b85a9"];
        room.self_destruction = () => {
            room.players.forEach(player => {
                player.socket.send(JSON.stringify({ type: "room_closed", title: "Room Closed", message: "Room closed due to inactivity!" }));
                this.players.splice(this.players.findIndex(player_ => player_.id === player.id), 1);
            });
            log.log(`Room \x1b[35m${room.roomID}\x1b[0m closed due to inactivity`);
            this.rooms.delete(room.roomID);
        }
        room.timeout = setTimeout(room.self_destruction, 1e3 * this.config.room_timeout);
        socket.send(JSON.stringify({ type: "created_room", id: room.roomID }));
        this.rooms.set(room.roomID, room);
        log.log(`Room \x1b[35m${room.roomID}\x1b[0m created by \x1b[32m${data.nickname}\x1b[0m`);
        room.nickname = data.nickname;
        this.join(socket, room);
    };
    join(socket, data) {
        const room = this.rooms.get(data.roomID);
        if (!room || !data.nickname) return;
        if (!data.nickname.replace(/\s+/g, '').length) return socket.send(JSON.stringify({ type: "error", title: "Couldn't Join", message: "You don't have a valid nickname!" }));
        if (room.players.length >= 4) return socket.send(JSON.stringify({ type: "error", title: "Couldn't Join", message: "Room is full!" }));
        if (room.players.filter(player => player.id === socket.id).length || this.players.filter(player => player.id === socket.id).length > 1) return socket.send(JSON.stringify({ type: "error", title: "Couldn't Join", message: "You are already connected to this room!" }));
        this.playerLevel++;
        const player = {
            id: socket.id,
            publicID: this.playerLevel,
            permissionLevel: socket.id === room.ownerID ? 1 : 0,
            roomID: room.roomID,
            nickname: data.nickname.substring(0, 16),
            cards: [],
            points: 0,
            chatColor: room.chatColors.filter(color => !room.players.filter(player => player.chatColor === color).length)[~~(Math.random() * room.chatColors.filter(color => !room.players.filter(player => player.chatColor === color).length).length)] || "#fff",
            socket: socket
        };
        room.players.push(player);
        this.players.push(player);
        if(this.config.nick_badword_filter && badwords.check(player.nickname)) {
            log.log(`Player \x1b[32m${player.nickname}\x1b[0m was kicked from \x1b[35m${room.roomID}\x1b[0m due to having improper nickname`);
            socket.send(JSON.stringify({type: "error", title: "Couldn't Join", message: "Improper nickname!" }));
            this.leave(socket);
            return;
        }
        socket.send(JSON.stringify({ type: "joined_room", id: room.roomID }));
        this.updateRoom(room.roomID);
        log.log(`Player joined \x1b[32m${player.nickname}\x1b[0m to \x1b[35m${room.roomID}\x1b[0m`);
    };
    leave(socket){
        if (!this.players.filter(player => player.id === socket.id).length || !this.rooms.get(this.players.filter(player => player.id === socket.id)[0].roomID)) return;
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if (!player || !room) return;
        const playerIndex = room.players.findIndex(player => player.id === socket.id);
        if (!room.players[playerIndex]) return;
        log.log(`Player left \x1b[32m${player.nickname}\x1b[0m from \x1b[35m${room.roomID}\x1b[0m`);
        if (room.isRunning) this.sendMessage(room, null, player.nickname + " left the game!");
        this.players.splice(this.players.findIndex(player => player.id === socket.id), 1);
        room.players.splice(playerIndex, 1);
        if (room.isRunning) this.updatePlayers(room);
        this.updateRoom(room.roomID);
        socket.send(JSON.stringify({type:"kicked"}));
        if (room.ownerID === socket.id) {
            log.log(`Room \x1b[35m${room.roomID}\x1b[0m closed by owner`);
            this.close(room, "Owner closed the room!");
        }
        else if (room && ((room.isRunning && room.players.length <= 1) || room.players.length === 0)) {
            log.log(`Room \x1b[35m${room.roomID}\x1b[0m closed automatically`);
            this.close(room, "Everyone left the room!");
        }
    };
    data(socket){
        const player = this.players.filter(player => player.id === socket.id)[0];
        if (!player) return null;
        const room = this.rooms.get(player.roomID);
        return {
            player: player,
            room: room
        };
    }
    kick(socket, data){
        if(!data.id) return;
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if (!player || !room || room.ownerID !== socket.id) return;
        const kickedPlayer = room.players.filter(player => player.id === data.id);
        if (!kickedPlayer.length || !kickedPlayer[0].socket) return socket.send(JSON.stringify({ type: "error", title: "Couldn't kick a player", message: "Player not found!" }));
        if (kickedPlayer[0].id === socket.id) return socket.send(JSON.stringify({ type: "error", title: "Couldn't kick a player", message: "You can't kick yourself!" }));
        log.log(`Player \x1b[32m${player.nickname}\x1b[0m has been kicked from \x1b[35m${room.roomID}\x1b[0m by owner`)
        kickedPlayer[0].socket.send(JSON.stringify({ type: "error", title: "Kicked", message: "You have been kicked by owner!"}))
        this.leave(kickedPlayer[0].socket);
    }
    start(socket) {
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if (!player) return;
        if (!room) return socket.send(JSON.stringify({ type: "error", title: "Couldn't start the game", message: "Room not found!" }));
        if (room.players.length < 2) return socket.send(JSON.stringify({ type: "error", title: "Couldn't start the game", message: "Not enough players! (Minimum 2)" }));
        if (room.isRunning) return socket.send(JSON.stringify({ type: "error", title: "Couldn't start the game", message: "Game has already started!" }));
        if (!(room.ownerID === socket.id)) return socket.send(JSON.stringify({ type: "error", title: "Couldn't start the game", message: "You don't own this room!" }));
        room.cards = this.deck();
        do {
            room.centerCardIndex = ~~(Math.random() * room.cards.length) - 1;
            room.centerCard = room.cards[room.centerCardIndex];
        } while (!room.centerCard || room.centerCard.ability);

        room.centerColor = room.centerCard.color;
        room.centerCards.push(room.centerCard);
        room.cards.splice(room.centerCardIndex, 1);

        room.players.forEach(player => {
            for (let i = 0; i < 7; i++) {
                let randomCard = room.cards.length - 1;
                player.cards.push(room.cards[randomCard]);
                room.cards.splice(randomCard, 1);
            };
        });

        room.players = this.shuffle(room.players);
        room.players[0].turn = true;
        room.isRunning = true;
        clearTimeout(room.timeout);

        this.updateCards(room);

        room.players.forEach(player => {
            player.socket.send(JSON.stringify({type:"start",playerCount:room.players.length}))
        });
        this.updateRoom(room.roomID);
        this.turn(room.players[0]);

        this.sendMessage(room, null, "Game has started!");

        log.log(`Room \x1b[35m${room.roomID}\x1b[0m started`);
    };
    action(socket, data) {
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if(!player || !player.turn || !room) return;
        if (data.card && data.card.number) data.card.number = isNaN(parseInt(data.card.number)) ? null : parseInt(data.card.number);
        switch (data.action) {
            case 'place': {
                if (!data.card || !player.cards.filter(card => card.color === data.card.color && card.ability === data.card.ability && card.number === data.card.number).length) return; // check if player has card
                if ((!data.card.color && data.card.ability && (player.turn !== 'plus4' && player.turn !== 'plus2')) || (player.turn === 'plus4' && data.card.ability === 'plus4') || (player.turn === 'plus2' && data.card.ability === 'plus4')) { // change colour when ability
                    if (data.card.pickedColor === 'red' || data.card.pickedColor === 'green' || data.card.pickedColor === 'blue' || data.card.pickedColor === 'yellow') {
                        room.centerCard = data.card;
                        room.centerColor = data.card.pickedColor;
                        switch (data.card.ability) {
                            case "plus4": {
                                room.centerPlus = room.centerPlus + 4;
                                this.nextTurn(room, player, data, socket, 'plus4'); // wild draw 4
                                break;
                            }
                            default: {
                                this.nextTurn(room, player, data, socket); // wild
                                break;
                            }
                        }
                    }
                } else if (player.turn === 'plus4' && data.card.ability !== 'plus2') return;
                if ((data.card.color && (player.turn !== 'plus4' && player.turn !== 'plus2')) || (player.turn === 'plus2' && data.card.ability === 'plus2') || (data.card.ability === 'plus2' && data.card.color === room.centerColor && player.turn === 'plus4')) {
                    if (room.centerCard.color === data.card.color || (room.centerColor === data.card.color && data.card.color) || (room.centerCard.number === data.card.number && data.card.number !== null) || (room.centerCard.ability === data.card.ability && data.card.ability)) {
                        room.centerCard = data.card;
                        room.centerColor = data.card.color;
                        switch (data.card.ability) {
                            case "reverse": {
                                //room.players.reverse();
                                room.reversed = !room.reversed;
                                this.nextTurn(room, player, data, socket, 'reverse'); // reverse
                                break;
                            };
                            case "plus2": {
                                room.centerPlus = room.centerPlus + 2;
                                this.nextTurn(room, player, data, socket, 'plus2'); // draw 2
                                break;
                            };
                            case "block": {
                                this.nextTurn(room, player, data, socket, 'block'); // skip
                                break;
                            }
                            default: {
                                this.nextTurn(room, player, data, socket);
                                break;
                            }
                        }
                    } else return; // socket.send(JSON.stringify({ type: "error", message: "Invalid card!" }));
                }
                break;
            }
            case 'take': {
                this.giveCards(room, socket, room.centerPlus);
                room.centerPlus = 0;
                this.nextTurn(room, player, data, socket, 'take');
                break;
            }
        }
    };
    giveCards(room, socket, amount = 1, type = null) {
        if(!amount) amount = 1;
        for (let i = 0; i < amount; i++) {
            if (!room.cards.length) {
                if (!room.centerCards.length) {
                    this.sendMessage(room, null, "No cards left in draw pile and discard pile! Restarting the game.");
                    this.end(room.roomID);
                    return;
                }
                room.cards = this.shuffle(room.centerCards); // reset cards
                room.centerCards = [];
            };
            const index = room.players.findIndex(player => player.id === socket.id);
            switch(true){
                case type === "ability": {
                    var cardIndex = room.cards.findIndex(card => card.ability);
                    if(!cardIndex) return;
                    room.players[index].cards.push(room.cards[cardIndex]);
                    room.cards.splice(cardIndex, 1);
                    break;
                }
                case type != null: {
                    var cardIndex = room.cards.findIndex(card => card.ability === type);
                    if(!cardIndex || !room.cards[cardIndex]) return;
                    room.players[index].cards.push(room.cards[cardIndex]);
                    room.cards.splice(cardIndex, 1);
                    break;
                }
                default: {
                    room.players[index].cards.push(room.cards[0]);
                    room.cards.splice(0, 1);
                    break;
                }
            }
        }
    };
    nextTurn(room, player, data, socket, turn = true) {
        if (room.reversed) {
            var index = room.players.findIndex(player => player.id === socket.id) - 1;
            if (turn !== 'take') {
                const cardIndex = player.cards.findIndex(card => card.color === data.card.color && card.ability === data.card.ability && card.number === data.card.number);
                room.centerCards.push(room.players[index + 1].cards[cardIndex]);
                room.players[index + 1].cards.splice(cardIndex, 1);
                if (room.players.filter(player => !player.cards.length).length) return this.end(room.roomID);
            }
            if (0 > index) index = room.players.length - 1;
            if (turn === 'block' || (turn === 'reverse' && room.players.length === 2)) index--;
            if ((turn === 'block' || (turn === 'reverse' && room.players.length === 2)) && 0 > index) index = room.players.length - 1;
        } else {
            var index = room.players.findIndex(player => player.id === socket.id) + 1;
            if (turn !== 'take') {
                const cardIndex = player.cards.findIndex(card => card.color === data.card.color && card.ability === data.card.ability && card.number === data.card.number);
                room.centerCards.push(room.players[index - 1].cards[cardIndex]);
                room.players[index - 1].cards.splice(cardIndex, 1);
                if (room.players.filter(player => !player.cards.length).length) return this.end(room.roomID);
            }
            if (room.players.length <= index) index = 0;
            if (turn === 'block' || (turn === 'reverse' && room.players.length === 2)) index++;
            if ((turn === 'block' || (turn === 'reverse' && room.players.length === 2)) && room.players.length <= index) index = 0;
        }
        room.players.forEach(player => {
            player.turn = false;
            if (typeof player.timeout !== 'undefined') clearTimeout(player.timeout);
            delete player.timeout;
        });
        room.players[index].turn = turn;
        this.updateCards(room);
        this.updateRoom(room.roomID);
        this.turn(room.players[index], turn);
    };
    turn(player, turn = true){
        if (!player || !player.socket || !player.socket.id) return;
        player.turn = turn;
        if(player.cards.length > 1) player.uno = false;
        player.socket.send(JSON.stringify({ type: "timeout", time: this.config.player_timeout }));
        player.timeout = setTimeout(() => {
            player.socket.send(JSON.stringify({ type: "error", title: "Timed Out", message: "You were kicked due to inactivity!" }));
            this.leave(player.socket);
        }, 1e3 * this.config.player_timeout);
    }
    next(code){
        const room = this.rooms.get(code);
        if(!room) return;
        room.cards = this.deck();
        do {
            room.centerCardIndex = ~~(Math.random() * room.cards.length) - 1;
            room.centerCard = room.cards[room.centerCardIndex];
        } while (!room.centerCard || room.centerCard.ability);
        room.centerColor = room.centerCard.color;
        room.centerCards.push(room.centerCard);
        room.cards.splice(room.centerCardIndex, 1);
        room.players.forEach(player => {
            player.uno = false;
            player.turn = false;
            player.cards = [];
            for (let i = 0; i < 7; i++) {
                let randomCard = room.cards.length - 1;
                player.cards.push(room.cards[randomCard]);
                room.cards.splice(randomCard, 1);
            };
        });
        room.players[room.players.length * Math.random() | 0].turn = true;
        room.reversed = false;
        room.centerPlus = 0;
        this.updateCards(room);
        this.updateRoom(room.roomID);
        this.turn(room.players.filter(player => player.turn)[0]);
    };
    end(code){
        const room = this.rooms.get(code);
        const winnerIndex = room.players.findIndex(player => !player.cards.length);
        const winner = room.players[winnerIndex];
        let winPoints = 0;

        room.players.forEach(player => {
            player.cards.forEach(card => {
                if (card && !isNaN(card.number)) winPoints += card.number;
                if (card && (card.ability === 'plus4' || card.ability === 'change')) winPoints += 50;
                else if (card && card.ability) winPoints += 20;
            });
        });

        winner.points += winPoints;
        this.updateRoom(room.roomID);
        this.updateCards(room);

        if(this.config.announce_round_winner && winner) this.sendMessage(room, null, `${winner.nickname} won this round! (+${winPoints} points)`);
        const scoresList = [];
        room.players.forEach(player => {
            scoresList.push({nickname:player.nickname,points:player.points,cards:player.cards,isWinner:player.id===winner.id,id:player.id});
            player.cards = [];
        })
        room.players.forEach(player => {
            if(player.timeout) clearTimeout(player.timeout);
            player.socket.send(JSON.stringify({
                type: "win",
                players: scoresList,
                centerCard: room.centerCard,
                max_points: this.config.win_points
            }));
        });

        if(winner.points >= this.config.win_points) return setTimeout(()=>{
            room.players.forEach(player => {
                player.socket.send(JSON.stringify({ type: "winner", winner: winner.nickname }));
                player.points = 0;
            });
            this.sendMessage(room, null, "Congratolations to " + winner.nickname + " for winning the game!");
            room.isRunning = false;
            room.centerPlus = 0;
            room.timeout = setTimeout(room.self_destruction, 1e3 * this.config.room_timeout);
        }, 3e3);
        setTimeout(() => {
            room.players.forEach(player => {
                player.socket.send(JSON.stringify({ type: "round_over", playerCount: room.players.length }));
            });
            this.next(room.roomID);
        }, 3e3);
    };
    close(room, message){
        room.players.forEach(player => {
            if (player.timeout) clearTimeout(player.timeout);
            if (room.timeout) clearTimeout(room.timeout);
            player.socket.send(JSON.stringify({ type: "room_closed", title: "Room Closed", message: message }));
            this.players.splice(this.players.findIndex(player_ => player_.id === player.id));
        });
        this.rooms.delete(room.roomID);
    };
    deck() {
        const cards = []; // https://www.unorules.org/wp-content/uploads/2021/03/All-Uno-cards-how-many-cards-in-uno.png
        const colors = ['red', 'blue', 'green', 'yellow'];
        const abilities = ['block', 'reverse', 'plus2'];
        for (let j = 0; j <= 1; j++) {
            for (let i = j; i <= 9; i++) {
                colors.forEach(color => {
                    cards.push({
                        number: i,
                        color: color,
                        ability: null
                    })
                })
            };
            colors.forEach(color => {
                abilities.forEach(ability => {
                    cards.push({
                        number: null,
                        color: color,
                        ability: ability
                    });
                })
            });
        };
        for (let i = 0; i < 4; i++) {
            cards.push({
                number: null,
                color: null,
                ability: 'plus4',
            });
            cards.push({
                number: null,
                color: null,
                ability: 'change',
            });
        };
        return this.shuffle(cards);
    };
    uno(socket){
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if (!player || !room || !room.isRunning || (socket.lastUno && socket.lastUno > Date.now() - this.config.uno_cooldown && !(room.players.filter(player => player.turn).length && room.players.filter(player => player.turn)[0].id === socket.id && room.players.filter(player => player.turn)[0].cards.length <= 2 && !room.players.filter(player => player.turn)[0].uno))) return;
        socket.lastUno = Date.now();
        room.players.forEach(player => {
            if(player.uno || player.cards.length > 2) return;
            if(player.id === socket.id && ((player.cards.length <= 2 && player.cards.length && player.turn) || (player.cards.length === 1 && !player.uno))) player.uno = true;
            if(player.cards.length === 1 && !player.uno) {
                this.giveCards(room, player.socket, 2);
                room.players.forEach(player_ => {
                    player_.socket.send(JSON.stringify({ type: "uno", nickname: player.nickname }));
                });
                player.uno = true;
                this.updateRoom(room.roomID);
                this.updateCards(room);
            }
        });
    }
    message(socket, data){
        if ((socket.lastMessage && socket.lastMessage > Date.now() - this.config.chat_cooldown) || !data.message || !data.message.replace(/\s+/g, '').length) return;
        const player = this.data(socket).player;
        const room = this.data(socket).room;
        if (!player || !room) return;
        socket.lastMessage = Date.now();
        if(data.message.split("")[0] === '/') return this.playerCommands.exec(socket, data.message.slice(1));
        this.sendMessage(room, player.nickname, this.config.chat_badword_filter ? badwords.clear(data.message) : data.message, player.chatColor);
        if(this.config.log_chat) log.log("\x1b[35m" + room.roomID + "\x1b[0m", "-", player.nickname + ":", "\x1b[90m" + data.message + "\x1b[0m");
    };
    sendMessage(room, nickname, message, color = '#e8b2f5'){
        if(!this.rooms.get(room.roomID)) return;
        room.players.forEach(player => {
            player.socket.send(JSON.stringify({ type: "chat_message", nickname: nickname || "SERVER", message: message.substring(0, 64), color: color }));
        });
    };
    sendTo(socket, message){
        socket.send(JSON.stringify({ type: "chat_message", nickname: "SERVER", message: message.substring(0, 64), color: '#e8b2f5' }));
    }
    roomList(socket){
        if(socket.lastRefresh && socket.lastRefresh > Date.now() - this.config.refresh_cooldown) return;
        const rooms = new Array();
        this.rooms.forEach(room => {
            if (!room.private && !room.isRunning) rooms.push({
                roomID: room.roomID,
                playerCount: room.players.length,
                roomName: (room.players.filter(player => player.id === room.ownerID)[0] ? room.players.filter(player => player.id === room.ownerID)[0].nickname : "Unnamed") + "'s room",
                isRunning: room.isRunning
            })
        });
        socket.send(JSON.stringify({ type: "room_list", rooms: rooms.sort((a,b)=>a.playerCount-b.playerCount), cooldown: this.config.refresh_cooldown }));
        socket.lastRefresh = Date.now();
    };
    main() {
        log.info('Server listening on port', this.config.port);
        log.debug("Debug Mode:", "ON");
        this.server.on('connection', socket => {
            if(this.config.max_connections && this.server.clients.size > this.config.max_connections)
                return socket.close(1000, "Connections limit reached!");
            if (!socket.id) {
                socket.id = this.uuid();
                socket.send(JSON.stringify({ type: 'id', id: socket.id }));
                socket.send(JSON.stringify({ type: 'v', version: this.version }));
            }
            socket.on('message', message => {
                try{
                    const data = JSON.parse(message);
                    switch (data.type) {
                        case 'room_list': {
                            this.roomList(socket);
                            break;
                        }
                        case 'room_check': {
                            if (this.rooms.get(data.roomID) && !this.rooms.get(data.roomID).isRunning && this.rooms.get(data.roomID).players.length < 4) socket.send(JSON.stringify({ type: "room_check", callback: true }));
                            else if (!this.rooms.get(data.roomID)) socket.send(JSON.stringify({ type: "room_check", callback: false, message: "Room not found!" }));
                            else if (this.rooms.get(data.roomID).isRunning) socket.send(JSON.stringify({ type: "room_check", callback: false, message: "Room is running!" }));
                            else if (this.rooms.get(data.roomID).players.length >= 4) socket.send(JSON.stringify({ type: "room_check", callback: false, message: "Room is full!" }));
                        }
                        case 'join': {
                            this.join(socket, data);
                            break;
                        }
                        case 'kick': {
                            this.kick(socket, data);
                            break;
                        }
                        case 'leave_room': {
                            this.leave(socket);
                            break;
                        }
                        case 'create': {
                            this.create(socket, data);
                            break;
                        }
                        case 'start': {
                            this.start(socket);
                            break;
                        }
                        case 'uno': {
                            this.uno(socket);
                            break;
                        }
                        case 'action': {
                            this.action(socket, data);
                            break;
                        }
                        case 'message': {
                            this.message(socket, data);
                            break;
                        }
                    }
                }catch(error){
                    return;
                }
            });
            socket.on('close', () => {
                this.leave(socket);
            });
        });
    };
    updateCards(room) {
        room.players.forEach(player => {
            player.socket.send(JSON.stringify({ type: "my_cards", cards: player.cards }));
        })
    };
    updateRoom(code){
        const room = this.rooms.get(code);
        if(!room) return;
        room.players.forEach(player => {
            let fakeroom = JSON.parse(JSON.stringify(room, this.getCircularReplacer()));
            if(room.isRunning){
                let fakeplayers = new Array;
                fakeroom.players.forEach(fakeplayer => {
                    if (fakeplayer.id !== player.id) {
                        let newfakeplayer = {...fakeplayer};
                        newfakeplayer.cards = [];
                        fakeplayer.cards.forEach(() => {
                            newfakeplayer.cards.push(null);
                        });
                        fakeplayers.push(newfakeplayer);
                    } else fakeplayers.push(fakeplayer);
                });
                fakeroom.players = fakeplayers; // hide cards
            };
            delete fakeroom.cards;
            delete fakeroom.centerCardIndex;
            delete fakeroom.centerCards;
            delete fakeroom.private;
            delete fakeroom.ownerID;
            delete fakeroom.timeout;
            delete fakeroom.chatColors;
            delete fakeroom.self_destruction;
            delete fakeroom.roomID;
            for (let i = 0; i < fakeroom.players.length; i++){
                delete fakeroom.players[i].socket;
                delete fakeroom.players[i].roomID;
                delete fakeroom.players[i].chatColor;
                delete fakeroom.players[i].permissionLevel;
                delete fakeroom.players[i].publicID;
            } 
            player.socket.send(JSON.stringify({ type: "room", room: fakeroom }));
        })
    };
    updatePlayers(room){
        if (!room.players.filter(player => player.turn).length && room.players.length) this.turn(room.players[~~(room.players.length * Math.random())]);
        room.players.forEach(player => {
            player.socket.send(JSON.stringify({ type: "players_update", playerCount: room.players.length }));
        })
    };
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = ~~(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        };
        return array; // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    };
    getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return;
                }
                seen.add(value);
            }
            return value; // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#circular_references
        };
    };
    uuid(){
        let S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4()); // https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
    };
};

module.exports = Server;