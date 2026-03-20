const { EmbedBuilder } = require("discord.js");

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PLAYER_MOVE_DISCONNECT_GRACE_MS = toPositiveNumber(process.env.PLAYER_MOVE_DISCONNECT_GRACE_MS, 5000);

module.exports = async (client, player, oldChannel, newChannel) => {
  try {
    const guild = client.guilds.cache.get(player.guildId);
    if (!guild) return;

    if (oldChannel === newChannel) return;

    if (!newChannel) {
      // queueEnd.js owns idle leave/disconnect flow. Do not hard-destroy here,
      // or we can skip queue-end leave notices and cause reconnect churn.
      if (client.__queueEndLeaveTimers?.has?.(player.guildId)) return;

      await new Promise((resolve) => setTimeout(resolve, PLAYER_MOVE_DISCONNECT_GRACE_MS));

      const activePlayer = client.lavalink?.players?.get?.(player.guildId);
      if (!activePlayer || activePlayer !== player) return;

      const refreshedBotChannelId = guild.members.me?.voice?.channelId || null;
      if (refreshedBotChannelId) return;

      const msg = typeof player.get === "function" ? player.get("playingsongmsg") : null;
      if (msg?.delete) {
        await msg.delete().catch(() => {});
      }

      await player.destroy().catch(() => {});
      return;
    }

    setTimeout(async () => {
      try {
        if (player.paused) {
          await player.resume();
        } else if (player.queue?.current || player.queue?.tracks?.length) {
          await player.play({ paused: false });
        }
      } catch (_e) {}
    }, 150);

    // Announce only real moves between channels (not join/disconnect transitions).
    if (!oldChannel || !newChannel || oldChannel.id === newChannel.id) return;

    const channel = guild.channels.cache.get(player.textChannelId);
    if (!channel) return;

    const movedEmbed = new EmbedBuilder()
      .setColor(client?.embedColor || "#ff0051")
      .setTitle("Player Moved")
      .setDescription(`I have been moved from <#${oldChannel.id}> to <#${newChannel.id}>.`);

    const notice = await channel.send({ embeds: [movedEmbed] }).catch(() => {});
    if (notice?.delete) {
      setTimeout(() => {
        notice.delete().catch(() => {});
      }, 10000);
    }
  } catch (error) {
    console.error("[ERROR] playerMove:", error.message);
  }
};
