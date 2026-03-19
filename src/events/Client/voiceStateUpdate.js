const { ChannelType, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";
const delay = require("delay").default;

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

module.exports = async (client, oldState, newState) => {
  const player = client.lavalink?.players.get(newState.guild.id);
  if (!player) return;

  if (newState.id === client.user.id) {
    const joinedChannel = newState.guild.channels.cache.get(newState.channel?.id ?? newState.channelId);
    if (joinedChannel?.type === ChannelType.GuildStageVoice) {
      if (!oldState.channelId) {
        try {
          await newState.guild.members.me?.voice?.setSuppressed(false);
        } catch (_err) {
          try {
            await newState.guild.members.me?.voice?.setRequestToSpeak(true);
          } catch (_e) {}
          if (!player.paused) await player.pause().catch(() => {});
        }
      } else if (oldState.suppress !== newState.suppress) {
        if (newState.suppress) await player.pause().catch(() => {});
        else if (player.paused) await player.resume().catch(() => {});
      }
    }

    // Discord can briefly report the bot as not connected while joining or
    // moving voice channels. Re-check once before destroying the player.
    if (!newState.channelId) {
      await delay(1500);
      const refreshedBotChannelId = newState.guild.members.me?.voice?.channelId || null;
      if (!refreshedBotChannelId) {
        await player.destroy().catch(() => {});
      }
    }
    return;
  }

  const currentBotChannelId = newState.guild.members.me?.voice?.channelId || null;
  if (!currentBotChannelId) return;

  const botMemberAtOldState = oldState.guild.members.cache.get(client.user.id);
  if (!botMemberAtOldState?.voice?.channelId) return;

  const twentyFourSevenSchema = require("../../schema/twentyfourseven.js");
  const keepConnected = await twentyFourSevenSchema.findOne({ guildID: oldState.guild.id });
  if (keepConnected) return;

  if (botMemberAtOldState.voice.channelId !== oldState.channelId) return;

  const leftChannel = botMemberAtOldState.voice.channel;
  if (!leftChannel) return;

  const hasHumansNow = leftChannel.members.some(member => !member.user.bot);
  if (hasHumansNow) return;

  await delay(180000);

  const refreshedBotMember = oldState.guild.members.cache.get(client.user.id);
  if (!refreshedBotMember?.voice?.channel) return;
  const stillEmpty = !refreshedBotMember.voice.channel.members.some(member => !member.user.bot);
  if (!stillEmpty) return;

  await player.destroy().catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setTitle(`${getEmoji(client, "info")} Disconnected Due To Inactivity`)
    .setDescription("I left the voice channel because no listeners remained for 3 minutes.\nEnable 24/7 mode to keep me connected.");

  const textChannel = client.channels.cache.get(player.textChannelId);
  if (textChannel) {
    await textChannel.send({ embeds: [embed] }).catch(() => {});
  }
};
