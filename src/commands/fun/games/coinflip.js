const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "coinflip",
    category: "fun",
    aliases: ["flip", "coin", "cf"],
    description: "Flip a coin and predict the outcome!",
    execute: async (message, args, client, prefix) => {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('coinflip_heads')
                .setLabel('Heads')
                .setEmoji('🪙')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('coinflip_tails')
                .setLabel('Tails')
                .setEmoji('🪙')
                .setStyle(ButtonStyle.Primary)
        );

        const startEmbed = new EmbedBuilder()
            .setColor(client.embedColor || '#ff0011')
            .setTitle("🪙 Coin Flip ")
            .setDescription("Choose your prediction before the coin is flipped!")
const msg = await message.channel.send({ embeds: [startEmbed], components: [row] });

        const filter = (i) => i.customId.startsWith('coinflip_');
        const collector = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                await interaction.reply({ content: `Only <@${message.author.id}> can use these buttons.`, ephemeral: true }).catch(() => {});
                return;
            }

            const prediction = interaction.customId.split('_')[1];
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = prediction === result;

            const resultEmbed = new EmbedBuilder()
                .setColor(won ? '#2ecc71' : '#e74c3c')
                .setTitle("🪙 Coin Flip Result")
                .addFields(
                    { name: "Your Prediction", value: `**${prediction.charAt(0).toUpperCase() + prediction.slice(1)}**`, inline: true },
                    { name: "Result", value: `**${result.charAt(0).toUpperCase() + result.slice(1)}**`, inline: true },
                    { name: "Outcome", value: won ? "✅ You Win!" : "❌ You Lose!", inline: false }
                )
await interaction.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({ content: 'Coin flip cancelled due to inactivity.', components: [] }).catch(() => {});
            }
        });
    }
};
