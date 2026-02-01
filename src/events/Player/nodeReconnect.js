module.exports = async (client, node) => {
	try { client.logger?.log(`LAVALINK => [STATUS] ${node.options.identifier} reconnected.`, 'info'); } catch (e) { console.log(`LAVALINK => [STATUS] ${node.options.identifier} reconnected.`); }

}