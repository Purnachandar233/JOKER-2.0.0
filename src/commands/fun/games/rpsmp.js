const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "rps",
    category: "fun",
    aliases: ["rockpaperscissors"],
    description: "Play Rock Paper Scissors with another player using buttons!",
    execute: async (message, args, client, prefix) => {
        const opponent = message.mentions.users.first();

        if (!opponent) {
            return message.reply(`Please mention a player to play against! Example: \`${prefix || "="}rps @user\``);
        }

        if (opponent.id === message.author.id) {
            return message.reply("You can't play against yourself!");
        }

        let player1Choice = null;
        let player2Choice = null;
        let player1Score = 0;
        let player2Score = 0;
        let roundNumber = 1;
        const maxRounds = 3;

        const choiceEmojis = {
            rock: "🪨",
            paper: "📄",
            scissors: "✂️"
        };

        const determineWinner = () => {
            if (player1Choice === player2Choice) return "tie";

            if (player1Choice === "rock") {
                return player2Choice === "scissors" ? "player1" : "player2";
            }
            if (player1Choice === "paper") {
                return player2Choice === "rock" ? "player1" : "player2";
            }
            if (player1Choice === "scissors") {
                return player2Choice === "paper" ? "player1" : "player2";
            }
            return "tie";
        };

        const playRound = async () => new Promise((resolve) => {
            player1Choice = null;
            player2Choice = null;

            const roundEmbed = new EmbedBuilder()
                .setColor(client.embedColor || "#9b59b6")
                .setTitle(`Rock Paper Scissors - Round ${roundNumber}`)
                .addFields(
                    { name: player1Choice ? "Choice made" : "Waiting...", value: message.author.username, inline: true },
                    { name: player2Choice ? "Choice made" : "Waiting...", value: opponent.username, inline: true },
                    { name: "Scores", value: `${message.author.username}: ${player1Score}\n${opponent.username}: ${player2Score}`, inline: false }
                )
const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("rpsmp_rock")
                    .setLabel("Rock")
                    .setEmoji("🪨")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("rpsmp_paper")
                    .setLabel("Paper")
                    .setEmoji("📄")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("rpsmp_scissors")
                    .setLabel("Scissors")
                    .setEmoji("✂️")
                    .setStyle(ButtonStyle.Primary)
            );

            message.channel.send({ embeds: [roundEmbed], components: [row] }).then((msg) => {
                const filter = (interaction) => interaction.customId.startsWith("rpsmp_");
                const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

                collector.on("collect", async (interaction) => {
                    if (interaction.user.id !== message.author.id && interaction.user.id !== opponent.id) {
                        await interaction.reply({ content: "You are not part of this game.", ephemeral: true }).catch(() => {});
                        return;
                    }

                    const choice = interaction.customId.split("_")[1];
                    const isPlayer1 = interaction.user.id === message.author.id;

                    if (isPlayer1) {
                        player1Choice = choice;
                    } else {
                        player2Choice = choice;
                    }

                    await interaction.deferUpdate().catch(() => {});

                    if (player1Choice && player2Choice) {
                        collector.stop("completed");
                    }
                });

                collector.on("end", async () => {
                    if (!player1Choice || !player2Choice) {
                        await msg.edit({ content: "Round cancelled due to inactivity.", components: [] }).catch(() => {});
                        resolve(false);
                        return;
                    }

                    const winner = determineWinner();
                    let resultText = "";

                    if (winner === "player1") {
                        player1Score++;
                        resultText = `${message.author.username} wins this round.`;
                    } else if (winner === "player2") {
                        player2Score++;
                        resultText = `${opponent.username} wins this round.`;
                    } else {
                        resultText = "This round is a tie.";
                    }

                    const resultEmbed = new EmbedBuilder()
                        .setColor(winner === "tie" ? "#ffd700" : "#00ff00")
                        .setTitle(`Round ${roundNumber} Results`)
                        .addFields(
                            { name: message.author.username, value: `${choiceEmojis[player1Choice]} ${player1Choice}`, inline: true },
                            { name: opponent.username, value: `${choiceEmojis[player2Choice]} ${player2Choice}`, inline: true },
                            { name: "Result", value: resultText, inline: false },
                            { name: "Scores", value: `${message.author.username}: ${player1Score}\n${opponent.username}: ${player2Score}`, inline: false }
                        );

                    await msg.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
                    resolve(true);
                });
            }).catch(() => resolve(false));
        });

        let cancelled = false;
        while (roundNumber <= maxRounds) {
            const shouldContinue = await playRound();
            if (!shouldContinue) {
                cancelled = true;
                break;
            }

            roundNumber++;
            if (roundNumber <= maxRounds) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        if (cancelled) {
            return;
        }

        const finalWinner = player1Score > player2Score
            ? message.author.username
            : player2Score > player1Score
                ? opponent.username
                : "Tie";

        const finalEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(`${finalWinner !== "Tie" ? "Game Over" : "Game Draw"}`)
            .setDescription(finalWinner === "Tie" ? "The match ended in a tie." : `**${finalWinner}** wins the match.`)
            .addFields(
                { name: "Final Scores", value: `${message.author.username}: ${player1Score}\n${opponent.username}: ${player2Score}`, inline: true }
            );

        return message.channel.send({ embeds: [finalEmbed] });
    }
};
