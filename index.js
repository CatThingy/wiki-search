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

    // Don't run commands if message doesn't start with a prefix
    if (messageText.startsWith(serverSettings.prefix)) {


        messageText = messageText.slice(serverSettings.prefix.length);

        // Parse input, stripping off the command prefix and
        // separating arguments. Spaces in quotes are ignored,
        // so the whole quote counts as one argument.
        const args = [...messageText.matchAll(/["'](.+?)["']|\b(.+?)(?:\s|$)/g)].map(v => v.slice(1).filter(n => n !== undefined)[0]);

        const command = args.shift();

        switch (command) {
            case "help":
            case "h":
                cmdHelp(message, serverSettings);
                break;
            case "config":
            case "settings":
            case "set":
                cmdConfig(args, message, serverSettings);
                break;

            case "search":
            case "find":
            case "wiki":
            case "article":
                cmdSearch(args, message, serverSettings);
                break;
            default:
                cmdSearch([command, ...args], message, serverSettings);
                return;
        }
    }
    else {
        let inlineSearch = messageText.match(/\[\[(.+)\]\]/);
        if (inlineSearch !== null && inlineSearch[1] !== undefined) {
            cmdSearch([inlineSearch[1]], message, serverSettings);
        }
    }
});

//#region Commands
function cmdConfig(args, message, serverSettings) {
    // Only allow administrators to edit settings, no settings can change in DMs
    if (!message.guild || !message.member.hasPermission("MANAGE_GUILD")) { return; }

    let channel;
    let channelName;

    if (args[0] && args[0].search(/\d+>/) !== -1) {
        // Remove 1st arg (channel) and store it
        channel = args.shift().match(/(\d+)>/)[1];
        channelName = message.cleanContent.split(" ")[1];
    }

    let currentSettings = serverSettings;

    if (channel !== undefined) {
        currentSettings = serverSettings.channelOverrides[channel] ?? {};
    }


    if (args[0] === undefined) {
        message.channel.send({
            embed: {
                title: "Settings",
                fields: [
                    {
                        name: "Enabled",
                        value: currentSettings.enabled ?? serverSettings.enabled
                    },
                    {
                        name: "Prefix",
                        value: serverSettings.prefix
                    },
                    {
                        name: "Wiki: ",
                        value: currentSettings.wiki ?? serverSettings.wiki
                    }
                ]
            }
        });
    }
    else if (args[1] === undefined) {
        if (args[0] == "enabled") {
            message.channel.send("```\nEnabled: " + currentSettings.enabled ?? serverSettings.enabled + "\n```")
        }
        else if (args[0] == "prefix") {
            message.channel.send("```\nPrefix: " + serverSettings.prefix + "\n```");
        }
        else if (args[0] == "wiki") {
            message.channel.send("```\nWiki: " + currentSettings.wiki ?? serverSettings.enabled + "\n```");
        }
    }
    else {
        if (args[0] == "enabled") {
            let parsedBool = isTrue(args[1]);

            if (channel !== undefined) {
                message.channel.send("```\nWikiSearch has been " + (parsedBool ? "enabled" : "disabled") + " for " + channelName + ".\n```");
                settings.set(message.guild.id, parsedBool, `channelOverrides.${channel}.enabled`);
            }
            else {
                message.channel.send("```\nWikiSearch has been " + (parsedBool ? "enabled" : "disabled") + ".\n```");
                settings.set(message.guild.id, parsedBool, "enabled");
            }
        }
        else if (args[0] == "prefix") {
            message.channel.send("```\nPrefix has been changed to " + args[1] + "\n```");
            settings.set(message.guild.id, args[1], "prefix");

        }
        else if (args[0] == "wiki") {
            let cleanedUrl = (args[1].match(/https?:\/\/(.*?)\/?$/i) ?? args)[1]

            if (channel !== undefined) {
                message.channel.send("```\nWiki for " + channelName + " has been changed to " + cleanedUrl + "\n```");
                settings.set(message.guild.id, cleanedUrl, `channelOverrides.${channel}.wiki`);
            }
            else {
                message.channel.send("```\nWiki has been changed to " + cleanedUrl + "\n```");
                settings.set(message.guild.id, cleanedUrl, "wiki");
            }
        }
    }
}

async function cmdSearch(args, message, serverSettings) {

    let overrides = serverSettings.channelOverrides[message.channel.id] ?? {};
    console.log(serverSettings.channelOverrides[message.channel.id]);
    let currentSettings = {
        enabled: overrides.enabled ?? serverSettings.enabled,
        wiki: overrides.wiki ?? serverSettings.wiki
    }

    // don't do anything if disabled
    if (!currentSettings.enabled) { return; }

    let sentMessage = await message.channel.send("```\nSearching...```\n")

    const searchTerm = encodeURIComponent(args.join(""));
    let searchURL;


    // Fandom/Gamepedia wikis don't need /w/ to access the API
    if ((currentSettings.wiki).includes(".fandom.com") || (currentSettings.wiki).includes(".gamepedia.com")) {
        searchURL = "https://" + currentSettings.wiki + "/api.php"
    }
    else {
        searchURL = "https://" + currentSettings.wiki + "/w/api.php"
    }

    let pageTitle;
    let pageId;
    let valid = true;

    // Search query, only returns one result
    await fetch(searchURL + "?action=query&format=json&list=search&srlimit=1&srsearch=" + searchTerm)
        .then(data => data.json())
        .then(data => {
            if (data.query.search.length == 0) {
                sentMessage.edit("", {
                    embed: {
                        title: "No results found."
                    }
                })
                valid = false;
            }
            else {
                pageTitle = decodeURIComponent(data.query.search[0].title);
                pageId = data.query.search[0].pageid
            }
        })
        .catch(e => { sentMessage.edit("```\nAn error occured. Check that " + currentSettings.wiki + " is a valid MediaWiki wiki, then try again\n```"); console.error(e) });

    // Prevents editing over "No results found."
    if (!valid) { return }



    // Scrape thumbnail from provided page     
    let thumbnail;

    let urlText = await fetch("https://" + currentSettings.wiki + "/wiki/" + pageTitle).then(data => data.text());
    // console.log(urlText.substring(0, 9000));
    let scrapedImage = urlText.match(/<meta property="og:image" content="(.*)"/i);

    if (scrapedImage !== null) {
        thumbnail = scrapedImage[1];
    }


    // Scrape excerpt from page if it's a FANDOM page - no API
    let excerpt;
    let categories = [];

    if (searchURL.includes(".fandom.com")) {
        let scrapedDescription = urlText.match(/<meta name="description" content="(.*)"/i);

        if (scrapedDescription !== null) {
            excerpt = scrapedDescription[1];
        }
    }
    else {
        // Get excerpt from the page through API
        await fetch(searchURL + "?action=query&format=json&prop=extracts&exchars=300&explaintext=1&titles=" + pageTitle)
            .then(data => data.json())
            .then(data => {
                excerpt = data.query.pages[pageId].extract ?? undefined;
            })
            .catch(e => console.error(e));
    }


    // Get categories from the page if no excerpt is avaliable
    if (excerpt === undefined) {
        await fetch(searchURL + "?action=query&format=json&prop=categories&titles=" + pageTitle)
            .then(data => data.json())
            .then(data => {
                if (data.query.pages[pageId].categories !== undefined) {
                    for (let cat of data.query.pages[pageId].categories) {
                        if (categories.length < 5) {
                            categories.push(cat.title.replace("Category:", ""));
                        }
                        else {
                            break;
                        }
                    }
                }
            })
            .catch(e => console.error(e));

        categories = "Categories: " + (categories.join(", ") || "None");
    }


    let pageUrl = "https://";

    // Gamepedia doesn't need /wiki/ to access pages
    if (currentSettings.wiki.includes(".gamepedia.com")) {
        pageUrl += currentSettings.wiki + "/" + encodeURIComponent(pageTitle);
    }
    else {
        pageUrl += currentSettings.wiki + "/wiki/" + encodeURIComponent(pageTitle);
    }

    sentMessage.edit("", {
        embed: {
            url: pageUrl,
            title: pageTitle,
            description: htmlDecode(excerpt ?? categories),
            thumbnail: {
                url: thumbnail
            }
        }
    });
}

function cmdHelp(message, serverSettings) {
    message.channel.send({
        embed: {
            url: "https://www.github.com/CatThingy/wiki-search",
            title: "WikiSearch",
            fields: [
                {
                    name: serverSettings.prefix + "help",
                    value: "Shows this message."
                },
                {
                    name: serverSettings.prefix + "config [channel?] [setting] [value]",
                    value: "Configures this bot. Use " + serverSettings.prefix + "config by itself to see possible options. Linking a channel sets settings for that channel only (prefix not included)."
                },
                {
                    name: serverSettings.prefix + "search [value]",
                    value: "Searches the wiki specified in the config for the term. \n"
                        + serverSettings.prefix + "[value] or putting your [[search term]] in two square brackets in a message also works."
                }
            ]
        }
    })
}
//#endregion

//#region Helper Functions
function htmlDecode(str) {
    return str.replace(/&gt/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#0*39;/g, "'")
}

function isTrue(value) {
    if (typeof (value) === 'string') {
        value = value.trim().toLowerCase();
    }
    switch (value) {
        case "true":
        case "1":
        case "on":
        case "yes":
            return true;
        default:
            return false;
    }
}
//#endregion
