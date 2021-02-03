const Discord = require("discord.js");
const Enmap = require("enmap");
const config = require("./config.json");

const client = new Discord.Client();
const settings = new Enmap({
    name: "settings",
    autoFetch: true,
    fetchAll: false
});

client.login(config.token);
client.on("guildDelete", guild => settings.delete(guild.id));

client.on("message", message => {

    // Don't respond to bots
    if (message.author.bot) { return };

    // Set server settings to default if they don't exist, otherwise look them up
    const serverSettings = message.guild ? settings.ensure(message.guild.id, config.defaultSettings) : config.defaultSettings;

    let messageText = message.content.toLowerCase();

    // Ignore if message doesn't start with a prefix
    if (!messageText.startsWith(serverSettings.prefix)) { return; }


    messageText = messageText.slice(serverSettings.prefix.length);

    // Parse input, stripping off the command prefix and
    // separating arguments. Spaces in quotes are ignored,
    // so the whole quote counts as one argument.
    const args = [...messageText.matchAll(/["'](.+?)["']|\b(.+?)(?:\s|$)/g)].map(v => v.slice(1).filter(n => n !== undefined)[0]);

    const command = args.shift();

    switch (command) {
        case "config":
        case "settings":
        case "set":
            // Only allow administrators to edit settings, no settings can change in DMs
            if (!message.guild || !message.member.hasPermission("MANAGE_GUILD")) { return; }

            if (args[0] === undefined) {
                message.channel.send({
                    embed: {
                        title: "Settings",
                        fields: [
                            {
                                name: "Prefix",
                                value: serverSettings.prefix
                            },
                            {
                                name: "Wiki: ",
                                value: serverSettings.wiki
                            }
                        ]
                    }
                });
            }
            else if (args[1] === undefined) {
                if (args[0] == "prefix") {
                    message.channel.send("```\nPrefix: " + serverSettings.prefix + "\n```");
                }
                else if (args[0] == "wiki") {
                    message.channel.send("```\nPrefix: " + serverSettings.wiki + "\n```");
                }
            }
            else {
                if (args[0] == "prefix") {
                    message.channel.send("```\nPrefix has been changed to " + args[1] + "\n```");
                    settings.set(message.guild.id, args[1], "prefix");
                }
                else if (args[0] == "wiki") {
                    message.channel.send("```\nWiki has been changed to " + args[1] + "\n```");
                    settings.set(message.guild.id, args[1], "prefix");
                }
            }
            break;


        default:
            return;
    }

});
