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
        }, deletePrev);

        bot.sendMessage({
          to: userID,
          message: 'Hi ' + user + '. It looks like you requested to set a word in hangman!\n\n Please reply to this message with the word you would like to set.\n\n \\*\\*Word must be 850 characters or less.  \n\n \\*\\*Guessable characters include the english alphabet a-z. Case does not matter. All other UTF-8 characters are accepted but will not be hidden.\n\n \\*\\*Word cannot start with !'
        });
      }
    } else {

      var args = message.substring(1).split(' ');
      var cmd = args[0];

      args = args.splice(1);

      /** GUESS **/
      if (cmd.length == 1 && hangman.get_game_state(channelID) === 0) {
        // guess letter
        var serverID = bot.channels[channelID] ? bot.channels[channelID].guild_id : false;
        var guesses = await hangman.guess(cmd.toUpperCase(), channelID, bot, serverID, userID);

        if (guesses == undefined) {
          bot.sendMessage({
            to: channelID,
            message: 'There is currently no game.'
          }, deletePrev);
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
            }, deletePrev);
          } else if (game_state === -1) {
            bot.sendMessage({
              to: channelID,
              message: 'You Lost :(' +
                '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                '\n\nHere\'s your word:\n```css\n' + hangman.calc_word_state(channelID) + '```'
            }, deletePrev);
          } else {

            bot.sendMessage({
              to: channelID,
              message: 'Letter Jail: ``` ' + hangman.get_letter_jail(channelID) + ' ```' +
                '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                '\n\nHere\'s your word:\n```css\n' + hangman.calc_word_state(channelID) + '```' +
                '\n\n>You have ' + guesses + ' guesses left. Guess a letter! Example: !E'
            }, deletePrev);
          }
        }
      } else {

        switch (cmd) {
          /** HELP **/
          case 'help':
            var msg = '\n**Commands:**\n\n`!help: show commands`\n`!score: show the leaderboard`\n`!play: start a new game with a random word`\n`!set word: ask the bot to DM you to set a word for a game in this server`\n`!state: show state of the game`\n`!letters: show unguessed letters`\n`![a-zA-Z]: guess this letter`';

            msg += '\n\n You can also DM hangman to play a private game!'

            bot.sendMessage({
              to: channelID,
              message: msg
            }, deletePrev);
            break;
          /** SCORE */
          case 'score':
            // if (channelID == 544606962206113794) {
            var score = await hangman.get_score(bot, channelID);

            bot.sendMessage({
              to: channelID,
              message: score
            }, deletePrev);
            // }
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
            }, deletePrev);
            break;
          /** LETTERS **/
          case 'letters':
            var letters = hangman.get_letters(channelID);
            var state = hangman.get_game_state(channelID);

            if (state == undefined || state == 1 || state == -1) {
              bot.sendMessage({
                to: channelID,
                message: 'There is currently no game.'
              }, deletePrev);
            } else if (state == 2) {

              var pending_user = hangman.get_pending_user(channelID);
              bot.sendMessage({
                to: channelID,
                message: 'Game is waiting for <@' + pending_user + '> to set a word. You can start a new game without them if you want.'
              }, deletePrev);
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
              }, deletePrev);

            } else if (state == 2) {

              var pending_user = hangman.get_pending_user(channelID);
              bot.sendMessage({
                to: channelID,
                message: 'Game is waiting for <@' + pending_user + '> to set a word. You can start a new game without them if you want.'
              }, deletePrev);

            } else {

              var guesses = await hangman.guess('?', channelID);

              bot.sendMessage({
                to: channelID,
                message: 'Letter Jail: ``` ' + hangman.get_letter_jail(channelID) + ' ```' +
                  '\n\n```' + hangman.get_body_parts(channelID) + ' ```' +
                  '\n\nHere\'s your word:\n```\n' + hangman.calc_word_state(channelID) + '```' +
                  '\n\n>You have ' + guesses + ' guesses left. Guess a letter! Example: !E'
              }, deletePrev);
            }
            break;
        }
      }
    }
  } else {
    var pendingID = hangman.get_pending_channel(userID);

    var word = message.toUpperCase();

console.log(pendingID);

    /** SET WORD **/
    if (pendingID !== undefined && message.guild == undefined) {

      if (word.length > 850) {

          bot.sendMessage({
              to: channelID,
              message: "Your word is too long. Please try a word that is 850 characters or less."
          }, deletePrev);
      } else {
      	
	hangman.init_word(word, pendingID, userID);

      	bot.sendMessage({
        	to: channelID,
        	message: 'Okay, the word is set as `' + word + '`'
      	});

      	var to_send = 'Letter Jail: ``` ' + hangman.get_letter_jail(pendingID) + ' ```' +
          	'\n\n```' + hangman.get_body_parts(pendingID) + ' ```' +
          	'\n\nHere\'s your word:\n```\n' + hangman.calc_word_state(pendingID) + '```' +
          	'\n\n>You have 10 guesses left. Guess a letter! Example: !E';

      	bot.sendMessage({
        	to: pendingID,
        	message: to_send
      	}, deletePrev);
      }
    }
  }
});

var prevMessage = {};
var deletePrev = (error, response) => {
  if (error) {

  } else {
    var channelID = response.channel_id;

    // delete 
    if (prevMessage[channelID]) {
      bot.deleteMessage({
        channelID: channelID,
        messageID: prevMessage[channelID]
      });
    }

    prevMessage[channelID] = response.id;
  }
}
