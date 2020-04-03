const Discord = require('discord.js')
const client = new Discord.Client()
const officehours = require('./officehours')

client.on('message', message => {
    var args = message.content.split(" ")
    const cmd = args[0].toLowerCase()
    args.splice(0, 1)

    switch(cmd) {
        case "next":
        case "!next":
            officehours.onNext(client, message, args)
            break
        case "!queue":
            officehours.onQueue(client, message)
            break
        case "!remove":
            officehours.onRemove(client, message, args)
            break
        case "!help":
            officehours.onHelp(client, message)
    }
})

client.login(process.env.BOT_TOKEN)