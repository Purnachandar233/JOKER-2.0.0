const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "tictactoe",
    category: "fun",
    aliases: ["ttt"],
    description: "Play Tic Tac Toe with another player!",
    execute: async (message, args, client, prefix) => {
        const opponent = message.mentions.users.first();

        if (!opponent) {
            return message.reply("Please mention a player to play against! Example: `=tictactoe @user`");
        }

        if (opponent.id === message.author.id) {
            return message.reply("You can't play against yourself!");
        }

        if (opponent.bot && opponent.id !== client.user.id) {
            return message.reply("You can only play against real users or me!");
        }

        let board = Array(9).fill(null);
        let currentPlayer = message.author;
        const player1 = message.author;
        const player2 = opponent;

        const getEmoji = (index) => {
            if (board[index] === "X") return "❌";
            if (board[index] === "O") return "⭕";
            return `${index + 1}`;
        };

        const checkWinner = () => {
            const lines = [
                [0, 1, 2],
                [3, 4, 5],
                [6, 7, 8],
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8],
                [0, 4, 8],
                [2, 4, 6]
            ];

            for (let line of lines) {
                const [a, b, c] = line;
                if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                    return board[a];
                }
            }
            return null;
        };

        const isBoardFull = () => board.every(cell => cell !== null);

        const createGameEmbed = () => {
            const boardDisplay = `${getEmoji(0)} ${getEmoji(1)} ${getEmoji(2)}\n${getEmoji(3)} ${getEmoji(4)} ${getEmoji(5)}\n${getEmoji(6)} ${getEmoji(7)} ${getEmoji(8)}`;
            
            const embed = new EmbedBuilder()
                .setColor(client.embedColor || '#00ff00')
                .setTitle("Tic Tac Toe")
                .setDescription(boardDisplay)
                .addFields(
                    { name: "Player 1 (❌)", value: player1.username, inline: true },
                    { name: "Player 2 (⭕)", value: player2.username, inline: true },
                    { name: "Current Turn", value: currentPlayer.username, inline: false }
                )
                .setFooter({ text: "Click a button to make your move" });
            
            return embed;
        };

        const createGameButtons = () => {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ttt_${index}`)
                            .setLabel(getEmoji(index))
                            .setStyle(board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary)
                            .setDisabled(board[index] !== null)
                    );
                }
                rows.push(row);
            }
            return rows;
        };

        const gameMsg = await message.channel.send({
            embeds: [createGameEmbed()],
            components: createGameButtons()
        });

        const filter = (i) => i.customId.startsWith('ttt_') && i.user.id === currentPlayer.id;
        const collector = gameMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (interaction) => {
            const index = parseInt(interaction.customId.split('_')[1]);

            if (board[index] !== null) {
                return interaction.reply({ content: "That cell is already taken!", ephemeral: true });
            }

            board[index] = currentPlayer.id === player1.id ? "X" : "O";
            const winner = checkWinner();

            if (winner) {
                const winnerUser = winner === "X" ? player1 : player2;
                const winEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle("Game Over!")
                    .setDescription(`${winnerUser.username} wins! 🎉`)
                    .addField("Final Board", `${getEmoji(0)} ${getEmoji(1)} ${getEmoji(2)}\n${getEmoji(3)} ${getEmoji(4)} ${getEmoji(5)}\n${getEmoji(6)} ${getEmoji(7)} ${getEmoji(8)}`);
                
                await interaction.update({ embeds: [winEmbed], components: [] });
                collector.stop();
            } else if (isBoardFull()) {
                const drawEmbed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle("Game Over!")
                    .setDescription("It's a draw! 🤝")
                    .addField("Final Board", `${getEmoji(0)} ${getEmoji(1)} ${getEmoji(2)}\n${getEmoji(3)} ${getEmoji(4)} ${getEmoji(5)}\n${getEmoji(6)} ${getEmoji(7)} ${getEmoji(8)}`);
                
                await interaction.update({ embeds: [drawEmbed], components: [] });
                collector.stop();
            } else {
                currentPlayer = currentPlayer.id === player1.id ? player2 : player1;
                await interaction.update({
                    embeds: [createGameEmbed()],
                    components: createGameButtons()
                });
            }
        });

        collector.on('end', async () => {
            if (!collector.called) {
                gameMsg.edit({ content: "Game ended due to inactivity.", components: [] }).catch(() => {});
            }
        });
    }
};
