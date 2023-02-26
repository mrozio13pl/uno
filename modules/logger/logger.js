const config = require('../../config');
var LogLevels = require('./logLevels');

if(config.save_logs) 
var SaveLogs = require('./saveLogs');

class Logger {
    constructor(){
        this.debug = config.debug;
        this.define();
    }
    define(){
        Object.keys(LogLevels).forEach(level => {
            if(!this.debug && level === "DEBUG" || !config.log_default && level === "LOG") return this[level.toLowerCase()] = () => null; 
            this[level.toLowerCase()] = (...inputs) => {
                console.log(
                    (config.log_timestamp ? config.date_color + '<' + new Date().toLocaleString().replace(',', '') + '>\x1b[0m ' : "") +
                    '[' + LogLevels[level].color + LogLevels[level].displayName + '\x1b[0m' + ']',
                    isNaN(parseFloat(inputs.toString().replace(/,/ig, '\x20'))) ? inputs.toString().replace(/,/ig, '\x20') : parseFloat(inputs.toString().replace(/,/ig, '\x20'))
                );
                if(config.save_logs) SaveLogs.save(LogLevels[level].displayName, inputs.toString().replace(/,/ig, '\x20'));
            }
        });
    }
}

module.exports = Logger;