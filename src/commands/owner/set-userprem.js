const { EmbedBuilder } = require("discord.js");
const prettyMiliSeconds = require("pretty-ms");
const redeemCode = require("../../schema/redemcode.js");
const Premium = require("../../schema/Premium.js");

module.exports = {
    name: "set-userprem",
    category: "owner",
    aliases: ["adduser"],
    description: "redeems a redem code",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;
        let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
        
        const isPremiumUser = await Premium.findOne({ Id: member.id, Type: 'user' });
        if (isPremiumUser) {
            let alr = new EmbedBuilder()
                .setDescription(`${no} | This User Already Has a Premium Subscription.`)
                .setColor(0xff0051);
            return message.channel.send({ embeds: [alr] });
        }

        if (!args[1]) return message.channel.send(`No Code Provided!!`);

        const CodeOk = await redeemCode.findOne({ Code: args[1] });
        if (!CodeOk) {
            let exp = new EmbedBuilder()
                .setDescription(`${no} | Code Is Invalid Or Expired`)
                .setColor(0xff0051);
            return message.channel.send({ embeds: [exp] });
        }

        await Premium.create({
            Id: member.id,
            Type: 'user',
            Code: args[1],
            ActivatedAt: Date.now(),
            Expire: CodeOk.Expiry || 0,
            Permanent: CodeOk.Permanent || false,
            PlanType: "Standard"
        });

        if (CodeOk.Usage <= 1) {
            await CodeOk.deleteOne();
        } else {
            await redeemCode.findOneAndUpdate({ Code: args[1] }, { Usage: CodeOk.Usage - 1 });
        }

        let success = new EmbedBuilder()
            .setTitle(`Premium Activated`)
            .setDescription(`${ok} | \`Joker Music Premium Activated Successfully\`\n\`\`\`asciidoc\nUser         :: ${member.user.tag}\nExpiry       :: ${prettyMiliSeconds(CodeOk.Expiry - Date.now())}\n\`\`\``)
            .setColor(0xff0051);

        message.channel.send({ embeds: [success] });
    }
}
