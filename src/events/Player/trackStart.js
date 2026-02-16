const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { convertTime } = require("../../utils/convert.js");
const EMOJIS = require("../../utils/emoji.json");

const EMBED_COLOR = "#ff0051";

module.exports = async (client, player, track) => {
  try {
    try {
      const suppressUntil = typeof player.get === "function" ? player.get("suppressUntil") : null;
      if (suppressUntil && Date.now() < suppressUntil) {
        await new Promise((resolve) => setTimeout(resolve, suppressUntil - Date.now()));
      }
    } catch (e) {}

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) {
      client.logger?.log(
        `Channel not found for textChannelId: ${player.textChannelId} in guild ${player.guildId}`,
        "error"
      );
      return;
    }

    const title = track?.info?.title || track?.title || "Unknown";
    const uri = track?.info?.uri || track?.uri || "";
    const duration = track?.info?.duration || track?.duration || 0;
    const isStream = track?.info?.isStream || track?.isStream || false;

    const oldMsg = typeof player.get === "function" ? player.get("playingsongmsg") : null;
    if (oldMsg) await oldMsg.delete().catch(() => {});

    const pauseBtn = new ButtonBuilder()
      .setCustomId("music_prtrack")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Pause");

    const skipBtn = new ButtonBuilder()
      .setCustomId("music_skiptrack")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Skip");

    const queueBtn = new ButtonBuilder()
      .setCustomId("music_showqueue")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Queue");

    const stopBtn = new ButtonBuilder()
      .setCustomId("music_stop")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Stop");

    const row = new ActionRowBuilder().addComponents(pauseBtn, skipBtn, queueBtn, stopBtn);

    const songLine = uri ? `**[${title}](${uri})**` : `**${title}**`;
    const playerRequester = typeof player.get === "function" ? player.get("requester") : null;
    const playerRequesterId = typeof player.get === "function" ? player.get("requesterId") : null;

    const requesterId =
      track?.requester?.id ||
      track?.requester?.user?.id ||
      track?.info?.requester?.id ||
      (typeof track?.requester === "string" ? track.requester : null) ||
      playerRequester?.id ||
      playerRequester?.user?.id ||
      playerRequesterId ||
      null;

    const requesterTag =
      track?.requester?.tag ||
      track?.requester?.user?.tag ||
      track?.info?.requester?.tag ||
      playerRequester?.user?.tag ||
      playerRequester?.tag ||
      null;

    const requestedBy = requesterId
      ? `<@${requesterId}>`
      : requesterTag
        ? `\`${requesterTag}\``
        : "`Unknown`";

    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setAuthor({
        name:  "Now Playing",
        iconURL: client.user.displayAvatarURL({ forceStatic: false })
      })
      .setDescription(
        `${songLine}\n\`${isStream ? "LIVE" : convertTime(duration)}\` - Requested by ${requestedBy}`
      );
      

    const msg = await channel.send({ embeds: [embed], components: [row] }).catch(async (error) => {
      client.logger?.log(`Failed to send track start embed in guild ${player.guildId}: ${error.message}`, "error");
      return channel.send(`${EMOJIS.music || "[M]"} Now Playing: ${title}`).catch(() => null);
    });

    if (!msg) {
      client.logger?.log(`Track start message failed to send in guild ${player.guildId}`, "error");
      return;
    }

    if (typeof player.set === "function") {
      player.set("playingsongmsg", msg);
      player.set("lastTrack", track);
    }
  } catch (error) {
    client.logger?.log(`[ERROR] trackStart: ${error.message}`, "error");
  }
};
