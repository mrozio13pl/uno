const fs = require('fs');
const archive = require('./archive');

var LogFile = `./logs/log_${new Date().valueOf()}.log`;
fs.writeFileSync(LogFile, `======= Logs Started ${new Date().toLocaleString().replace(',', '')} =======`);

const LOG = {};

LOG.ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g; // https://github.com/chalk/ansi-regex/blob/main/index.js#L3
LOG.save = function (level, log) {
    fs.appendFileSync(LogFile, `\r\n[${level}] [${new Date().toLocaleString().replace(',', '')}] ${log.replace(LOG.ansiRegex, '')}`)
}

module.exports = LOG;