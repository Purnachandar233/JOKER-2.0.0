const { ChannelType, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";
const delay = require("delay").default;

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function createEmbed(client, options = {}) {
  const {
    title,
    description,
    fields,
    author,
    thumbnail,
    image,
    footer,
    timestamp = false
  } = options;

  const embed = new EmbedBuilder().setColor(client?.embedColor || EMBED_COLOR);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
  if (author) embed.setAuthor(author);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  const footerText = footer || `${getEmoji(client, "music", "[M]")} Joker Music`;
return embed;
}

const safePlayer = require("../../utils/safePlayer");

module.exports = async (client, oldState, newState) => {
  const player = client.lavalink?.players.get(newState.guild.id);
  if (!player) return;

  const currentBotMember = newState.guild.members.cache.get(client.user.id);
  if (!currentBotMember?.voice?.channelId) {
    await safePlayer.safeDestroy(player);
    return;
  }

  const joinedChannel = newState.guild.channels.cache.get(newState.channel?.id ?? newState.channelId);
  if (newState.id === client.user.id && joinedChannel?.type === ChannelType.GuildStageVoice) {
    if (!oldState.channelId) {
      try {
        await newState.guild.members.me?.voice?.setSuppressed(false);
      } catch (_err) {
        await safePlayer.safeCall(player, "pause", true);
      }
    } else if (oldState.suppress !== newState.suppress) {
      await safePlayer.safeCall(player, "pause", newState.suppress);
    }
  }

  if (oldState.id === client.user.id) return;

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

  await safePlayer.safeDestroy(player);

  const embed = createEmbed(client, {
    title: `${getEmoji(client, "info")} Disconnected Due To Inactivity`,
    description: "I left the voice channel because no listeners remained for 3 minutes.\nEnable 24/7 mode to keep me connected."
  });

  const textChannel = client.channels.cache.get(player.textChannelId);
  if (textChannel) {
    await textChannel.send({ embeds: [embed] }).catch(() => {});
  }
};

