const { getNodeLabel, getNodeHealth, updateNodeHealth } = require("../../utils/lavalinkHealth");
const NODE_ERROR_HISTORY_TTL_MS = 10 * 60 * 1000;
const NODE_ERROR_HISTORY_MAX = 1000;

function pruneNodeErrorHistory(store, now = Date.now()) {
  if (!(store instanceof Map)) return;

  for (const [key, value] of store.entries()) {
    if (!Number.isFinite(Number(value)) || (now - Number(value)) > NODE_ERROR_HISTORY_TTL_MS) {
      store.delete(key);
    }
  }

  if (store.size <= NODE_ERROR_HISTORY_MAX) return;

  const overflow = store.size - NODE_ERROR_HISTORY_MAX;
  let removed = 0;
  for (const key of store.keys()) {
    store.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

module.exports = async (client, node, error) => {
  const label = getNodeLabel(node);
  const details = String(error?.message || error || "unknown error").replace(/\s+/g, " ").trim();
  const dedupeKey = `${label}:${details}`;
  const now = Date.now();

  if (!client.__lavalinkNodeErrorHistory) {
    client.__lavalinkNodeErrorHistory = new Map();
  }
  pruneNodeErrorHistory(client.__lavalinkNodeErrorHistory, now);

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
