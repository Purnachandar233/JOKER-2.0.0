const formatDuration = require("./formatDuration");
const {
  formatDurationLabel,
  getQueueArray,
  getQueueTiming,
  getRequesterInfo,
  getTrackUrl,
} = require("./queue");

function getNodeLabel(node) {
  return String(
    node?.id ||
    node?.options?.id ||
    node?.options?.identifier ||
    node?.options?.host ||
    "unknown"
  );
}

function getNodeUrl(node) {
  const secure = Boolean(node?.options?.secure);
  const protocol = secure ? "https" : "http";
  const host = node?.options?.host || "unknown-host";
  const port = node?.options?.port || "unknown-port";
  return `${protocol}://${host}:${port}`;
}

function getNodeHealthStore(client) {
  if (!client.__lavalinkNodeHealth) {
    client.__lavalinkNodeHealth = new Map();
  }
  return client.__lavalinkNodeHealth;
}

function updateNodeHealth(client, node, updates = {}) {
  const label = getNodeLabel(node);
  const store = getNodeHealthStore(client);
  const current = store.get(label) || { label };
  const next = {
    ...current,
    ...updates,
    label,
    updatedAt: Date.now(),
  };
  store.set(label, next);
  return next;
}

function getNodeHealth(client, node) {
  const store = getNodeHealthStore(client);
  return store.get(getNodeLabel(node)) || null;
}

