const { EmbedBuilder } = require('discord.js');
const lyricsFinder = require("lyrics-finder");

module.exports = {
  name: 'lyrics',
  category: 'music',
  aliases: ["ly", "lyr"],
  description: 'Gives the lyrics of the provided song.',
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const song = args.join(" ");
    if (!song) {
      const ppp = new EmbedBuilder()
        .setDescription(`You need to give me a song name.`)
        .setColor(message.client?.embedColor || '#ff0051');
      return message.channel.send({ embeds: [ppp] });
    }

    let res = await lyricsFinder(song);
    if (!res) {
      let no = new EmbedBuilder()
        .setDescription(`No results found.`)
        .setColor(message.client?.embedColor || '#ff0051');
      return await message.channel.send({ embeds: [no] });
    }

    for (let i = 0; i < res.length; i += 2048) {
      let lyrics = res.substring(i, Math.min(res.length, i + 2048));
      let mainpage = new EmbedBuilder()
        .setTitle(` Joker Music | Lyrics of ${song}`)
        .setDescription(lyrics)
        .setThumbnail(client.user.displayAvatarURL())
        .setColor(message.client?.embedColor || '#ff0051');

      await message.channel.send({ embeds: [mainpage] });
    }
  }
}
