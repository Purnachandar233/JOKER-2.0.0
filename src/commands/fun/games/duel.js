const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "duel",
    category: "fun",
    description: "Battle another player in an epic duel!",
    execute: async (message, args, client, prefix) => {
        const opponent = message.mentions.users.first();

        if (!opponent) {
            return message.reply("Please mention a player to duel! Example: `=duel @user`");
        }

        if (opponent.id === message.author.id) {
            return message.reply("You can't duel yourself!");
        }

        if (opponent.bot && opponent.id !== client.user.id) {
            return message.reply("You can only duel real users or me!");
        }

        const player1 = { user: message.author, hp: 100, maxHp: 100 };
        const player2 = { user: opponent, hp: 100, maxHp: 100 };
        let currentTurn = player1;

        const actions = [
            { name: "⚔️ Attack", damage: () => Math.floor(Math.random() * 25) + 10, emoji: "⚔️" },
            { name: "🛡️ Defend", damage: () => Math.floor(Math.random() * 5), emoji: "🛡️" },
            { name: "💣 Critical", damage: () => Math.random() > 0.5 ? Math.floor(Math.random() * 35) + 20 : 5, emoji: "💣" }
        ];

        const getHealthBar = (hp, maxHp) => {
            const filledBars = Math.floor((hp / maxHp) * 10);
            const emptyBars = 10 - filledBars;
            return `${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)} ${hp}/${maxHp}`;
        };

        const createDuelEmbed = (description = "") => {
            return new EmbedBuilder()
                .setColor(client.embedColor || '#ff0000')
                .setTitle("⚔️ DUEL ⚔️")
                .addFields(
                    { name: `${player1.user.username} (P1)`, value: getHealthBar(player1.hp, player1.maxHp), inline: false },
                    { name: `${player2.user.username} (P2)`, value: getHealthBar(player2.hp, player2.maxHp), inline: false },
                    { name: "Current Turn", value: `${currentTurn.user.username}'s turn`, inline: false }
                )
                .setDescription(description || "Choose your action!");
        };

        const createActionButtons = () => {
            const row = new ActionRowBuilder();
            actions.forEach((action, index) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`duel_${index}`)
                        .setLabel(action.name)
                        .setStyle(ButtonStyle.Danger)
                );
            });
            return row;
        };

        const duelMsg = await message.channel.send({
            embeds: [createDuelEmbed()],
            components: [createActionButtons()]
        });

        const filter = (i) => i.customId.startsWith('duel_') && i.user.id === currentTurn.user.id;
        const collector = duelMsg.createMessageComponentCollector({ filter, time: 120000 });

        let turnLog = "";

        collector.on('collect', async (interaction) => {
            const actionIndex = parseInt(interaction.customId.split('_')[1]);
            const action = actions[actionIndex];
            const damage = action.damage();

            const opponent = currentTurn === player1 ? player2 : player1;
            opponent.hp = Math.max(0, opponent.hp - damage);

            turnLog = `**${currentTurn.user.username}** used **${action.emoji} ${action.name}** and dealt **${damage} damage**!`;

            if (opponent.hp === 0) {
                const winEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle("🏆 Duel Victory! 🏆")
                    .setDescription(`${currentTurn.user.username} wins the duel!`)
                    .addFields(
                        { name: `${player1.user.username} (P1)`, value: getHealthBar(player1.hp, player1.maxHp), inline: false },
                        { name: `${player2.user.username} (P2)`, value: getHealthBar(player2.hp, player2.maxHp), inline: false },
                        { name: "Last Action", value: turnLog, inline: false }
                    );
                
                await interaction.update({ embeds: [winEmbed], components: [] });
                collector.stop();
            } else {
                currentTurn = opponent;
                await interaction.update({
                    embeds: [createDuelEmbed(turnLog)],
                    components: [createActionButtons()]
                });
            }
        });

        collector.on('end', () => {
            if (!collector.called && player1.hp > 0 && player2.hp > 0) {
                duelMsg.edit({ content: "Duel ended due to inactivity.", components: [] }).catch(() => {});
            }
        });
    }
};
