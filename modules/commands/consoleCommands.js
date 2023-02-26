const commands = {
    new: function(name, description, executor){
        commands[name] = executor;
        commands[name].name = name;
        commands[name].description = description;
    }
}

commands.new('test', "Test Command.", (args) => {
    console.log("Hello World!"); // soon
});

module.exports = commands;