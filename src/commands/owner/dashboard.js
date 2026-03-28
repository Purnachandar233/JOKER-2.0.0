const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");

const Premium = require("../../schema/Premium.js");
const RedeemCode = require("../../schema/redemcode.js");
const User = require("../../schema/User.js");
const Blacklist = require("../../schema/blacklistSchema.js");
const TwentyFourSeven = require("../../schema/twentyfourseven.js");

const formatDuration = require("../../utils/formatDuration");
const {
  buildManagerSummary,
  formatRestoreSummary,
  summarizeNode,
} = require("../../utils/lavalinkHealth");

const DAY_MS = 24 * 60 * 60 * 1000;
const VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;
const DASHBOARD_COMPONENT_TIMEOUT_MS = 10 * 60 * 1000;

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

function sortPremiumDocs(docs, now = Date.now()) {
  return [...(Array.isArray(docs) ? docs : [])].sort((a, b) => {
    const permanentDiff = Number(Boolean(b?.Permanent)) - Number(Boolean(a?.Permanent));
    if (permanentDiff !== 0) return permanentDiff;

    const aExpire = a?.Permanent ? Number.MAX_SAFE_INTEGER : Math.max(0, toMs(a?.Expire) - now);
    const bExpire = b?.Permanent ? Number.MAX_SAFE_INTEGER : Math.max(0, toMs(b?.Expire) - now);
    return aExpire - bExpire;
  });
}

function sortCodeDocs(docs, now = Date.now()) {
  return [...(Array.isArray(docs) ? docs : [])].sort((a, b) => {
    const permanentDiff = Number(Boolean(b?.Permanent)) - Number(Boolean(a?.Permanent));
    if (permanentDiff !== 0) return permanentDiff;

    const aExpire = a?.Permanent ? Number.MAX_SAFE_INTEGER : Math.max(0, toMs(a?.Expiry) - now);
    const bExpire = b?.Permanent ? Number.MAX_SAFE_INTEGER : Math.max(0, toMs(b?.Expiry) - now);
    return aExpire - bExpire;
  });
}

function buildPremiumPreview(client, docs, type, now = Date.now()) {
  const sorted = sortPremiumDocs(docs, now).slice(0, 8);

  return sorted
    .map((doc) => {
      if (type === "guild") {
        const guild = client.guilds.cache.get(doc.Id);
        const guildName = guild?.name || "Unknown Guild";
        return `- ${guildName} (\`${doc.Id}\`) - ${formatValidity(doc, now)}`;
      }

      const user = client.users.cache.get(doc.Id);
      const userTag = user?.tag || "Unknown User";
      return `- ${userTag} (\`${doc.Id}\`) - ${formatValidity(doc, now)}`;
    })
    .join("\n");
}

function buildCodePreview(codeDocs, now = Date.now()) {
  return sortCodeDocs(codeDocs, now)
    .slice(0, 8)
    .map((doc) => {
      const validity = doc.Permanent
        ? "Permanent"
        : formatDuration(Math.max(0, toMs(doc.Expiry) - now), { verbose: false }).replace(/\s\d+s$/, "");
      return `- \`${doc.Code}\` - ${validity} - uses: ${doc.Usage ?? 0}`;
    })
    .join("\n");
}

function formatPercent(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return "0%";
  return `${raw.toFixed(1)}%`;
}

function buildNodePreview(client) {
  const nodes = Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || []);
  if (!nodes.length) return "No Lavalink nodes registered.";

  return nodes
    .map((node) => {
      const summary = summarizeNode(client, node);
      const status = summary.connected ? "online" : "offline";
      return `- ${summary.label}: ${status} | players ${summary.playingPlayers}/${summary.players}`;
    })
    .join("\n");
}

