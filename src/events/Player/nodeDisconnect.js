module.exports = async (client, node, reason) => {

	try { client.logger?.log(`LAVALINK => [STATUS] ${node.options.identifier} disconnect.`, 'warn'); } catch (e) { console.log(`LAVALINK => [STATUS] ${node.options.identifier} disconnect.`); }

}