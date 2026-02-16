const day = require("dayjs")
const { EmbedBuilder } = require("discord.js");
const schema = require("../../schema/Premium")
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "addpremium-user",
    category: "owner",
    aliases: ["aup"],
    description: "Adds a user in premiumlist",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = EMOJIS.ok;
        if (!args[0]) return message.reply("Please provide a User ID.");

        await schema.findOneAndDelete({ Id: args[0], Type: 'user' });
        await new schema({
            Id: args[0],
            Type: 'user',
            ActivatedAt: Date.now(),
            Expire: args[1] ? day(args[1]).valueOf() : 0,
            Permanent: args[1] ? false : true,
            PlanType: "Standard"
        }).save();

        message.reply(`${ok} Successfully added user **${args[0]}** to premium.`);
    }
}
