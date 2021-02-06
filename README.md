# wiki-search
A Discord bot to easily link pages from any MediaWiki wiki.  

## Setup

Clone the repository and run `npm install`. Replace `token` in `config.json` with your bot's token.
  
  
After the bot is invited to a server, these commands are recommended:

`w!config wiki [wiki]` to set up the wiki to use for the bot.  
`w!config prefix [prefix]` if the prefix conflicts with any other bot.

---

## Commands

### Quick links:
[`help`](#help)  
[`config`](#config)  
[`search`](#search)  

---
### `help`
Lists command syntax and links to this page.

---

### `config`
Usage: `config [channel?] [setting] [value?]`  

Gets or sets the configuration of the bot. Using `config` by itself lists all settings. Using `config [setting]` gets the current value of the specified setting. Using `config [channel] [setting] [value]` sets/gets settings specifically for the linked channel.

Valid settings are `enabled` for toggling the bot, `prefix` for the bot prefix and `wiki` for the MediaWiki wiki to search.   
*`prefix` cannot be changed for individual channels.*

Aliases: `settings`, `set`

---

### `search`
Usage: `search [term]`  

Searches the specified MediaWiki for the term, then links it with a list of categories.  

Can also be run with just the prefix and then the search term for convenience, or wrapping the search term in [[double square brackets]] within a message.

Aliases: `find`, `wiki`, `article`
