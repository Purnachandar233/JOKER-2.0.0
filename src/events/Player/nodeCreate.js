const { getNodeLabel, updateNodeHealth } = require("../../utils/lavalinkHealth");

module.exports = async (client, node) => {
  const label = getNodeLabel(node);
  const host = node?.options?.host || "unknown-host";
  const port = node?.options?.port || "unknown-port";

  updateNodeHealth(client, node, {
    connected: Boolean(node?.connected),
    createdAt: Date.now(),
    host,
    port,
    lastEvent: "created",
    lastEventAt: Date.now(),
  });

  try {
    client.logger?.log(`LAVALINK => [NODE] ${label} created (${host}:${port}).`, "info");
  } catch (_err) {
    console.log(`LAVALINK => [NODE] ${label} created (${host}:${port}).`);
  }
};
