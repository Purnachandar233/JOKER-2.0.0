const { EmbedBuilder } = require("discord.js");
const prettyMiliSeconds = require("pretty-ms");
const day = require("dayjs");
const Premium = require("../../schema/Premium.js")

module.exports = {
    name: "guild-validity",
    category: "special",
    aliases: ["server-validity"],
    wl : true,
    description: "Shows The Guild/Server Premium Subscription Validity",
    execute: async (message, args, client, prefix) => {
        const id = args[0] || message.guild.id;
        const isPremium = await Premium.findOne({ Id: id, Type: 'guild' });
    
        if (!isPremium) {
            return message.channel.send({ embeds: [new EmbedBuilder().setDescription("This server has no premium subscription.").setColor(message.client?.embedColor || '#ff0051')] });
        }
        
        if (!isPremium.Permanent && isPremium.Expire < Date.now()) {
            await isPremium.deleteOne();
            return message.channel.send({ embeds: [new EmbedBuilder().setDescription("Premium subscription has expired.").setColor(message.client?.embedColor || '#ff0051')] });
        }
        
        const text = isPremium.Permanent ? "Never" : prettyMiliSeconds(isPremium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, '');
        message.channel.send({ embeds: [new EmbedBuilder().setTitle(`${id} - Validity`).setDescription(`Premium Expiry: \`${text}\``).setColor(message.client?.embedColor || '#ff0051')] });
    }
}
