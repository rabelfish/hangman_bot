var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var hangman = require('./hangman');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
  colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
bot.on('ready', function (evt) {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', async function (user, userID, channelID, message, evt) {
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!`
  var prefix = message.substring(0, 1);

  if (prefix == '!') {

    /** SET WORD **/
    if (message == "!set word") {
      if (message.guild != null) {
        bot.sendMessage({
          to: channelID,
          message: 'Please request to set a word in a server and then the bot will DM you for the word.'
        });
      } else {

        // add userId and channelID to pending_word_sets
        hangman.set_pending_word(userID, channelID);
        // init game and set state to 2
        hangman.init_game(channelID, 2, userID);

        bot.sendMessage({
          to: channelID,
          message: 'Okay <@' + userID + '> Please check your DM\'s to set the word!'
        });

        bot.sendMessage({
          to: userID,
          message: 'Hi ' + user + '. It looks like you requested to set a word in hangman!\n\n Please reply to this message with the word you would like to set.\n\n \*\*Guessable characters include the english alphabet a-z. Case does not matter. All other UTF-8 characters are accepted but will not be hidden.'
        });
      }
    } else {

      var args = message.substring(1).split(' ');
      var cmd = args[0];

      args = args.splice(1);

      /** GUESS **/
      if (cmd.length == 1 && hangman.get_game_state(channelID) === 0) {
        // guess letter
        var guesses = hangman.guess(cmd.toUpperCase(), channelID);

        if (guesses == undefined) {
          bot.sendMessage({
            to: channelID,
            message: 'There is currently no game.'
          });
        } else {

          var game_state = hangman.get_game_state(channelID);

          if (game_state === 1) {

            var man = `
(ᵔ◡ᵔ)
 \\|/
  |
 / \\`;
            bot.sendMessage({
              to: channelID,
              message: 'You Won!!' +
                '\n\n```' + man + ' ```' +
                '\n\nHere\'s your word:\n```css\n' + hangman.calc_word_state(channelID) + '```'
            });
          } else if (game_state === -1) {
            bot.sendMessage({
              to: channelID,
              message: 'You Lost :(' +
                '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                '\n\nHere\'s your word:\n```css\n' + hangman.calc_word_state(channelID) + '```'
            });
          } else {

            bot.sendMessage({
              to: channelID,
              message: 'Letter Jail: ``` ' + hangman.get_letter_jail(channelID) + ' ```' +
                '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                '\n\nHere\'s your word:\n```css\n' + hangman.calc_word_state(channelID) + '```' +
                '\n\n>You have ' + guesses + ' guesses left. Guess a letter! Example: !E'
            });
          }
        }
      } else {

        switch (cmd) {
          /** HELP **/
          case 'help':
            bot.sendMessage({
              to: channelID,
              message: '\n**Commands:**\n\n`!help: show commands`\n`!play: start a new game`\n`!set word: ask the bot to DM you to set a word for a game in this server`\n`!state: show state of the game`\n`!letters: show unguessed letters`\n`![a-zA-Z]: guess this letter`'
            });
            break;
          /** PLAY **/
          case 'play':

            var word = await hangman.init_game(channelID);
            console.log(word);

            bot.sendMessage({
              to: channelID,
              message: 'Letter Jail: ``` ' + hangman.get_letter_jail(channelID) + ' ```' +
                '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                '\n\nHere\'s your word:\n```\n' + hangman.calc_word_state(channelID) + '```' +
                '\n\n>You have 10 guesses left. Guess a letter! Example: !E'
            });
            break;
          /** LETTERS **/
          case 'letters':
            var letters = hangman.get_letters(channelID);
            var state = hangman.get_game_state(channelID);

            if (state == undefined || state == 1 || state == -1) {
              bot.sendMessage({
                to: channelID,
                message: 'There is currently no game.'
              });
            } else if (state == 2) {

              var pending_user = hangman.get_pending_user(channelID);
              bot.sendMessage({
                to: channelID,
                message: 'Game is waiting for <@' + pending_user + '> to set a word. You can start a new game without them if you want.'
              });
            } else {
              bot.sendMessage({
                to: channelID,
                message: 'Here are the letters you have not guessed: ```' + letters + ' ```'
              });
            }
            break;
          /** STATE **/
          case 'state':

            var state = hangman.get_game_state(channelID);

            if (state === undefined || state == 1 || state == -1) {
              bot.sendMessage({
                to: channelID,
                message: 'There is currently no game.'
              });

            } else if (state == 2) {

              var pending_user = hangman.get_pending_user(channelID);
              bot.sendMessage({
                to: channelID,
                message: 'Game is waiting for <@' + pending_user + '> to set a word. You can start a new game without them if you want.'
              });

            } else {

              var guesses = hangman.guess('?', channelID);

              bot.sendMessage({
                to: channelID,
                message: 'Letter Jail: ``` ' + hangman.get_letter_jail(channelID) + ' ```' +
                  '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                  '\n\nHere\'s your word:\n```\n' + hangman.calc_word_state(channelID) + '```' +
                  '\n\n>You have ' + guesses + ' guesses left. Guess a letter! Example: !E'
              });
            }
            break;
        }
      }
    }
  } else {
    var pendingID = hangman.get_pending_channel(userID);

    /** SET WORD **/
    if (pendingID !== undefined) {

      var word = message.toUpperCase();

      hangman.init_word(word, pendingID);

      bot.sendMessage({
        to: channelID,
        message: 'Okay, the word is set as `' + word + '`'
      });

      bot.sendMessage({
        to: pendingID,
        message: 'Letter Jail: ``` ' + hangman.get_letter_jail(pendingID) + ' ```' +
          '\n\n```' + hangman.get_body_parts(pendingID) + ' ```' +
          '\n\nHere\'s your word:\n```\n' + hangman.calc_word_state(pendingID) + '```' +
          '\n\n>You have 10 guesses left. Guess a letter! Example: !E'
      });
    }
  }
});