async function collectDashboardSnapshot(client) {
  const now = Date.now();
  const next24h = now + DAY_MS;
  const next72h = now + (3 * DAY_MS);

  const [
    guildPremiumDocs,
    userPremiumDocs,
    codeDocs,
    blacklistedUsersCount,
    autojoinCount,
    userTotalsAgg,
    registeredUsersCount,
    mongoPingMs,
  ] = await Promise.all([
    Premium.find({ Type: "guild" }).lean().catch(() => []),
    Premium.find({ Type: "user" }).lean().catch(() => []),
    RedeemCode.find({}).lean().catch(() => []),
    Blacklist.countDocuments({}).catch(() => 0),
    TwentyFourSeven.countDocuments({}).catch(() => 0),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalVotes: { $sum: { $ifNull: ["$totalVotes", 0] } },
          totalCommands: { $sum: { $ifNull: ["$count", 0] } },
          totalSongsListened: { $sum: { $ifNull: ["$songsListened", 0] } },
          totalListenTimeMs: { $sum: { $ifNull: ["$totalListenTimeMs", 0] } },
        },
      },
    ]).catch(() => []),
    User.countDocuments({}).catch(() => 0),
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

  const totalVotes = Number(userTotalsAgg?.[0]?.totalVotes || 0);
  const totalCommandsUsed = Number(userTotalsAgg?.[0]?.totalCommands || 0);
  const totalSongsListened = Number(userTotalsAgg?.[0]?.totalSongsListened || 0);
  const totalListenTimeMs = Number(userTotalsAgg?.[0]?.totalListenTimeMs || 0);
  const managerSummary = buildManagerSummary(client);
  const activePlayersNow = Number(managerSummary?.totalPlayers || 0);
  const nodesOnline = Number(managerSummary?.connectedNodes || 0);
  const nodesTotal = Number(managerSummary?.totalNodes || 0);
  const totalGuilds = Number(client?.guilds?.cache?.size || 0);
  const totalMembersReach = Array.from(client?.guilds?.cache?.values?.() || [])
    .reduce((sum, guild) => sum + Number(guild?.memberCount || 0), 0);
  const premiumGuildCoverage = totalGuilds > 0 ? (activeGuilds.length / totalGuilds) * 100 : 0;

  const mongoState = getMongoStateLabel(mongoose?.connection?.readyState);
  const mongoLabel = mongoPingMs == null
    ? `\`${mongoState}\``
    : `\`${mongoState}\` (\`${mongoPingMs}ms\`)`;

  const { last1h: commandErrors1h, last24h: commandErrors24h } = countRecentErrors(client, now);
  const topCommands = getTopCommandsLast24h(client, now);

  const startedAtMs = now - Math.max(0, Math.floor(process.uptime() * 1000));
  const uptimeLabel = formatDuration(process.uptime() * 1000, { verbose: false, unitCount: 3 });
  const restartAtLabel = `<t:${Math.floor(startedAtMs / 1000)}:F>`;

  return {
    now,
    generatedAt: new Date(now),
    activeGuilds,
    activeUsers,
    permanentGuilds,
    temporaryGuilds,
    permanentUsers,
    temporaryUsers,
    expiringPremium24h,
    expiringPremium72h,
    expiredPremiumPendingCleanup,
    activeCodes,
    expiredCodes,
    likelyVoteWindowUsers,
    totalVotes,
    totalCommandsUsed,
    totalSongsListened,
    totalListenTimeLabel: formatDuration(Math.max(0, totalListenTimeMs), { verbose: false, unitCount: 3 }),
    activePlayersNow,
    nodesOnline,
    nodesTotal,
    totalGuilds,
    totalMembersReach,
    registeredUsersCount: Number(registeredUsersCount || 0),
    premiumGuildCoverage,
    nodePreview: buildNodePreview(client),
    restoreSummary: formatRestoreSummary(managerSummary?.restore),
    mongoLabel,
    mongoState,
    commandErrors1h,
    commandErrors24h,
    topCommands,
    blacklistedUsersCount,
    autojoinCount,
    uptimeLabel,
    restartAtLabel,
    guildPreview: buildPremiumPreview(client, activeGuilds, "guild", now),
    userPreview: buildPremiumPreview(client, activeUsers, "user", now),
    codePreview: buildCodePreview(activeCodes, now),
  };
}

function createStatField(name, value, inline = true) {
  return {
    name,
    value: String(value),
    inline,
  };
}