function getAdvertisedSources(node) {
  const list = Array.isArray(node?.info?.sourceManagers) ? node.info.sourceManagers : [];
  return [...new Set(list.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getNodePluginNames(node) {
  const plugins = Array.isArray(node?.info?.plugins) ? node.info.plugins : [];
  return plugins
    .map((plugin) => String(plugin?.name || plugin || "").trim())
    .filter(Boolean);
}

function formatMemoryMiB(bytes) {
  const raw = Number(bytes);
  if (!Number.isFinite(raw) || raw < 0) return "n/a";
  return `${Math.round(raw / 1024 / 1024)} MiB`;
}

function formatCpuPercent(load) {
  const raw = Number(load);
  if (!Number.isFinite(raw) || raw < 0) return "n/a";
  return `${(raw * 100).toFixed(1)}%`;
}

function summarizeNode(client, node) {
  const state = getNodeHealth(client, node) || {};
  const stats = node?.stats || {};
  const memory = stats.memory || {};
  const cpu = stats.cpu || {};

  return {
    label: getNodeLabel(node),
    url: getNodeUrl(node),
    connected: Boolean(node?.connected),
    sessionId: node?.sessionId || null,
    restTimeoutMs: Number(node?.options?.requestSignalTimeoutMS || 0) || null,
    players: Number(stats.players || 0),
    playingPlayers: Number(stats.playingPlayers || 0),
    uptimeMs: Number(stats.uptime || 0) || null,
    memoryUsed: formatMemoryMiB(memory.used),
    memoryAllocated: formatMemoryMiB(memory.allocated),
    cpuSystem: formatCpuPercent(cpu.systemLoad),
    cpuLavalink: formatCpuPercent(cpu.lavalinkLoad),
    sources: getAdvertisedSources(node),
    plugins: getNodePluginNames(node),
    lastEvent: state.lastEvent || null,
    lastEventAt: state.lastEventAt || null,
    lastError: state.lastError || null,
    lastErrorAt: state.lastErrorAt || null,
    lastDisconnectReason: state.lastDisconnectReason || null,
    lastDisconnectAt: state.lastDisconnectAt || null,
    reconnects: Number(state.reconnects || 0),
    disconnects: Number(state.disconnects || 0),
    errors: Number(state.errors || 0),
  };
}

function buildManagerSummary(client) {
  const nodeList = Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || []);
  const connectedNodes = nodeList.filter((node) => node?.connected).length;
  const totalPlayers = client?.lavalink?.players?.size ?? 0;

  return {
    initialized: Boolean(client?.lavalink),
    usable: Boolean(client?.lavalink?.useable),
    totalNodes: nodeList.length,
    connectedNodes,
    totalPlayers,
    restore: client.__lavalinkRestoreState || null,
  };
}

function buildGuildPlayerSummary(client, guildId) {
  const player = client?.lavalink?.players?.get?.(guildId);
  if (!player) return null;

  const queue = getQueueArray(player);
  const current = queue[0] || null;
  const timing = getQueueTiming(player);
  const fallbackRequester = typeof player?.get === "function" ? player.get("requester") : null;
  const fallbackRequesterId = typeof player?.get === "function" ? player.get("requesterId") : null;
  const requester = getRequesterInfo(current, {
    fallbackRequester,
    fallbackRequesterId,
    fallbackTag: null,
  });

  return {
    present: true,
    connected: Boolean(player.connected),
    playing: Boolean(player.playing),
    paused: Boolean(player.paused),
    volume: Number(player.volume ?? 100),
    loop: player.repeatMode === "track" || player.repeatMode === 1
      ? "track"
      : player.repeatMode === "queue" || player.repeatMode === 2
        ? "queue"
        : "off",
    queueSize: queue.length,
    currentTitle: current?.info?.title || current?.title || "None",
    currentUrl: getTrackUrl(current),
    requester: requester.label,
    nodeLabel: getNodeLabel(player.node),
    botVoiceChannelId: player.voiceChannelId || null,
    textChannelId: player.textChannelId || null,
    voiceBridgeReady: Boolean(player.voice?.sessionId && player.voice?.token && player.voice?.endpoint),
    remaining: timing.hasLive
      ? `${formatDurationLabel(timing.remainingKnownMs)} + live`
      : formatDurationLabel(timing.remainingKnownMs),
    finishAt: timing.finishAt || null,
    positionMs: Math.max(0, Number(player.position || player.lastPosition || 0)),
  };
}

function formatHealthTimestamp(timestampMs) {
  const raw = Number(timestampMs);
  if (!Number.isFinite(raw) || raw <= 0) return "never";
  return `${formatDuration(Date.now() - raw, { verbose: true, unitCount: 2 })} ago`;
}

function formatRestoreSummary(restore) {
  if (!restore) return "No restore attempt recorded.";
  if (restore.status === "skipped") {
    return `Skipped: ${restore.reason || "unknown reason"}`;
  }
  if (restore.status === "failed") {
    return `Failed: ${restore.reason || "unknown error"}`;
  }
  if (restore.status === "starting") {
    return "Restore is still starting.";
  }

  const parts = [
    `Status: ${restore.status || "unknown"}`,
    `Connected: ${Number(restore.connectedCount || 0)}`,
    `Autoplay: ${Number(restore.autoplayCount || 0)}`,
    `Failed: ${Number(restore.failedCount || 0)}`,
  ];

  if (Array.isArray(restore.failedExamples) && restore.failedExamples.length) {
    parts.push(`Examples: ${restore.failedExamples.join(" ; ")}`);
  }

  return parts.join("\n");
}

function formatNodeSummary(summary) {
  const sources = summary.sources.length ? summary.sources.join(", ") : "none";
  const plugins = summary.plugins.length ? summary.plugins.join(", ") : "none";
  const lastError = summary.lastError
    ? `${summary.lastError} (${formatHealthTimestamp(summary.lastErrorAt)})`
    : "none";
  const lastDisconnect = summary.lastDisconnectReason
    ? `${summary.lastDisconnectReason} (${formatHealthTimestamp(summary.lastDisconnectAt)})`
    : "none";

  return [
    `Status: ${summary.connected ? "connected" : "disconnected"}`,
    `URL: ${summary.url}`,
    `Session: ${summary.sessionId || "none"}`,
    `Players: ${summary.playingPlayers}/${summary.players}`,
    `CPU: ${summary.cpuLavalink} lavalink | ${summary.cpuSystem} system`,
    `Memory: ${summary.memoryUsed} / ${summary.memoryAllocated}`,
    `Sources: ${sources}`,
    `Plugins: ${plugins}`,
    `Last event: ${summary.lastEvent || "unknown"} (${formatHealthTimestamp(summary.lastEventAt)})`,
    `Last error: ${lastError}`,
    `Last disconnect: ${lastDisconnect}`,
  ].join("\n");
}

function formatGuildPlayerSummary(summary) {
  if (!summary) return "No guild player is active in this server.";

  const currentLine = summary.currentUrl
    ? `[${summary.currentTitle}](${summary.currentUrl})`
    : summary.currentTitle;
  const finishLine = summary.finishAt
    ? `<t:${Math.floor(summary.finishAt / 1000)}:t>`
    : "unknown";

  return [
    `State: ${summary.connected ? "connected" : "disconnected"} | ${summary.playing ? "playing" : "idle"} | paused=${summary.paused}`,
    `Queue: ${summary.queueSize} tracks | Remaining: ${summary.remaining}`,
    `Loop: ${summary.loop} | Volume: ${summary.volume}%`,
    `Node: ${summary.nodeLabel} | Voice bridge: ${summary.voiceBridgeReady ? "ready" : "not ready"}`,
    `Bot VC: ${summary.botVoiceChannelId || "none"} | Text: ${summary.textChannelId || "none"}`,
    `Position: ${formatDurationLabel(summary.positionMs)} | Ends: ${finishLine}`,
    `Requester: ${summary.requester}`,
    `Current: ${currentLine}`,
  ].join("\n");
}

module.exports = {
  buildGuildPlayerSummary,
  buildManagerSummary,
  formatGuildPlayerSummary,
  formatHealthTimestamp,
  formatNodeSummary,
  formatRestoreSummary,
  getNodeHealth,
  getNodeHealthStore,
  getNodeLabel,
  getNodeUrl,
  summarizeNode,
  updateNodeHealth,
};
