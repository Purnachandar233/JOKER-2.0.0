const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType
} = require("discord.js");

module.exports = {
  name: "hangman",
  category: "fun",
  description: "Play Hangman - Guess the word before running out of lives!",
  execute: async (message) => {
    const words = [
      "javascript", "programming", "discord", "hangman", "development",
      "computer", "technology", "algorithm", "function", "database",
      "network", "security", "interface", "application", "library",
      "framework", "server", "client", "protocol", "encryption"
    ];

    const word = words[Math.floor(Math.random() * words.length)];
    const guessed = new Set();
    const wrongGuesses = new Set();
    let lives = 6;

    const getDisplay = () => word
      .split("")
      .map(letter => (guessed.has(letter) ? letter : "_"))
      .join(" ");

    const isWordSolved = () => word.split("").every(letter => guessed.has(letter));

    const hangmanStages = [
      "```\n  +-----+\n  |     |\n        |\n        |\n        |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n        |\n        |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n  |     |\n        |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n \\|     |\n        |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n \\|/    |\n        |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n \\|/    |\n  |     |\n        |\n  +-----+```",
      "```\n  +-----+\n  |     |\n  O     |\n \\|/    |\n  |     |\n / \\    |\n  +-----+```"
    ];

    const createGameEmbed = () => {
      const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
      const available = alphabet.filter(letter => !guessed.has(letter) && !wrongGuesses.has(letter));

      return new EmbedBuilder()
        .setColor(lives === 0 ? "#ff0000" : lives <= 2 ? "#ffff00" : "#00ff00")
        .setTitle("Hangman")
        .setDescription(hangmanStages[6 - lives])
        .addFields(
          { name: "Word", value: `\`${getDisplay()}\``, inline: false },
          { name: "Lives", value: `${lives}/6`, inline: true },
          {
            name: "Wrong Guesses",
            value: wrongGuesses.size > 0 ? Array.from(wrongGuesses).join(", ").toUpperCase() : "None",
            inline: true
          },
          {
            name: "Available Letters",
            value: available.length > 0 ? available.join(" ").toUpperCase() : "None",
            inline: false
          }
        )
};

    const createLetterMenus = () => {
      const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
      const groups = [
        { id: "hangman_letters_1", placeholder: "Pick a letter (A-M)", letters: alphabet.slice(0, 13) },
        { id: "hangman_letters_2", placeholder: "Pick a letter (N-Z)", letters: alphabet.slice(13) }
      ];

      return groups.map(group => {
        const availableLetters = group.letters.filter(letter => !guessed.has(letter) && !wrongGuesses.has(letter));
        const menu = new StringSelectMenuBuilder()
          .setCustomId(group.id)
          .setMinValues(1)
          .setMaxValues(1);

        if (availableLetters.length === 0 || lives === 0 || isWordSolved()) {
          menu
            .setPlaceholder(`${group.placeholder} - done`)
            .setDisabled(true)
            .addOptions([{ label: "No letters left", value: `none_${group.id}` }]);
        } else {
          menu
            .setPlaceholder(group.placeholder)
            .addOptions(
              availableLetters.map(letter => ({
                label: letter.toUpperCase(),
                value: letter,
                description: `Guess ${letter.toUpperCase()}`
              }))
            );
        }

        return new ActionRowBuilder().addComponents(menu);
      });
    };

    const gameMsg = await message.channel.send({
      embeds: [createGameEmbed()],
      components: createLetterMenus()
    });

    const collector = gameMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120000,
      filter: i => i.customId.startsWith("hangman_letters_")
    });

    collector.on("collect", async interaction => {
      if (interaction.user.id !== message.author.id) {
        await interaction.reply({
          content: `Only <@${message.author.id}> can play this Hangman game.`,
          ephemeral: true
        }).catch(() => {});
        return;
      }

      const letter = interaction.values?.[0];
      if (!letter || letter.startsWith("none_")) {
        await interaction.deferUpdate().catch(() => {});
        return;
      }

      if (guessed.has(letter) || wrongGuesses.has(letter)) {
        await interaction.reply({ content: "That letter was already guessed.", ephemeral: true }).catch(() => {});
        return;
      }

      if (word.includes(letter)) {
        guessed.add(letter);

        if (isWordSolved()) {
          const winEmbed = new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle("You Won")
            .setDescription(`The word was: **${word}**`);

          await interaction.update({ embeds: [winEmbed], components: [] }).catch(() => {});
          collector.stop("completed");
          return;
        }
      } else {
        wrongGuesses.add(letter);
        lives--;

        if (lives === 0) {
          const loseEmbed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("Game Over")
            .setDescription(`The word was: **${word}**`)
            .addFields({ name: "Hangman", value: hangmanStages[6] });

          await interaction.update({ embeds: [loseEmbed], components: [] }).catch(() => {});
          collector.stop("completed");
          return;
        }
      }

      await interaction.update({
        embeds: [createGameEmbed()],
        components: createLetterMenus()
      }).catch(() => {});
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "time" && lives !== 0 && !isWordSolved()) {
        await gameMsg.edit({ content: "Game ended due to inactivity.", components: [] }).catch(() => {});
      }
    });
  }
};
