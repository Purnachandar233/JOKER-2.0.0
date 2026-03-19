const { getNodeLabel, updateNodeHealth } = require("../../utils/lavalinkHealth");

module.exports = async (client, node) => {
  const label = getNodeLabel(node);
  const current = updateNodeHealth(client, node, {
    connected: true,
    sessionId: node?.sessionId || null,
    lastEvent: "connected",
    lastEventAt: Date.now(),
    lastDisconnectReason: null,
  });

  if (!Number.isFinite(current.connects)) {
    current.connects = 0;
  }
  updateNodeHealth(client, node, { connects: Number(current.connects || 0) + 1 });

  try {
    client.logger?.log(`LAVALINK => [NODE] ${label} connected.`, "info");
  } catch (_err) {
    console.log(`LAVALINK => [NODE] ${label} connected.`);
  }
};
