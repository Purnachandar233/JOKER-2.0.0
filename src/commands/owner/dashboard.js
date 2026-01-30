const { EmbedBuilder } = require("discord.js");
const Premium = require("../../schema/Premium.js");
const redeemCode = require("../../schema/redemcode.js");
const prettyMiliSeconds = require("pretty-ms");

module.exports = {
    name: "dashboard",
    category: "owner",
    aliases: ["db", "premiumdashboard", "pdashboard"],
    description: "Shows the premium dashboard with active guilds, users, codes, and validity.",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;

        // Fetch active premium guilds
        const activeGuilds = await Premium.find({ Type: 'guild', Expire: { $gt: Date.now() }, Permanent: false });
        const permanentGuilds = await Premium.find({ Type: 'guild', Permanent: true });

        // Fetch active premium users
        const activeUsers = await Premium.find({ Type: 'user', Expire: { $gt: Date.now() }, Permanent: false });
        const permanentUsers = await Premium.find({ Type: 'user', Permanent: true });

        // Fetch active codes
        const activeCodes = await redeemCode.find({ Expiry: { $gt: Date.now() } });

        // Format guilds
        const guildList = [...activeGuilds, ...permanentGuilds].map(p => {
            const guild = client.guilds.cache.get(p.Id);
            const guildName = guild ? guild.name : "Unknown Guild";
            const validity = p.Permanent ? "Permanent" : prettyMiliSeconds(p.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, '');
            return `${guildName} (${p.Id}) - Validity: ${validity}`;
        }).join("\n") || "None";

        // Format users
        const userList = [...activeUsers, ...permanentUsers].map(p => {
            const user = client.users.cache.get(p.Id);
            const userName = user ? user.tag : "Unknown User";
            const validity = p.Permanent ? "Permanent" : prettyMiliSeconds(p.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, '');
            return `${userName} (${p.Id}) - Validity: ${validity}`;
        }).join("\n") || "None";

        // Format codes
        const codeList = activeCodes.map(c => {
            const validity = prettyMiliSeconds(c.Expiry - Date.now());
            return `Code: ${c.Code} - Validity: ${validity} - Usage: ${c.Usage}`;
        }).join("\n") || "None";

        const embed = new EmbedBuilder()
            .setTitle(`${ok} Premium Dashboard`)
            .setColor(0xff0051)
            .addFields(
                { name: "Active Premium Guilds", value: guildList.length > 1024 ? guildList.substring(0, 1021) + "..." : guildList, inline: false },
                { name: "Active Premium Users", value: userList.length > 1024 ? userList.substring(0, 1021) + "..." : userList, inline: false },
                { name: "Active Codes", value: codeList.length > 1024 ? codeList.substring(0, 1021) + "..." : codeList, inline: false }
            )
            .setFooter({ text: "Joker Music" });

        message.channel.send({ embeds: [embed] });
    }
}
