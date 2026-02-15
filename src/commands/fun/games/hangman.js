const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "hangman",
    category: "fun",
    description: "Play Hangman - Guess the word before running out of lives!",
    execute: async (message, args, client, prefix) => {
        const words = [
            "javascript", "programming", "discord", "hangman", "development",
            "computer", "technology", "algorithm", "function", "database",
            "network", "security", "interface", "application", "library",
            "framework", "server", "client", "protocol", "encryption"
        ];

        const word = words[Math.floor(Math.random() * words.length)];
        let guessed = new Set();
        let wrongGuesses = new Set();
        let lives = 6;

        const getDisplay = () => {
            return word.split('').map(letter => 
                guessed.has(letter) ? letter : '_'
            ).join(' ');
        };

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
            const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
            const available = alphabet.filter(letter => !guessed.has(letter) && !wrongGuesses.has(letter));

            return new EmbedBuilder()
                .setColor(lives === 0 ? '#ff0000' : lives <= 2 ? '#ffff00' : '#00ff00')
                .setTitle("Hangman")
                .setDescription(hangmanStages[6 - lives])
                .addFields(
                    { name: "Word", value: `\`${getDisplay()}\``, inline: false },
                    { name: "Lives", value: `${lives}/6 ❤️`, inline: true },
                    { name: "Wrong Guesses", value: wrongGuesses.size > 0 ? Array.from(wrongGuesses).join(', ').toUpperCase() : "None", inline: true },
                    { name: "Available Letters", value: available.length > 0 ? available.join(' ').toUpperCase() : "None", inline: false }
                )
                .setFooter({ text: "Click a letter to guess" });
        };

        const createLetterButtons = () => {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
            const rows = [];

            for (let i = 0; i < 26; i += 7) {
                const row = new ActionRowBuilder();
                for (let j = i; j < Math.min(i + 7, 26); j++) {
                    const letter = alphabet[j];
                    const isGuessed = guessed.has(letter) || wrongGuesses.has(letter);

                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`hangman_${letter}`)
                            .setLabel(letter.toUpperCase())
                            .setStyle(isGuessed ? ButtonStyle.Secondary : ButtonStyle.Primary)
                            .setDisabled(isGuessed || lives === 0 || guessed.size + wrongGuesses.size === 26)
                    );
                }
                rows.push(row);
            }
            return rows;
        };

        const gameMsg = await message.channel.send({
            embeds: [createGameEmbed()],
            components: createLetterButtons()
        });

        const filter = (i) => i.customId.startsWith('hangman_');
        const collector = gameMsg.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (interaction) => {
            const letter = interaction.customId.split('_')[1];

            if (word.includes(letter)) {
                guessed.add(letter);

                if (guessed.size === word.length) {
                    const winEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle("You Won! 🎉")
                        .setDescription(`The word was: **${word}**`);
                    
                    await interaction.update({ embeds: [winEmbed], components: [] });
                    collector.stop();
                } else {
                    await interaction.update({
                        embeds: [createGameEmbed()],
                        components: createLetterButtons()
                    });
                }
            } else {
                wrongGuesses.add(letter);
                lives--;

                if (lives === 0) {
                    const loseEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle("Game Over! 💀")
                        .setDescription(`The word was: **${word}**`)
                        .addField("Hangman", hangmanStages[6]);
                    
                    await interaction.update({ embeds: [loseEmbed], components: [] });
                    collector.stop();
                } else {
                    await interaction.update({
                        embeds: [createGameEmbed()],
                        components: createLetterButtons()
                    });
                }
            }
        });

        collector.on('end', () => {
            if (!collector.called && lives !== 0) {
                gameMsg.edit({ content: "Game ended due to inactivity.", components: [] }).catch(() => {});
            }
        });
    }
};
