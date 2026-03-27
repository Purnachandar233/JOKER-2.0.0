const { EmbedBuilder } = require("discord.js");
const autoplaySchema = require("../../schema/autoplay.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "autoplay",
  category: "settings",
  description: "Toggles autoplay mode",
  owner: false,
  premium: true,
  votelock:true,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {
    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

    const embedColor = message.client?.embedColor || client?.config?.embedColor || '#ff0051';
    const { channel } = message.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (message.member.voice.selfDeaf) {
      const thing = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return await message.channel.send({ embeds: [thing] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    const savedAutoplay = await autoplaySchema.findOne({ guildID: message.guild.id }).lean().catch(() => null);
    const tracks = [
      player?.queue?.current,
      ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
    ].filter(Boolean);
    const lastTrack = player && typeof player.get === "function" ? player.get("lastTrack") : null;
    const seedTrack = tracks[0] || lastTrack || null;
    const identifier =
      seedTrack?.identifier ||
      seedTrack?.info?.identifier ||
      savedAutoplay?.identifier ||
      null;
    const title = seedTrack?.info?.title || seedTrack?.title || "";
    const author = seedTrack?.info?.author || seedTrack?.author || "";
    const query = (title ? `${title} ${author}`.trim() : "") || savedAutoplay?.query || null;

    const autoplayEnabled = (player?.get?.("autoplay") === true) || Boolean(savedAutoplay?.enabled);
    if (!autoplayEnabled) {
      if (!identifier && !query) {
        const noperms = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription(`${no} There is nothing playing in this server.`);
        return await message.channel.send({ embeds: [noperms] });
      }

      if (player && typeof player.set === "function") {
        player.set("autoplay", true);
        player.set("requester", null);
        player.set("requesterId", message.member.id);
        player.set("identifier", identifier);
        player.set("autoplayQuery", query);
      }

      await autoplaySchema.findOneAndUpdate(
        { guildID: message.guild.id },
        {
          enabled: true,
          requesterId: message.member.id,
          identifier,
          query,
          lastUpdated: Date.now(),
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      const thing = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`${ok} Autoplay is now enabled. Recommended tracks will continue after the queue ends.`);
      return await message.channel.send({ embeds: [thing] });
    }

    if (player && typeof player.set === "function") {
      player.set("autoplay", false);
    }

    await autoplaySchema.findOneAndUpdate(
      { guildID: message.guild.id },
      {
        enabled: false,
        lastUpdated: Date.now(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const thing = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(`${ok} Autoplay is now disabled.`);
    return await message.channel.send({ embeds: [thing] });
  }
}
