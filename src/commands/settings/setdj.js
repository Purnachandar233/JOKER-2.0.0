const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven")

module.exports = {
  name: "setdj",
  category: "settings",
  description: "Toggles djrole mode",
  owner: false,
  premium: true,
  votelock:true,
  wl : true,
  execute: async (message, args, client, prefix) => {  
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    

    if (!message.member.permissions.has('MANAGE_ROLES')) {
        const noperms = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`${no} You need this required Permissions: \`MANAGE_ROLES\` to run this command.`)
       return await message.channel.send({embeds: [noperms]});
    }
    const role = message.mentions.roles.first();
    if (!role) {
        const embed = new EmbedBuilder()
            .setColor(message.client?.embedColor || '#ff0051')
            .setDescription(`${no} Please mention a role to set as the DJ role.`);
        return await message.channel.send({ embeds: [embed] });
    }

    const dSchema = require('../../schema/djroleSchema.js');
    try {
        await dSchema.findOneAndUpdate(
            { guildID: message.guild.id },
            { $set: { Roleid: role.id } },
            { upsert: true, new: true }
        );
    } catch (err) {
        try { client.logger?.log(err && (err.stack || err.toString()), 'error'); } catch (e) { console.log(err); }
    }
    const embed = new EmbedBuilder()
    .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`DJ role mode is now **enabled** and set to ${role}.`)
         return await message.channel.send({ embeds : [embed]})
   }
}