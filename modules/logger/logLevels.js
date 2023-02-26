const config = require('../../config');

var level = 0;

function newLevel(name, color = "\x1b[0m", displayName = name){
    module.exports[name] = {
        level: level,
        color: color,
        displayName: displayName
    };
    level++; // auto-increment
};

newLevel("LOG", config.default_color); // default (level 0)
newLevel("FATAL", config.fatal_color);
newLevel("ERROR", config.error_color);
newLevel("WARN", config.warn_color);
newLevel("INFO", config.info_color);
newLevel("DEBUG", config.debug_color);