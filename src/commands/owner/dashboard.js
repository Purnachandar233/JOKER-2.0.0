const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");

const Premium = require("../../schema/Premium.js");
const RedeemCode = require("../../schema/redemcode.js");
const User = require("../../schema/User.js");
const Blacklist = require("../../schema/blacklistSchema.js");
const TwentyFourSeven = require("../../schema/twentyfourseven.js");

const formatDuration = require("../../utils/formatDuration");
const { buildManagerSummary } = require("../../utils/lavalinkHealth");

const DAY_MS = 24 * 60 * 60 * 1000;
const VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;

function toMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActivePremium(doc, now = Date.now()) {
  if (!doc) return false;
  if (doc.Permanent) return true;
  return toMs(doc.Expire) > now;
}

function formatValidity(doc, now = Date.now()) {
  if (!doc) return "Unknown";
  if (doc.Permanent) return "Permanent";
  const remaining = Math.max(0, toMs(doc.Expire) - now);
  return formatDuration(remaining, { verbose: false }).replace(/\s\d+s$/, "");
}

function clampField(text, fallback = "None") {
  const value = (text && text.trim()) ? text : fallback;
  return value.length > 1024 ? `${value.slice(0, 1021)}...` : value;
}

function getMongoStateLabel(readyState) {
  switch (Number(readyState)) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

function parseLogTimestamp(logLine) {
  const text = String(logLine || "");
  const match = text.match(/^\[([^\]]+)\]/);
  if (!match || !match[1]) return null;
  const ms = Date.parse(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

function countRecentErrors(client, now = Date.now()) {
  const recentErrors = typeof client?.logger?.getRecentErrors === "function"
    ? client.logger.getRecentErrors(500)
    : [];

  let last1h = 0;
  let last24h = 0;
  for (const line of recentErrors) {
    const ts = parseLogTimestamp(line);
    if (!ts) continue;
    const age = now - ts;
    if (age <= DAY_MS) last24h += 1;
    if (age <= (60 * 60 * 1000)) last1h += 1;
  }

  return { last1h, last24h };
}

function getTopCommandsLast24h(client, now = Date.now()) {
  const recentLogs = typeof client?.logger?.getRecentLogs === "function"
    ? client.logger.getRecentLogs(1000)
    : [];

  const counts = new Map();
  for (const line of recentLogs) {
    const ts = parseLogTimestamp(line);
    if (!ts || (now - ts) > DAY_MS) continue;

    const match = String(line).match(/Command:\s*\/([a-z0-9_-]+)/i);
    if (!match || !match[1]) continue;

    const cmd = match[1].toLowerCase();
    counts.set(cmd, (counts.get(cmd) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function formatTopCommandList(topCommands) {
  if (!Array.isArray(topCommands) || topCommands.length === 0) {
    return "No command usage logs captured.\nEnable `LOG_COMMAND_USAGE=true` for this metric.";
  }

  return topCommands
    .map(([name, count], index) => `${index + 1}. \`/${name}\` - ${count}`)
    .join("\n");
}

async function getMongoPingMs() {
  const readyState = Number(mongoose?.connection?.readyState || 0);
  if (readyState !== 1) return null;

  const admin = mongoose?.connection?.db?.admin?.();
  if (!admin || typeof admin.ping !== "function") return null;

  const startedAt = Date.now();
  await admin.ping();
  return Date.now() - startedAt;
}

module.exports = {
  name: "dashboard",
  category: "owner",
  aliases: ["db", "premiumdashboard", "pdashboard"],
  description: "Shows detailed owner dashboard data.",
  owneronly: true,
  execute: async (message, args, client) => {
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: label,
      value: String(value),
      inline,
    });

    const now = Date.now();
    const next24h = now + DAY_MS;
    const next72h = now + (3 * DAY_MS);

    const [
      guildPremiumDocs,
      userPremiumDocs,
      codeDocs,
      blacklistedUsersCount,
      autojoinCount,
      totalVotesAgg,
      mongoPingMs,
    ] = await Promise.all([
      Premium.find({ Type: "guild" }).lean().catch(() => []),
      Premium.find({ Type: "user" }).lean().catch(() => []),
      RedeemCode.find({}).lean().catch(() => []),
      Blacklist.countDocuments({}).catch(() => 0),
      TwentyFourSeven.countDocuments({}).catch(() => 0),
      User.aggregate([
        { $group: { _id: null, totalVotes: { $sum: { $ifNull: ["$totalVotes", 0] } } } },
      ]).catch(() => []),
      getMongoPingMs().catch(() => null),
    ]);

    const activeGuilds = guildPremiumDocs.filter((doc) => isActivePremium(doc, now));
    const activeUsers = userPremiumDocs.filter((doc) => isActivePremium(doc, now));

    const permanentGuilds = activeGuilds.filter((doc) => Boolean(doc.Permanent));
    const temporaryGuilds = activeGuilds.filter((doc) => !doc.Permanent);
    const permanentUsers = activeUsers.filter((doc) => Boolean(doc.Permanent));
    const temporaryUsers = activeUsers.filter((doc) => !doc.Permanent);

    const expiringPremium24h = [...temporaryUsers, ...temporaryGuilds].filter((doc) => {
      const expire = toMs(doc.Expire);
      return expire > now && expire <= next24h;
    }).length;

    const expiringPremium72h = [...temporaryUsers, ...temporaryGuilds].filter((doc) => {
      const expire = toMs(doc.Expire);
      return expire > now && expire <= next72h;
    }).length;

    const expiredPremiumPendingCleanup = [...userPremiumDocs, ...guildPremiumDocs].filter((doc) => {
      if (doc.Permanent) return false;
      return toMs(doc.Expire) <= now;
    }).length;

    const activeCodes = codeDocs.filter((doc) => Boolean(doc.Permanent) || toMs(doc.Expiry) > now);
    const expiredCodes = codeDocs.filter((doc) => !doc.Permanent && toMs(doc.Expiry) > 0 && toMs(doc.Expiry) <= now);

    const likelyVoteWindowUsers = temporaryUsers.filter((doc) => {
      const remaining = toMs(doc.Expire) - now;
      return remaining > 0 && remaining <= VOTE_WINDOW_MS;
    }).length;

    const totalVotes = Number(totalVotesAgg?.[0]?.totalVotes || 0);
    const votesLast24h = "N/A (vote event history not stored yet)";
    const redeemsLast24h = "N/A (redeem event history not stored yet)";

    const managerSummary = buildManagerSummary(client);
    const activePlayersNow = Number(managerSummary?.totalPlayers || 0);
    const nodesOnline = Number(managerSummary?.connectedNodes || 0);
    const nodesTotal = Number(managerSummary?.totalNodes || 0);

    const mongoState = getMongoStateLabel(mongoose?.connection?.readyState);
    const mongoLabel = mongoPingMs == null
      ? `\`${mongoState}\``
      : `\`${mongoState}\` (\`${mongoPingMs}ms\`)`;

    const { last1h: commandErrors1h, last24h: commandErrors24h } = countRecentErrors(client, now);
    const topCommands = getTopCommandsLast24h(client, now);

    const startedAtMs = now - Math.max(0, Math.floor(process.uptime() * 1000));
    const uptimeLabel = formatDuration(process.uptime() * 1000, { verbose: false, unitCount: 3 });
    const restartAtLabel = `<t:${Math.floor(startedAtMs / 1000)}:F>`;

    const guildList = activeGuilds
      .slice(0, 8)
      .map((doc) => {
        const guild = client.guilds.cache.get(doc.Id);
        const guildName = guild?.name || "Unknown Guild";
        return `- ${guildName} (\`${doc.Id}\`) - ${formatValidity(doc, now)}`;
      })
      .join("\n");

    const userList = activeUsers
      .slice(0, 8)
      .map((doc) => {
        const user = client.users.cache.get(doc.Id);
        const userTag = user?.tag || "Unknown User";
        return `- ${userTag} (\`${doc.Id}\`) - ${formatValidity(doc, now)}`;
      })
      .join("\n");

    const codeList = activeCodes
      .slice(0, 8)
      .map((doc) => {
        const validity = doc.Permanent
          ? "Permanent"
          : formatDuration(Math.max(0, toMs(doc.Expiry) - now), { verbose: false }).replace(/\s\d+s$/, "");
        return `- \`${doc.Code}\` - ${validity} - uses: ${doc.Usage ?? 0}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
      .setDescription(`Dashboard `)
      .addFields(
        statField("Premium Users (Permanent)", `\`${permanentUsers.length}\``, "users"),
        statField("Premium Users (Temporary)", `\`${temporaryUsers.length}\``, "users"),
        statField("Premium Guilds (Permanent)", `\`${permanentGuilds.length}\``, "server"),
        statField("Premium Guilds (Temporary)", `\`${temporaryGuilds.length}\``, "server"),
        statField("Expiring in 24h", `\`${expiringPremium24h}\``, "time"),
        statField("Expiring in 72h", `\`${expiringPremium72h}\``, "time"),
        statField("Expired Docs Pending Cleanup", `\`${expiredPremiumPendingCleanup}\``, "warn"),
        statField("Active Redeem Codes", `\`${activeCodes.length}\``, "premium"),
        statField("Expired Redeem Codes", `\`${expiredCodes.length}\``, "premium"),
        statField("Redeems in Last 24h", redeemsLast24h, "premium"),
        statField("Total Votes (All Users)", `\`${totalVotes}\``, "vote"),
        statField("Votes in Last 24h", votesLast24h, "vote"),
        statField("Premium Access via Vote Window", `\`${likelyVoteWindowUsers}\``, "vote"),
        statField("Active Players Now", `\`${activePlayersNow}\``, "music"),
        statField("24/7 Enabled Guilds", `\`${autojoinCount}\``, "autoplay"),
        statField("Lavalink Nodes Online / Total", `\`${nodesOnline}/${nodesTotal}\``, "server"),
        statField("Mongo Status + Ping", mongoLabel, "settings"),
        statField("Command Errors (1h / 24h)", `\`${commandErrors1h} / ${commandErrors24h}\``, "error"),
        {
          name: "Top 5 Used Commands (24h)",
          value: clampField(formatTopCommandList(topCommands), "No data"),
          inline: false,
        },
        statField("Blacklisted Users Count", `\`${blacklistedUsersCount}\``, "warn"),
        statField("Bot Uptime + Restart Time", `\`${uptimeLabel}\`\n${restartAtLabel}`, "time"),
        {
          name: "Guild Preview",
          value: clampField(guildList),
          inline: false,
        },
        {
          name: "User Preview",
          value: clampField(userList),
          inline: false,
        },
        {
          name: "Code Preview",
          value: clampField(codeList),
          inline: false,
        }
      );

    return message.channel.send({ embeds: [embed] });
  },
};
