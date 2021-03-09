/* eslint-disable no-console */
const moment = require('moment');





const ACK = '👍';
const NAK = '🛑';
const WARN = '⚠️';

var token = {
  access_token:""
};

const { OFFICE_HOURS, TA_CHANNEL, CLIENT_ID, CLIENT_SECRET } = process.env;

const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: "https://ta-bot-spotify.herokuapp.com",
});

const queue = [];
const dequeued = [];
const onlineTas = {};

function getNickname(message) {
  const member = message.guild.member(message.author);
  if (member.nickname !== null) {
    return member.nickname;
  }
  return member.user.username;
}

function getPosition(member) {
  for (let index = 0; index < queue.length; index += 1) {
    if (queue[index].author.id === member.id) return index;
  }
  return -1;
}

const isOnline = (member) => member.id in onlineTas;
const contains = (member) => getPosition(member) !== -1;

exports.cmds = {

  /**
   * A check to verify the bot is running, and listening.
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!ping': (message) => {
    message.react(ACK);
    message.reply('Pong!');
  },

  /**
   * Users can add themselves to the queue via the !next command.
   * If they are already in the queue it will let them know and
   * quit, otherwise acknowledge.
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!next': (message) => {
    if (message.channel.id !== OFFICE_HOURS) return;

    if (Object.values(onlineTas).length === 0) {
      message.react(NAK);
      message.reply("Sorry there are no TA's on.");
      return;
    }
    if (!Object.values(onlineTas).filter((onlineTa) => !onlineTa.hidden).length) {
      message.react(NAK);
      message.reply("⏰ Office hours are wrapping up and TA's are no longer taking new questions.");
      return;
    }

    if (contains(message.author)) {
      message.react(NAK);
      message.reply('You are already in the queue.')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      message.delete({ timeout: 5 * 1000 });
      return;
    }

    queue.push(message);

    message.react(ACK);
    message.reply(`You are now #${queue.length} in the queue.`)
      .then((msg) => msg.delete({ timeout: 10 * 1000 }));
  },

  /**
   * If a user needs to leave the queue they can use the !leave command.
   * This will remove them if they are in the queue, otherwise NAK.
   *
   * DEV Note: This potentially could be where the TA-leave functionality goes
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!leave': (message) => {
    if (OFFICE_HOURS === message.channel.id) {
      if (!contains(message.author)) {
        message.react(NAK);
        message.delete({ timeout: 10 * 1000 });
        return;
      }

      queue.splice(getPosition(message.author), 1);
      message.react(ACK);
      message.reply('Goodbye :wave:')
        .then((msg) => msg.delete({ timeout: 10 * 1000 }));
      message.delete({ timeout: 5 * 1000 });
    }
  },

   /**
   * If a user needs to leave the queue they can use the !leave command.
   * This will remove them if they are in the queue, otherwise NAK.
   *
   * DEV Note: This potentially could be where the TA-leave functionality goes
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!song': (message) => {
    if (OFFICE_HOURS === message.channel.id) {
oauth.tokenRequest({
    // clientId, clientSecret and redirectUri are omitted, as they were already set on the class constructor
    grantType: "authorization_code",
    code: "https://discord.com/api/oauth2/authorize?client_id=818695837315104829&redirect_uri=https%3A%2F%2Fta-bot-spotify.herokuapp.com&response_type=code&scope=connections",
    scope: "connections",

}).then((data) => token.access_token = data.access_token)
message.react(ACK);
message.reply(token.access_token);
    }
  },

  
  /**
   * TA's can use this command to empty the queue.
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!clear': (message) => {
    if (TA_CHANNEL !== message.channel.id) return;

    if (queue.length === 0) {
      message.react(WARN);
      message.channel.send('```nimrod\nThe queue is currently empty```');
      return;
    }

    /* Goes through entire queue and finds the student's 'next' message and removes it */
    for (let i = queue.length - 1; i >= 0; i -= 1) queue[i].delete();

    queue.length = 0;
    message.channel.send('```nimrod\nThe queue is now empty!```');
    message.react(ACK);
  },

  /**
   * TA's can use the !queue command to view the current items in the queue.
   * Student's can use the !queue command to view how many people are in the queue,
   * and where they are (if they are in the queue).
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!queue': (message) => {
    if (OFFICE_HOURS === message.channel.id) {
      message.react(ACK);

      if (queue.length === 0) {
        message.channel.send('```nimrod\nThe queue is currently empty```');
        return;
      }

      let body = `\`\`\`nimrod\nThere are currently ${queue.length} people in the queue.`;

      if (contains(message.author)) {
        body += `You are #${getPosition(message.author) + 1}!`;
      }

      message.channel.send(`${body}\`\`\``);
    } else if (TA_CHANNEL === message.channel.id) {
      message.react(ACK);

      if (queue.length === 0) {
        message.channel.send('```nimrod\nThe queue is currently empty```');
        return;
      }

      const body = [];

      for (let i = 0; i < queue.length; i += 1) {
        const msg = queue[i];
        const desc = msg.content.substring(6); // remove '!next '
        body.push(`${i}) ${getNickname(msg)} "${desc}"\t\t [${moment(msg.createdTimestamp).fromNow()}]`);
      }

      message.channel.send(`\`\`\`nimrod\n${body.join('\n')}\`\`\``);
    }
  },

  /**
   * If a TA accidentally readied a student, and needs to put them back in the queue.
   * '!undo' will automatically put the last dequeued member back to the front of the queue.
   *
   * If the bot does not remember any recent readied students, it will tell the TA.
   *
   * There is currently no bot process for letting the user know it was an accident.
   *
   * @param {Object} message - The discord message object to interact with.
   */
  '!undo': (message) => {
    if (TA_CHANNEL === message.channel.id) {
      if (dequeued.length === 0) {
        message.react(NAK);
        message.reply('```nimrod\nThere is currently nothing in the dequeue cache.```');
        return;
      }
      queue.splice(0, 1, dequeued.pop());
      message.react(ACK);
      message.reply("```nimrod\nDone! Don't screw up next time!```");
    }
  },

  /**
   * TA's can use this command to remove items from the queue. If there is no one in the queue,
   * or the index is invalid it the TA will be warned.
   *
   * @param {Object} message - The discord message object to interact with.
   * @param {string[]} args - The first element in the array should be a number string
   * representing an index in the queue.
   */
  '!remove': (message, args) => {
    if (TA_CHANNEL !== message.channel.id) return;
    if (!isOnline(message.author)) {
      message.react(NAK);
      message.reply("You are offline. Can't remove.")
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    if (args.length === 0 || Number.isNaN(args[0])) {
      message.react(NAK);
      message.reply('Please provide an index to remove.')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      message.reply('`!remove <index>`')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    const removeIndex = parseInt(args[0], 10);
    if (removeIndex >= queue.length) {
      message.react(NAK);
      message.reply('Invalid index.')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    message.react(ACK);
    queue.splice(removeIndex, 1);
  },

  /**
   * TA's can use this command to notify students they are ready for them. If no index is provided,
   * it will use the first item in the queue. If the queue is empty warn the user.
   *
   * @param {Object} message - The discord message object to interact with.
   * @param {string[]} args - If provided the first element in the array should be a string number
   * representing a index in the queue to ready up.
   */
  '!ready': (message, args) => {
    if (TA_CHANNEL !== message.channel.id) return;
    if (!isOnline(message.author)) {
      message.react(NAK);
      message.reply("You are offline. Can't ready up.")
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    if (queue.length === 0) {
      message.react(WARN);
      message.channel.send('```nimrod\nThe queue is currently empty```');
      return;
    }

    let readyIndex = 0;
    if (args.length > 0 && !Number.isNaN(args[0])) {
      readyIndex = parseInt(args[0], 10);
    }

    if (readyIndex < 0 || readyIndex >= queue.length) {
      message.react(NAK);
      message.reply('Invalid index.')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    const authorId = message.author.id;
    const msg = queue[readyIndex];

    if (onlineTas[authorId].last_ready_msg !== undefined) {
      onlineTas[authorId].last_ready_msg.delete();
    }

    msg.reply(`${message.author} is ready for you. Move to their office.`)
      .then((reply) => {
        onlineTas[authorId].last_ready_msg = reply;
      });

    onlineTas[authorId].last_helped_time = new Date();

    msg.delete();
    message.reply(`${message.author} is next. There are ${queue.length - 1} people left in the queue.`);

    dequeued.push(queue[readyIndex]);
    queue.splice(readyIndex, 1);

    message.react(ACK);
    message.delete({ timeout: 5 * 1000 });
  },

  /**
   * TA's use this command to make themselves appear as online, and notify the students.
   * If they are already online, warn them.
   *
   * @param {Object} message - Discord message object to interact with.
   * @param {string[]} args - The extent to which a TA wants to go online.
   */
  '!online': (message, args) => {
    if (TA_CHANNEL !== message.channel.id) return;
    if (isOnline(message.author) && !onlineTas[message.author.id].hidden) {
      message.reply('You are already online.')
        .then((msg) => msg.delete({ timeout: 5 * 1000 }));
      return;
    }

    message.react(ACK);

    if (args.length > 0 && args[0] === 'partial') {
      onlineTas[message.author.id] = { afk: false, hidden: true };
      return;
    }

    onlineTas[message.author.id] = { afk: false, hidden: false }; // Marks the author as 'online'
    message.guild.channels.cache.get(OFFICE_HOURS).send(`${message.author} is now online. Ready to answer questions! :wave:`);
  },

  /**
   * TA's use this command to make themselves appear offline, and notify the students.
   * If they are already offline, warn them.
   *
   * @param {Object} message - The discord message object to interact with.
   * @param {string[]} args - The extent to which a TA wants to go offline.
   */
  '!offline': (message, args) => {
    if (TA_CHANNEL !== message.channel.id) return;
    if (!isOnline(message.author)) {
      message.react(NAK);
      message.reply('You are already offline.')
        .then((msg) => msg.delete({ timeout: 10 * 1000 }));
      return;
    }

    message.react(ACK);

    if (args.length > 0 && args[0] === 'partial') {
      onlineTas[message.author.id].hidden = true; // Moves TA to hidden
      message.reply('You are now marked as offline, but you are still able to use certain commands offline.');
      message.guild.channels.cache.get(OFFICE_HOURS).send(`${message.author} is no longer taking questions. :x:`);
      return;
    }

    delete onlineTas[message.author.id];
    message.reply('You are now marked as offline. Some commands, like !ready, will not work.');
    message.guild.channels.cache.get(OFFICE_HOURS).send(`${message.author} is now offline. :x:`);
  },

  /**
   * TA's use this command if they need to be away from their keyboard for a moment.
   * If they are already online, warn them.
   *
   * @param {Object} message - Discord message object to interact with.
   */
  '!afk': (message) => {
    if (TA_CHANNEL !== message.channel.id) return;
    if (!isOnline(message.author)) {
      message.react(NAK);
      message.reply('You are not online.')
        .then((msg) => msg.delete({ timeout: 10 * 1000 }));
      return;
    }

    if (onlineTas[message.author.id].afk) {
      onlineTas[message.author.id].afk = true; // Moves TA to AFK
      message.reply(`You are now AFK. ${queue.length ? `Hurry back, there are ${queue.length} people left in the queue.` : ''}`);
      message.guild.channels.cache.get(OFFICE_HOURS).send(`${message.author} will be right back! :point_up:`);
      message.react(ACK);
    } else {
      onlineTas[message.author.id].afk = false; // Removes TA from being AFK
      message.reply("You are no longer AFK. Now, let's go answer some questions!");
      message.guild.channels.cache.get(OFFICE_HOURS).send(`${message.author} is back and ready to answer questions! :wave:`);
      message.react(ACK);
    }
  },

  /**
   * Any user can use this command to see a list of available commands for them. (Role-specific)
   *
   * @param {Object} message - The Discord message object to interact with.
   */
  '!help': (message) => {
    if (TA_CHANNEL === message.channel.id) {
      message.reply('```'
        + '!ping - simple test that responds with "pong".\n'
        + "!queue - view the queue w/ username, issue description, and how long they've been waiting.\n"
        + '!undo - quickly undo the ready command that removed them from the queue.\n'
        + '!remove [index] - removes user from queue at certain index. Does not alert the user.\n'
        + "!ready <index> - removes user from queue at index (top if index isn't provided). Alerts the user that the TA is ready.\n"
        + '!clear - removes all users from the queue and removes any next messages that were in the chat.\n'
        + "!online <partial> - sets your status to online and notifies students in their channel that you are ready to answer questions. Optional 'partial' parameter can be used if you want to go online, but not notify students.\n"
        + '!offline <partial> - sets your status to offline.\n\t With the partial flag, allows you to still ready students and access various commands.\n\t With the full flag, restricts you from being able to access any offline commands.\n'
        + '!afk - enables/disables yourself as away from keyboard (AFK). Useful if you need to grab something quick and will be right back.\n'
        + '!help - shows these commands.```');
      return;
    }
    message.reply('```'
      + "!next [issue] - adds a user to queue and responds with user's position in queue. Please provide an issue.\n"
      + '!queue - see your position in the queue.\n'
      + '!leave - removes you from the queue.\n'
      + '\nhelp - provides a list of commands and their functions.```');
  },
};
