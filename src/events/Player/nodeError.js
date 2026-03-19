const { getNodeLabel, getNodeHealth, updateNodeHealth } = require("../../utils/lavalinkHealth");

module.exports = async (client, node, error) => {
  const label = getNodeLabel(node);
  const details = String(error?.message || error || "unknown error").replace(/\s+/g, " ").trim();
  const dedupeKey = `${label}:${details}`;
  const now = Date.now();

  if (!client.__lavalinkNodeErrorHistory) {
    client.__lavalinkNodeErrorHistory = new Map();
  }

  const lastSeenAt = client.__lavalinkNodeErrorHistory.get(dedupeKey) || 0;
  if ((now - lastSeenAt) < 10000) return;
  client.__lavalinkNodeErrorHistory.set(dedupeKey, now);

  const previous = getNodeHealth(client, node) || {};
  updateNodeHealth(client, node, {
    connected: Boolean(node?.connected),
    sessionId: node?.sessionId || previous.sessionId || null,
    lastEvent: "error",
    lastEventAt: now,
    lastError: details,
    lastErrorAt: now,
    errors: Number(previous.errors || 0) + 1,
  });

  try {
    client.logger?.log(`LAVALINK => [NODE] ${label} error: ${details}`, "error");
  } catch (_err) {
    console.error(`LAVALINK => [NODE] ${label} error: ${details}`);
  }
};
