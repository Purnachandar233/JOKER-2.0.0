const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'forceplayerdestroy',
  category: 'settings',
  aliases: [],
  description: 'Forcely destroy the player for this guild.',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noperms = new EmbedBuilder()
     .setColor(message.client?.embedColor || '#ff0051')
     .setDescription(`${no} You need this required Permissions: \`MANAGE_CHANNELS\` to run this command.`)
return await message.channel.send({embeds: [noperms]});
  }
    //


  const player = client.lavalink.players.get(message.guild.id);

      await player?.destroy().catch(() => {});
      let thing = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`${ok} Forcely Destroyed the player for this guild!`)
      return message.channel.send({ embeds: [thing] });

      }
}
