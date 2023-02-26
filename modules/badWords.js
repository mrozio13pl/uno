const Logger = require('./logger/logger');
const fs = require('fs');

let log = new Logger();

const badwords = [];

const load = () => {
    try {
        if(!fs.existsSync('./badwords.txt')){
            log.warn("Couldn't load badwords: badwords.txt not found");
            return;
        }
        const words = fs.readFileSync('./badwords.txt', 'utf-8').split('\r\n');
        words.forEach(word => {
            if(!word.length) return; // empty
            if(word.replace(/\s+/g, '').substring(0, 1) === '#') return; // comment
            else badwords.push(word);
        });
        log.info("Loaded", badwords.length, "badwords");
    }
    catch (error) {
        log.error(error.stack);
        log.error("Couldn't load badwords:", error.message);
        return;
    }
}

const check = word => badwords.filter(badword => {
    if(badword.substring(0, 1) !== '*'){
        if(word.toLowerCase().includes(badword.toLowerCase()))
        return badword;
    } else {
        if(word.includes(badword.slice(1))) return badword;
    }
}).length;

const clear = message => {
    message = message.split(/\s+/);
    for(let i = 0; i < message.length; i++){
        let word = message[i];
        if(check(word)) message[i] = '*'.repeat(word.length);
    };
    return message.join(' ');
}

module.exports.load = load;
module.exports.check = check;
module.exports.clear = clear;