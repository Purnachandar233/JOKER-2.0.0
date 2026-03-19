const { getNodeLabel, getNodeHealth, updateNodeHealth } = require("../../utils/lavalinkHealth");

module.exports = async (client, node) => {
  const label = getNodeLabel(node);
  const previous = getNodeHealth(client, node) || {};
  updateNodeHealth(client, node, {
    connected: true,
    sessionId: node?.sessionId || null,
    lastEvent: "reconnected",
    lastEventAt: Date.now(),
    reconnects: Number(previous.reconnects || 0) + 1,
  });

  try {
    client.logger?.log(`LAVALINK => [NODE] ${label} reconnected.`, "info");
  } catch (_err) {
    console.log(`LAVALINK => [NODE] ${label} reconnected.`);
  }
};
