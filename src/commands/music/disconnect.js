const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const safePlayer = require('../../utils/safePlayer');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'disconnect',
  category: 'music',
  aliases: ["dc","leave","leavevc","mingey"],
  description: 'leaves the voice channel',
  owner: false,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

    const { channel } = message.member.voice;
    //

    //
  if (!channel) {
                  const noperms = new EmbedBuilder()

       .setColor(message.client?.embedColor || '#ff0051')
         .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.channel.send({embeds: [noperms]});
  }
  if(message.member.voice.selfDeaf) {
    let thing = new EmbedBuilder()
     .setColor(message.client?.embedColor || '#ff0051')

   .setDescription(` ${no} You cannot run this command while deafened.`)
     return await message.channel.send({embeds: [thing]});
   }
    const player = client.lavalink.players.get(message.guild.id);
    if (!player) {
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} No player found.`)] });
    }

    try {
      const msg = player.get && player.get(`playingsongmsg`);
      if (msg && msg.delete) await msg.delete().catch(() => {});
    } catch (e) {}

    try { await safePlayer.safeDestroy(player); } catch (e) {}

    let thing = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`${ok} Destroyed the player and left ${channel.name}`);
    return message.channel.send({ embeds: [thing] });

      }
}
