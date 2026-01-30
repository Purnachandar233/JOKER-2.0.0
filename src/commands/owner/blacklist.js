const User = require("../../schema/blacklistSchema.js")

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
module.exports = {
    name: "blacklist",
    category: "owner",
    aliases: ["restrict"],
    description: "Reload Command",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
          
        let ok = client.emoji.ok;
        let no = client.emoji.no;
            const aa = new EmbedBuilder()
            .setDescription(`Please Provide A User Id...`)
            .setColor(0xff0051)
        const aaa = new EmbedBuilder()
            .setDescription(`Please Provide A Valid User ID`)
            .setColor(0xff0051)
        if (!args[0]) return message.reply({ embeds: [aa] })
        if (!client.users.cache.has(args[0])) return message.reply({ embeds: [aaa] });

    
    let data = await User.findOne({ UserID: args[0] });

    if (data) {
        return message.reply(`This user is already blacklisted!`)
    }
    
    await new User({
        UserID: args[0],
    }).save();

    
    const userop = args[0]
    const username = client.users.cache.get(userop)

    const lol = new EmbedBuilder()
        .setDescription(`${ok} Blacklisted ${username} from using the bot!`)
        .setColor(0xff0051)
    message.reply({ embeds: [lol] })
    }
}