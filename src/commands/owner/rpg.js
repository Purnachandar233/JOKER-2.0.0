const { EmbedBuilder } = require("discord.js");
const schema = require("../../schema/Premium")
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "removepremium-guild",
    category: "owner",
    aliases: ["rpg"],
    description: "Removes a guild in premiumlist",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = EMOJIS.ok;
        if (!args[0]) return message.reply("Please provide a Guild ID.");

        let data = await schema.findOne({ Id: args[0], Type: 'guild' });
        if (!data) return message.reply("No data found for this guild.");

        await data.deleteOne();
        message.reply(`${ok} Successfully removed premium from guild **${args[0]}**`);
    }
}
