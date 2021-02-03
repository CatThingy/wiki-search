const Discord = require("discord.js");
const Enmap = require("enmap");
const fetch = require("node-fetch");
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
            cmdConfig(args, message, serverSettings);
            break;

        case "search":
        case "s":
        case "find":
        case "wiki":
        case "article":
            cmdSearch(args, message, serverSettings);
            break;
        default:
            cmdSearch([command, ...args], message, serverSettings);
            return;
    }
});

function cmdConfig(args, message, serverSettings) {
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
            message.channel.send("```\Wiki: " + serverSettings.wiki + "\n```");
        }
    }
    else {
        if (args[0] == "prefix") {
            message.channel.send("```\nPrefix has been changed to " + args[1] + "\n```");
            settings.set(message.guild.id, args[1], "prefix");
        }
        else if (args[0] == "wiki") {
            message.channel.send("```\nWiki has been changed to " + args[1] + "\n```");
            settings.set(message.guild.id, args[1], "wiki");
        }
    }
}

async function cmdSearch(args, message, serverSettings) {
    let sentMessage = await message.channel.send("Searching...")

    const searchTerm = encodeURIComponent(args.join(""));
    let searchURL;
    if ((serverSettings.wiki).includes("fandom") || (serverSettings.wiki).includes("gamepedia")) {
        searchURL = "https://" + serverSettings.wiki + "/api.php"
    }
    else {
        searchURL = "https://" + serverSettings.wiki + "/w/api.php"
    }

    let pageTitle;
    let pageId;
    await fetch(searchURL + "?action=query&format=json&list=search&srlimit=1&srsearch=" + searchTerm)
        .then(data => data.json())
        .then(data => {
            pageTitle = decodeURIComponent(data.query.search[0].title);
            pageId = data.query.search[0].pageid
        });

    let categories = [];

    await fetch(searchURL + "?action=query&format=json&prop=categories&titles=" + pageTitle)
        .then(data => data.json())
        .then(data => {
            if (data.query.pages[pageId].categories !== undefined) {
                for (let cat of data.query.pages[pageId].categories) {
                    categories.push(cat.title.replace("Category:", ""));
                }
            }
        });


    let pageUrl = "https://";
    if (serverSettings.wiki.includes("fandom") || serverSettings.wiki.includes("gamepedia")) {
        pageUrl += serverSettings.wiki + "/" + encodeURIComponent(pageTitle);
    }
    else {
        pageUrl += serverSettings.wiki + "/wiki/" + encodeURIComponent(pageTitle);
    }

    sentMessage.edit("", {
        embed: {
            url: pageUrl,
            title: pageTitle,
            description: "Categories: " + (categories.length ? categories.join() : "None") 
        }
    });
}