function buildBaseEmbed(client, snapshot, pageTitle, pageHint) {
  return new EmbedBuilder()
    .setColor(client?.embedColor || "#ff0051")
    .setAuthor({
      name: `${client.user.username} Owner Dashboard`,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(pageTitle)
    .setDescription(pageHint)
    .setTimestamp(snapshot.generatedAt)
    .setFooter({ text: "Buttons below switch pages and refresh live data." });
}

function buildOverviewEmbed(client, snapshot) {
  return buildBaseEmbed(
    client,
    snapshot,
    "Overview",
    "High-level bot, premium, and runtime health."
  ).addFields(
    createStatField("Total Guilds", `\`${snapshot.totalGuilds}\``),
    createStatField("Total Member Reach", `\`${snapshot.totalMembersReach.toLocaleString("en-US")}\``),
    createStatField("Registered Users", `\`${snapshot.registeredUsersCount}\``),
    createStatField("Active Premium Users", `\`${snapshot.activeUsers.length}\``),
    createStatField("Active Premium Guilds", `\`${snapshot.activeGuilds.length}\``),
    createStatField("Active Redeem Codes", `\`${snapshot.activeCodes.length}\``),
    createStatField("Active Players", `\`${snapshot.activePlayersNow}\``),
    createStatField("24/7 Enabled Guilds", `\`${snapshot.autojoinCount}\``),
    createStatField("Mongo Status + Ping", snapshot.mongoLabel),
    createStatField("Lavalink Nodes", `\`${snapshot.nodesOnline}/${snapshot.nodesTotal}\``),
    createStatField("Blacklisted Users", `\`${snapshot.blacklistedUsersCount}\``),
    createStatField("Command Errors (1h / 24h)", `\`${snapshot.commandErrors1h} / ${snapshot.commandErrors24h}\``),
    createStatField("Uptime + Restart Time", `\`${snapshot.uptimeLabel}\`\n${snapshot.restartAtLabel}`, false),
    {
      name: "Node Distribution",
      value: clampField(snapshot.nodePreview),
      inline: false,
    },
    {
      name: "Restore State",
      value: clampField(snapshot.restoreSummary),
      inline: false,
    }
  );
}

function buildPremiumEmbed(client, snapshot) {
  return buildBaseEmbed(
    client,
    snapshot,
    "Premium",
    "Detailed premium state, expiring subscriptions, and active premium previews."
  ).addFields(
    createStatField("Premium Users (Permanent)", `\`${snapshot.permanentUsers.length}\``),
    createStatField("Premium Users (Temporary)", `\`${snapshot.temporaryUsers.length}\``),
    createStatField("Premium Guilds (Permanent)", `\`${snapshot.permanentGuilds.length}\``),
    createStatField("Premium Guilds (Temporary)", `\`${snapshot.temporaryGuilds.length}\``),
    createStatField("Premium Guild Coverage", `\`${formatPercent(snapshot.premiumGuildCoverage)}\``),
    createStatField("Expiring in 24h", `\`${snapshot.expiringPremium24h}\``),
    createStatField("Expiring in 72h", `\`${snapshot.expiringPremium72h}\``),
    createStatField("Expired Docs Pending Cleanup", `\`${snapshot.expiredPremiumPendingCleanup}\``),
    createStatField("Premium Access via Vote Window", `\`${snapshot.likelyVoteWindowUsers}\``),
    {
      name: "Guild Preview",
      value: clampField(snapshot.guildPreview),
      inline: false,
    },
    {
      name: "User Preview",
      value: clampField(snapshot.userPreview),
      inline: false,
    }
  );
}

function buildActivityEmbed(client, snapshot) {
  return buildBaseEmbed(
    client,
    snapshot,
    "Activity",
    "Votes, command errors, and current command usage trends."
  ).addFields(
    createStatField("Total Votes (All Users)", `\`${snapshot.totalVotes}\``),
    createStatField("Commands Used Total", `\`${snapshot.totalCommandsUsed.toLocaleString("en-US")}\``),
    createStatField("Songs Listened Total", `\`${snapshot.totalSongsListened.toLocaleString("en-US")}\``),
    createStatField("Listen Time Total", `\`${snapshot.totalListenTimeLabel}\``),
    createStatField("Premium Access via Vote Window", `\`${snapshot.likelyVoteWindowUsers}\``),
    createStatField("Command Errors (1h / 24h)", `\`${snapshot.commandErrors1h} / ${snapshot.commandErrors24h}\``),
    {
      name: "Top 5 Used Commands (24h)",
      value: clampField(formatTopCommandList(snapshot.topCommands), "No data"),
      inline: false,
    }
  );
}

function buildCodesEmbed(client, snapshot) {
  return buildBaseEmbed(
    client,
    snapshot,
    "Codes",
    "Redeem code inventory and active code preview."
  ).addFields(
    createStatField("Active Redeem Codes", `\`${snapshot.activeCodes.length}\``),
    createStatField("Expired Redeem Codes", `\`${snapshot.expiredCodes.length}\``),
    {
      name: "Code Preview",
      value: clampField(snapshot.codePreview),
      inline: false,
    }
  );
}

function buildDashboardButtons(activeView, disabled = false) {
  const button = (id, label, viewName, style = ButtonStyle.Secondary) => new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(activeView === viewName ? ButtonStyle.Primary : style)
    .setDisabled(disabled);

  return new ActionRowBuilder().addComponents(
    button("owner_dashboard_overview", "Overview", "overview"),
    button("owner_dashboard_premium", "Premium", "premium"),
    button("owner_dashboard_activity", "Activity", "activity"),
    button("owner_dashboard_codes", "Codes", "codes"),
    button("owner_dashboard_refresh", "Refresh", null, ButtonStyle.Success),
  );
}

function buildDashboardPayload(client, snapshot, view, disabled = false) {
  const embedFactory = {
    overview: buildOverviewEmbed,
    premium: buildPremiumEmbed,
    activity: buildActivityEmbed,
    codes: buildCodesEmbed,
  };

  const embed = (embedFactory[view] || buildOverviewEmbed)(client, snapshot);

  return {
    embeds: [embed],
    components: [buildDashboardButtons(view, disabled)],
    allowedMentions: { parse: [], repliedUser: false },
  };
}

module.exports = {
  name: "dashboard",
  category: "owner",
  aliases: ["db", "premiumdashboard", "pdashboard"],
  description: "Shows detailed owner dashboard data.",
  owneronly: true,
  execute: async (message, args, client) => {
    let snapshot = await collectDashboardSnapshot(client);
    let currentView = "overview";

    const sent = await message.channel.send(buildDashboardPayload(client, snapshot, currentView));
    const collector = sent.createMessageComponentCollector({
      time: DASHBOARD_COMPONENT_TIMEOUT_MS,
    });

    collector.on("collect", async (interaction) => {
      if (!interaction.isButton()) return;

      if (interaction.user.id !== message.author.id) {
        await interaction.reply({
          content: "This dashboard belongs to the command runner.",
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      await interaction.deferUpdate().catch(() => {});

      try {
        switch (interaction.customId) {
          case "owner_dashboard_overview":
            currentView = "overview";
            break;
          case "owner_dashboard_premium":
            currentView = "premium";
            break;
          case "owner_dashboard_activity":
            currentView = "activity";
            break;
          case "owner_dashboard_codes":
            currentView = "codes";
            break;
          case "owner_dashboard_refresh":
            snapshot = await collectDashboardSnapshot(client);
            break;
          default:
            return;
        }

        if (interaction.customId !== "owner_dashboard_refresh") {
          await sent.edit(buildDashboardPayload(client, snapshot, currentView)).catch(() => {});
          return;
        }

        await sent.edit(buildDashboardPayload(client, snapshot, currentView)).catch(() => {});
      } catch (error) {
        client.logger?.log?.(`Owner dashboard interaction failed: ${error?.message || error}`, "error");
        await interaction.followUp({
          content: "Failed to update the dashboard.",
          ephemeral: true,
        }).catch(() => {});
      }
    });

    collector.on("end", async () => {
      await sent.edit(buildDashboardPayload(client, snapshot, currentView, true)).catch(() => {});
    });
  },
};
