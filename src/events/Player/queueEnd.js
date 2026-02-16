const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

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

const delay = require("delay").default;
const twentyfourseven = require("../../schema/twentyfourseven");
const safePlayer = require("../../utils/safePlayer");

module.exports = async (client, player) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (!channel) return;

  if (player.get("playingsongmsg")) {
    player.get("playingsongmsg").delete().catch(() => {});
  }

  const queueEndEmbed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setTitle(` Queue Ended `)
    .setDescription(` Add more songs or enable [autoplay](https://top.gg/bot/${client.user.id}) or [24/7](https://top.gg/bot/${client.user.id}) mode to keep the player alive after the queue ends.\n`)
    

  await channel.send({ embeds: [queueEndEmbed] }).catch(() => {});

  const isAutoplayEnabled = player.get && player.get("autoplay") === true;
  let is247Enabled = false;
  try {
    const doc = await twentyfourseven.findOne({ guildID: player.guildId });
    is247Enabled = Boolean(doc);
  } catch (err) {
    client.logger?.log?.(`Failed to read 24/7 setting for guild ${player.guildId}: ${err?.message || err}`, "warn");
  }

  if (isAutoplayEnabled || is247Enabled) return;

  const leaveEmbed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setDescription(`Leaving voice channel — enable 24/7 to keep me here. buy [premium](https://discord.gg/JQzBqgmwFm) or [vote](https://top.gg/bot${client.user.id}) to unlock these features and keep the music playing! `); 
  await channel.send({ embeds: [leaveEmbed] }).catch(() => {});
  await delay(1500);

  try {
    const keysToClear = ["autoplay", "requester", "identifier", "playingsongmsg", "suppressUntil"];
    for (const key of keysToClear) {
      try {
        if (player && typeof player.set === "function") player.set(key, null);
      } catch (_err) {}
    }
    await safePlayer.safeDestroy(player);
  } catch (err) {
    client.logger?.log?.(`Failed to destroy player for guild ${player.guildId}: ${err?.message || err}`, "error");
  }
};

