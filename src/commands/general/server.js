const { EmbedBuilder } = require("discord.js");
const Premium = require("../../schema/Premium.js");
const prettyMs = require("pretty-ms");

module.exports = {
    name: "server",
    category: "general",
    description: "Shows information about the current server.",
    execute: async (message, args, client, prefix) => {
        const guild = message.guild;

        // Check guild premium validity
        const id = args[0] || message.guild.id;
        const isPremium = await Premium.findOne({ Id: id, Type: 'guild' });

        let premiumValidity = "No Premium";
        if (isPremium) {
            if (!isPremium.Permanent && isPremium.Expire < Date.now()) {
                await isPremium.deleteOne();
                premiumValidity = "Expired";
            } else {
                const text = isPremium.Permanent ? "Never" : prettyMs(isPremium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, '');
                premiumValidity = `Expires: ${text}`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(message.client?.embedColor || '#ff0051')
            .setTitle(`${guild.name} Information`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
                { name: "Members", value: `\`${guild.memberCount}\``, inline: true },
                { name: "Premium Validity", value: `\`${premiumValidity}\``, inline: true },
                { name: "Created At", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Roles", value: `\`${guild.roles.cache.size}\``, inline: true },
                { name: "Channels", value: `\`${guild.channels.cache.size}\``, inline: true },
                { name: "Boosts", value: `\`${guild.premiumSubscriptionCount || 0}\``, inline: true }
            )
            .setFooter({ text: `ID: ${guild.id}` });

        message.channel.send({ embeds: [embed] });
    }
}
