module.exports = async (client, player) => {
  client.logger?.log("LAVALINK => [STATUS] successfully connected.", 'ready');
  // 24/7 reconnection is now handled in ready.js to avoid duplicate players
}
