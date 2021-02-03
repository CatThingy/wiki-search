const Discord = require("discord.js");
const config = require("./config.json");

const client = new Discord.Client();

client.login(config.token);
client.on("guildDelete", guild => settings.delete(guild.id));

client.on("ready", () => {
    client.commands = new Discord.Collection();

    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        client.commands.set(command.name, command);
    }
});

client.on("message", message => {
    if (message.author.bot)
        return;

    const serverSettings = message.guild ? settings.ensure(message.guild.id, config.default_settings) : config.dm_settings;

    let messageText = message.content.toLowerCase();
    if (messageText.startsWith(serverSettings.prefix)) {
        messageText = messageText.slice(serverSettings.prefix.length);

        // Parse input, stripping off the command prefix and
        // separating arguments. Spaces in quotes are ignored,
        // so the whole quote counts as one argument.
        const args = [...messageText.matchAll(argRegex)].map(v => v.slice(1).filter(n => n !== undefined)[0]);
        const command = args.shift();
        try {
            client.commands.get(command).execute(message, args, serverSettings)
        }
        catch (e) {
            console.error(e.stack);
        }
    }
});
