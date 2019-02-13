
var fs = require('fs');

/**
* Game States:
* 0: game in progress
* 1: game over, you won
* -1: game over, you lost
* 2: game waiting for user to set word
*/

var game_data = {
  words: null,
  games: {},
  pending_word_sets: {}
};

var get_words = async () => {
  var inputFile = 'words.txt';
  game_data.words = await fs.readFileSync(inputFile).toString().split(",");
};

var add_point = async (bot, serverID, userID) => {
  var leaderboard = await JSON.parse(fs.readFileSync('leaderboard.json', 'utf8'));
  var server_scores = leaderboard[serverID];

  // if this server does not yet have a leaderboard initialized
  if (!server_scores) {
    server_scores = init_leaderboard(bot, serverID);
  }

  // if the user is not in the leaderboard, get his info and add him
  if (!server_scores[userID]) {
    var user = bot.servers[serverID].members[userID];
    var name = bot.users[userID].username;

    server_scores[userID] = {
      name: name,
      nick: user.nick,
      score: 0
    }
  }

  server_scores[userID].score = server_scores[userID].score + 1;
  leaderboard[serverID] = server_scores;
  await fs.writeFileSync('leaderboard.json', JSON.stringify(leaderboard), 'utf8');
  return true;
};

var init_leaderboard = (bot, serverID) => {
  var server_scores = {};
  var members = bot.servers[serverID].members;

  for (var key in members) {
    if (key !== '540642170101694464') {
      var nick = members[key].nick
      var name = bot.users[key].username;

      server_scores[key] = {
        name: name,
        nick: nick,
        score: 0
      }
    }
  }

  return server_scores;
}

var public = {

  init_word: (word, channelID) => {

    var word_state = "";
    var valid = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    for (let i = 0; i < word.length; i++) {
      var letter = word[i];
      if (valid.indexOf(letter) == -1) {
        word_state += letter;
      } else {
        word_state += "_";
      }
    }
    console.log(word_state);
    game_data.games[channelID].word = word;
    game_data.games[channelID].word_state = word_state;
    game_data.games[channelID].game_over = 0;
  },

  calc_word_state: (channelID) => {
    return game_data.games[channelID].word_state.split('').join(' ');
  },

  get_letter_jail: (channelID) => {
    return game_data.games[channelID].letter_jail.join(" ");
  },

  get_game_state: (channelID) => {
    return game_data.games[channelID] ? game_data.games[channelID].game_over : -1;
  },

  get_letters: (channelID) => {
    if (!game_data.games[channelID] || game_data.games[channelID].alphabet == undefined) {
      return undefined;
    }

    return game_data.games[channelID].alphabet.join(" ")
  },

  set_pending_word: (userID, channelID) => {
    game_data.pending_word_sets[userID] = channelID;
  },

  get_pending_channel: (userID) => {
    var channelID = game_data.pending_word_sets[userID];
    delete game_data.pending_word_sets[userID];
    return channelID;
  },

  get_pending_user: (channelID) => {
    return game_data.games[channelID].user;
  },

  init_game: async (channelID, state = 0, userID = undefined) => {

    game_data.games[channelID] = {
      game_over: state,
      word: "",
      word_state: "",
      alphabet: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
      letter_jail: [],
      used_letters: [],
      turns_left: 10,
      user: userID
    }

    // wait for word to be set.
    if (state == 2) {
      return true;
    } else {

      if (!game_data.words) {
        await get_words();
      }

      var random = Math.floor(Math.random() * 10721);
      var word = game_data.words[random].toUpperCase();

      public.init_word(word, channelID);

      return word;
    }
  },

  guess: async (guessed_letter, channelID, bot, serverID, userID) => {

    if (!game_data.games[channelID]) {
      return undefined;
    }

    var index = game_data.games[channelID].alphabet.indexOf(guessed_letter);
    if (index == -1) {
      return game_data.games[channelID].turns_left;
    } else {
      game_data.games[channelID].alphabet.splice(index, 1);
    }

    var word = game_data.games[channelID].word;
    var letter_index = word.indexOf(guessed_letter);

    if (letter_index == -1) {
      // add letter to letter jail and draw next element
      game_data.games[channelID].letter_jail.push(guessed_letter);
      game_data.games[channelID].turns_left--;

      // check if you lost
      if (game_data.games[channelID].turns_left == 0) {
        game_data.games[channelID].game_over = -1;
        game_data.games[channelID].word_state = game_data.games[channelID].word;
        console.log("You Lost");
      }
    }
    else {
      // add letter to used letters
      game_data.games[channelID].used_letters.push(guessed_letter);
      while (letter_index != -1) {

        var word_state = game_data.games[channelID].word_state;
        // add letter to the word state
        game_data.games[channelID].word_state = word_state.substr(0, letter_index) + guessed_letter + word_state.substr(letter_index + 1);

        // check if you lost
        if (game_data.games[channelID].word_state == game_data.games[channelID].word) {
          game_data.games[channelID].game_over = 1;
          if (serverID) await add_point(bot, serverID, userID);
          console.log("You Won!");
        }

        // replace the letter we just checked with a blank in word temporarily so we can check for more of the letter
        word = word.substr(0, letter_index) + "_" + word.substr(letter_index + 1);
        letter_index = word.indexOf(guessed_letter);
      }
    }

    return game_data.games[channelID].turns_left;
  },

  get_score: async (bot, channelID) => {
    var leaderboard = await JSON.parse(fs.readFileSync('leaderboard.json', 'utf8'));
    var channel = bot.channels[channelID];
    if (!channel) return "You are the only one here silly. Of course you are winning."
    var serverID = channel.guild_id;
    var server_scores = leaderboard[serverID];

    if (!server_scores) {
      server_scoers = init_leaderboard(bot, serverID);
      console.log(server_scores);
      leaderboard[serverID] = server_scores;
      await fs.writeFileSync('leaderboard.json', JSON.stringify(leaderboard), 'utf8');
    }

    var msg = '---LeaderBoard---\n\n';
    for (var userID in server_scores) {
      var display_name = server_scores[userID].nick ? server_scores[userID].nick : server_scores[userID].name;
      msg += `**${display_name}:** ${server_scores[userID].score}\n`
    }

    return msg;
  },

  get_body_parts: (channelID) => {
    switch (game_data.games[channelID].turns_left) {

      case 10: return `
  ⁞
`;
      case 9: return `
  ⁞
 ( )
 `;
      case 8: return `
  ⁞
 ( )
  |
`;
      case 7: return `
  ⁞
 ( )
 \\|
`;
      case 6: return `
  ⁞
 ( )
 \\|/
`;
      case 5: return `
  ⁞
 ( )
 \\|/
  |
`;
      case 4: return `
  ⁞
 ( )
 \\|/
  |
 /
`;
      case 3: return `
  ⁞
 ( )
 \\|/
  |
 / \\
`;
      case 2: return `
  ⁞
(• •)
 \\|/
  |
 / \\
`;
      case 1: return `
  ⁞
(•◡•)
 \\|/
  |
 / \\
`;
      case 0: return `
  ⁞
(×_×)
 \\|/
  |
 / \\
`;
    }
  }
};

module.exports = public;