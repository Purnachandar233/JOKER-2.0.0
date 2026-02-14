const User = require("../../schema/blacklistSchema.js")
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
module.exports = {
    name: "whitelist",
    category: "owner",
    aliases: ["allow"],
    description: "Whitelists a blacklisted user!",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
        const aa = new EmbedBuilder()
        .setDescription(`Please Provide A User Id...`)
        .setColor(message.client?.embedColor || '#ff0051')
    const aaa = new EmbedBuilder()
        .setDescription(`Please Provide A Valid User ID`)
        .setColor(message.client?.embedColor || '#ff0051')
        if (!args || args.length < 1) {
            return message.reply({ embeds: [aa] });
        }
        if (!client.users.cache.has(args[0])) return message.reply({ embeds: [aaa] });

    
    let data = await User.findOne({
        UserID: args[0]
    });
    
    if (!data) return message.reply(`\`\`\`\nNo Data Found\n\`\`\``);
    
    await data.deleteOne();
    const userop = args[0]
    const username = client.users.cache.get(userop)

    const lol = new EmbedBuilder()
        .setDescription(`${ok} Successfully Removed **${username}** From blacklist`)
        .setColor(message.client?.embedColor || '#ff0051')
    message.reply({ embeds: [lol] })


            }
                
        }
    
    
    
