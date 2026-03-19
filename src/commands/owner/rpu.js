const { EmbedBuilder } = require("discord.js");
const schema = require("../../schema/Premium");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "removepremium-user",
    category: "owner",
    aliases: ["rpu", "remprem"],
    description: "Removes premium from a user",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = EMOJIS.ok;
        if (!args || args.length < 1) return message.reply('Provide a user ID or mention');
        const targetId = args[0]?.replace(/[<@!>]/g, "");
        if (!targetId) return message.reply("Please provide a valid User ID or mention.");

        let data = await schema.findOne({ Id: targetId, Type: 'user' });
        if (!data) return message.reply("This user does not have premium.");

        await data.deleteOne();
        message.reply(`${ok} Successfully removed premium from user **${targetId}**`);
    }
}
