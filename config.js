module.exports = Object.seal({
version: 'v1.1.0',

/*
 * UNO CONFIGURATION FILE
 *
 * DO NOT CHANGE TYPES OF VALUES, e.g. boolean (true or false), numbers etc. 
 * TO CHANGE PASSWORDS GO TO: \modules\user\userRoles.js
 */

// [DEBUG MODE]
debug: false, // show debug logs

// [SERVER]
port: 2222, // port which server runs on
max_connections: 0, // max client connections allowed to the server (0 to disable)

// [GAME]
win_points: 500, // points to win
room_timeout: 300, // time after room gets removed due to inactivity (seconds)
player_timeout: 60, // time after player is kicked due to inactivity (seconds)
uno_cooldown: 1000, // cooldown for players pressing uno button (milliseconds)
refresh_cooldown: 1500, // cooldown for players refreshing room list (milliseconds)
nick_badword_filter: true, // checks for badwords in player nickname

// [CHAT]
chat_cooldown: 500, // cooldown for chat (milliseconds)
chat_badword_filter: true, // checks for badwords in chat
announce_round_winner: true, // announce in chat winner of the round

// [LOGS]
save_logs: true, // save logs in 'logs' directory
log_chat: false, // log chat messages in console
log_commands: true, // log executed commands
log_timestamp: false, // logs current date
log_default: true, // enable default logs
// ANSI Color Codes: http://jafrog.com/2013/11/23/colors-in-terminal.html
default_color: '\x1b[32m',
info_color: '\x1b[34m',
warn_color: '\x1b[33m',
error_color: '\x1b[31m',
fatal_color: '\x1b[31m\x1b[1m',
debug_color: '\x1b[35m',
date_color: '\x1b[36m',
})