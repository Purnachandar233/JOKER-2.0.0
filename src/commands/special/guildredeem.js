const { EmbedBuilder } = require("discord.js");
const prettyMiliSeconds = require("pretty-ms");
const redeemCode = require("../../schema/redemcode.js");
const Premium = require("../../schema/Premium.js");

module.exports = {
    name: "guild-redeem",
    category: "special",
    aliases: ["server-redeem"],
    wl: true,
    description: "redeems a redeem code",
    execute: async (message, args, client, prefix) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;

        const isPremiumGuild = await Premium.findOne({ Id: message.guild.id, Type: 'guild' });
        
        // Check if guild has an ACTIVE premium (not expired)
        if (isPremiumGuild && (isPremiumGuild.Permanent || isPremiumGuild.Expire > Date.now())) {
            let alr = new EmbedBuilder()
                .setDescription(`${no} | Server Is Already Premium`)
                .setColor(message.client?.embedColor || '#ff0051');
            return message.channel.send({ embeds: [alr] });
        }

        if (!args[0]) return message.channel.send(`No Code Provided!!`);

        const CodeOk = await redeemCode.findOne({ Code: args[0] });
        if (!CodeOk) {
            let exp = new EmbedBuilder()
                .setDescription(`${no} | Code Is Invalid Or Expired`)
                .setColor(message.client?.embedColor || '#ff0051');
            return message.channel.send({ embeds: [exp] });
        }

        // Validate code hasn't expired
        if (!CodeOk.Permanent && CodeOk.Expiry < Date.now()) {
            await CodeOk.deleteOne();
            let exp = new EmbedBuilder()
                .setDescription(`${no} | This Code Has Expired`)
                .setColor(message.client?.embedColor || '#ff0051');
            return message.channel.send({ embeds: [exp] });
        }

        // Delete old expired premium if exists
        if (isPremiumGuild) await isPremiumGuild.deleteOne();

        await Premium.create({
            Id: message.guild.id,
            Type: 'guild',
            Code: args[0],
            ActivatedAt: Date.now(),
            Expire: CodeOk.Expiry || 0,
            Permanent: CodeOk.Permanent || false,
            PlanType: "Standard"
        });

        if (CodeOk.Usage <= 1) {
            await CodeOk.deleteOne();
        } else {
            await redeemCode.findOneAndUpdate({ Code: args[0] }, { Usage: CodeOk.Usage - 1 });
        }

        const expiryText = CodeOk.Permanent ? "Never" : prettyMiliSeconds(CodeOk.Expiry - Date.now());
        let success = new EmbedBuilder()
            .setTitle("Premium Activated")
            .setDescription(`${ok} | \`Joker Music Premium Activated Successfully\`\n\`\`\`asciidoc\nServer   :: ${message.guild.name}\nExpiry   :: ${expiryText}\n\`\`\``)
            .setColor(message.client?.embedColor || '#ff0051');

        message.channel.send({ embeds: [success] });
    }
}
