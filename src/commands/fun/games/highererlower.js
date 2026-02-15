const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "highererlower",
    category: "fun",
    aliases: ["hol"],
    description: "Play Higher or Lower with another player!",
    execute: async (message, args, client, prefix) => {
        const opponent = message.mentions.users.first();

        if (!opponent) {
            return message.reply("Please mention a player to play against! Example: `=highererlower @user`");
        }

        if (opponent.id === message.author.id) {
            return message.reply("You can't play against yourself!");
        }

        let currentCard = Math.floor(Math.random() * 13) + 1;
        const cardNames = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        let player1Score = 0;
        let player2Score = 0;
        let currentPlayer = message.author;
        let round = 1;
        const maxRounds = 5;

        const getCardEmoji = (card) => {
            const suits = ['♠️', '♥️', '♦️', '♣️'];
            const suit = suits[Math.floor(Math.random() * suits.length)];
            return `${cardNames[card - 1]}${suit}`;
        };

        const playRound = async () => {
            const nextCard = Math.floor(Math.random() * 13) + 1;
            
            return new Promise((resolve) => {
                const createRoundEmbed = () => {
                    return new EmbedBuilder()
                        .setColor(client.embedColor || '#3498db')
                        .setTitle("Higher or Lower")
                        .setDescription(`Current Card: ${getCardEmoji(currentCard)}`)
                        .addFields(
                            { name: "Your Challenge", value: `Is the next card higher or lower?`, inline: false },
                            { name: "Scores", value: `${message.author.username}: ${player1Score} | ${opponent.username}: ${player2Score}`, inline: false },
                            { name: "Round", value: `${round}/${maxRounds}`, inline: false }
                        )
                        .setFooter({ text: `${currentPlayer.username}'s turn` });
                };

                const roundMsg = message.channel.send({
                    embeds: [createRoundEmbed()],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('hol_higher')
                                .setLabel('⬆️ Higher')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('hol_lower')
                                .setLabel('⬇️ Lower')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('hol_equal')
                                .setLabel('= Equal')
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ]
                }).then(msg => {
                    const filter = (i) => i.user.id === currentPlayer.id && i.customId.startsWith('hol_');
                    const collector = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', (interaction) => {
                        const guess = interaction.customId.split('_')[1];
                        let correct = false;

                        if (guess === 'higher' && nextCard > currentCard) correct = true;
                        if (guess === 'lower' && nextCard < currentCard) correct = true;
                        if (guess === 'equal' && nextCard === currentCard) correct = true;

                        if (correct) {
                            if (currentPlayer.id === message.author.id) {
                                player1Score++;
                            } else {
                                player2Score++;
                            }
                        }

                        const resultEmbed = new EmbedBuilder()
                            .setColor(correct ? '#00ff00' : '#ff0000')
                            .setTitle(correct ? "✅ Correct!" : "❌ Wrong!")
                            .addFields(
                                { name: "Your Card", value: getCardEmoji(currentCard), inline: true },
                                { name: "Next Card", value: getCardEmoji(nextCard), inline: true },
                                { name: "Your Guess", value: guess.charAt(0).toUpperCase() + guess.slice(1), inline: false },
                                { name: "Scores", value: `${message.author.username}: ${player1Score} | ${opponent.username}: ${player2Score}`, inline: false }
                            );

                        interaction.update({ embeds: [resultEmbed], components: [] }).then(() => {
                            currentCard = nextCard;
                            currentPlayer = currentPlayer.id === message.author.id ? opponent : message.author;
                            round++;
                            resolve();
                        });
                    });

                    collector.on('end', (collected) => {
                        if (collected.size === 0) {
                            msg.edit({ content: "Round skipped due to inactivity.", components: [] });
                            currentPlayer = currentPlayer.id === message.author.id ? opponent : message.author;
                            round++;
                            resolve();
                        }
                    });
                });
            });
        };

        while (round <= maxRounds) {
            await playRound();
            if (round <= maxRounds) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const winner = player1Score > player2Score ? message.author.username : 
                       player2Score > player1Score ? opponent.username : 
                       "Tie!";

        const finalEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle("🏆 Game Over!")
            .setDescription(`Winner: **${winner}**`)
            .addFields(
                { name: "Final Scores", value: `${message.author.username}: ${player1Score}\n${opponent.username}: ${player2Score}`, inline: false }
            );

        message.channel.send({ embeds: [finalEmbed] });
    }
};
