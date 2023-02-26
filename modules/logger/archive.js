const fs = require('fs');
const ZIP = require('adm-zip');

if(!fs.existsSync('./logs')) fs.mkdirSync('./logs');
var zip = new ZIP(fs.existsSync('./logs/archive.zip') ? "./logs/archive.zip" : null);

if(!fs.existsSync('./logs/archive')) fs.mkdirSync('./logs/archive');
fs.readdirSync('./logs').forEach(file => {
    if(file.substr(file.lastIndexOf('.')) === '.log'){
        fs.renameSync('./logs/' + file, './logs/archive/' + file);
        zip.addLocalFile("./logs/archive/" + file);
        zip.writeZip("./logs/archive.zip");
    }
});
fs.rmSync('./logs/archive', { recursive: true, force: true });