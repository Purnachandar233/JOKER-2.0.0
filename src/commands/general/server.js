const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "server",
    category: "general",
    description: "Shows information about the current server.",
    execute: async (message, args, client, prefix) => {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setColor(0xff0051)
            .setTitle(`${guild.name} Information`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
                { name: "Members", value: `\`${guild.memberCount}\``, inline: true },
                { name: "premium ", value: `\`${guild.premiumTier ? guild.premiumTier.replace("TIER_", "Tier ") : "None"}\``, inline: true },
                { name: "Created At", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Roles", value: `\`${guild.roles.cache.size}\``, inline: true },
                { name: "Channels", value: `\`${guild.channels.cache.size}\``, inline: true },
                { name: "Boosts", value: `\`${guild.premiumSubscriptionCount || 0}\``, inline: true }
            )
            .setFooter({ text: `ID: ${guild.id}` });

        message.channel.send({ embeds: [embed] });
    }
}
