module.exports = async (client, node) => {

	try { client.logger?.log(`LAVALINK => [STATUS] ${node.options.identifier} successfully created.`, 'info'); } catch (e) { console.log(`LAVALINK => [STATUS] ${node.options.identifier} successfully created.`); }

}