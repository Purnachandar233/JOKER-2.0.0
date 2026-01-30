const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
module.exports = {
  name: "partners",
  category: "special",
  description: "Shows the partnered servers.",
  owner: false,
  votelock :true,
  execute: async (message, args, client, prefix) => {

    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
            const embed = new EmbedBuilder()
            .setThumbnail("https://cdn.discordapp.com/icons/855371828130217984/a_219d3c73b38d54a222a4c75046164e8c.gif?size=1024")
            .setAuthor({ name: `Joker Music Partnered Server's`, iconURL: client.user.displayAvatarURL() })
           .setDescription(`\nServer Name : \`Joker Music Community\` \nOwner : \`- J O K E R 🍁#1860\`\n Premium : \`Permanent\` \nPartnered Date : \`18-06-2022\`\n
           
           `)
                .setColor(0xff0051);
message.channel.send({embeds : [embed]})
    }

}
