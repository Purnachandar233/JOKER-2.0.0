const { getNodeLabel, getNodeHealth, updateNodeHealth } = require("../../utils/lavalinkHealth");

module.exports = async (client, node, reason) => {
  const label = getNodeLabel(node);
  const details = String(reason?.reason || reason?.message || reason || "unknown reason").replace(/\s+/g, " ").trim();
  const previous = getNodeHealth(client, node) || {};

  updateNodeHealth(client, node, {
    connected: false,
    sessionId: node?.sessionId || previous.sessionId || null,
    lastEvent: "disconnected",
    lastEventAt: Date.now(),
    lastDisconnectReason: details,
    lastDisconnectAt: Date.now(),
    disconnects: Number(previous.disconnects || 0) + 1,
  });

  try {
    client.logger?.log(`LAVALINK => [NODE] ${label} disconnected (${details}).`, "warn");
  } catch (_err) {
    console.log(`LAVALINK => [NODE] ${label} disconnected (${details}).`);
  }
};
