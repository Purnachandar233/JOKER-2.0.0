const { EmbedBuilder } = require("discord.js");
const { createBar } = require('../../functions.js');

module.exports = {
  name: 'grab',
  category: 'music',
  aliases: ["lagu", "savedm", "grb", "dmchey"],
  description: 'Grabs and sends the current playing song data to your personal DMs',
  owner: false,
  wl: true,
  votelock: true,
  execute: async (message, args, client, prefix) => {
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const { channel } = message.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (message.member.voice.selfDeaf) {
      let thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return await message.channel.send({ embeds: [thing] });
    }

        const player = client.lavalink.players.get(message.guild.id);
      const { getQueueArray } = require('../../utils/queue.js');
      const tracks = getQueueArray(player);
    
      if(!player || !tracks || tracks.length === 0) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} There is nothing playing in this server.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    // tracks already computed above
    const song = tracks[0];
    const title = song?.info?.title || song?.title || 'Unknown Title';
    const uri = song?.info?.uri || song?.uri || '';
    const author = song?.info?.author || song?.author || 'Unknown';
    const isStream = song?.info?.isStream || song?.isStream || false;
    const duration = song?.info?.duration || song?.duration || null;
    const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');

    let embed = new EmbedBuilder()
      .setTitle("Now playing")
      .addFields(
        { name: 'Song', value: `[${title}](${uri})` },
        { name: 'Song By', value: `${author}` },
        { name: 'Duration', value: `\`${durationStr}\`` },
        { name: 'Queue Length', value: `${tracks.length} Songs` },
        { name: 'Progress', value: createBar(player) }
      )
      .setColor(message.client?.embedColor || '#ff0051');

    message.member.send({ embeds: [embed] }).catch(e => {
      return message.channel.send({
        content: `${no} Couldn't send you a DM\n\nPossible reasons:\n- Your DMs are disabled\n- You have me blocked\n\nNone of these helped? Join our [**Support Server**](https://discord.gg/pCj2UBbwST) for more help.`
      });
    });
    
    return message.channel.send({ content: "**📪 Check your DMs.**" });
  }
};


