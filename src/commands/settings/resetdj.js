const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven")

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "resetdj",
  category: "settings",
  description: "Resets the djrole setup ",
  owner: true,
  votelock:true,
  wl : true,
  execute: async (message, args, client, prefix) => {
    let ok = EMOJIS.ok;
    let no = EMOJIS.no;


    if (!message.member.permissions.has('MANAGE_ROLES')) {
        const noperms = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`${no} You need this required Permissions: \`MANAGE_ROLES\` to run this command.`)
       return await message.channel.send({embeds: [noperms]});
    }
    const dSchema = require('../../schema/djroleSchema.js');
    try {
        const deleted = await dSchema.findOneAndDelete({ guildID: message.guild.id });
        if (!deleted) {
            const embed = new EmbedBuilder()
              .setColor(message.client?.embedColor || '#ff0051')
              .setDescription(`${no} No DJ role was configured for this server.`);
            return await message.channel.send({ embeds: [embed] });
        }
    } catch(err) {
        try { client.logger?.log(err && (err.stack || err.toString()), 'error'); } catch (e) { console.log(err); }
    }
    const embed = new EmbedBuilder()
    .setColor(message.client?.embedColor || '#ff0051')
         .setDescription(`Reseted the dj role for this server.`)
         return await message.channel.send({ embeds : [embed]})
   }
}