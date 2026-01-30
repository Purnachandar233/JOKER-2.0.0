const { EmbedBuilder } = require("discord.js");
const prettyMiliSeconds = require("pretty-ms");
const day = require("dayjs");
const Premium = require("../../schema/Premium.js")

module.exports = {
    name: "user-validity",
    category: "special",
    wl : true,
    description: "Shows The User Premium Subscription Validity",
    execute: async (message, args, client, prefix) => {
        const id = message.mentions.users.first()?.id || args[0] || message.author.id;
        const isPremium = await Premium.findOne({ Id: id, Type: 'user' });
    
        if (!isPremium) {
            return message.channel.send({ embeds: [new EmbedBuilder().setDescription("This user has no premium subscription.").setColor(0xff0051)] });
        }
        
        if (!isPremium.Permanent && isPremium.Expire < Date.now()) {
            await isPremium.deleteOne();
            return message.channel.send({ embeds: [new EmbedBuilder().setDescription("Premium subscription has expired.").setColor(0xff0051)] });
        }
        
        const text = isPremium.Permanent ? "Never" : prettyMiliSeconds(isPremium.Expire - Date.now());
        message.channel.send({ embeds: [new EmbedBuilder().setTitle(`${id} - Validity`).setDescription(`Premium Expiry: \`${text}\``).setColor(0xff0051)] });
    }
}
