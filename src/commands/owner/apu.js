const { EmbedBuilder } = require("discord.js");
const schema = require("../../schema/Premium");

module.exports = {
    name: "addpremium",
    category: "owner",
    aliases: ["ap", "addprem"],
    description: "Adds premium to a user",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = client.emoji.ok;
        const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply("Please provide a valid User ID or mention.");

        let data = await schema.findOne({ Id: target.id, Type: 'user' });
        if (data) await data.deleteOne();

        await new schema({
            Id: target.id,
            Type: 'user',
            ActivatedAt: Date.now(),
            Expire: 0,
            Permanent: true,
            PlanType: "Standard"
        }).save();

        const embed = new EmbedBuilder()
            .setDescription(`${ok} Successfully added Permanent Premium to **${target.tag}**`)
            .setColor(0xff0051);
        message.reply({ embeds: [embed] });
    }
}
