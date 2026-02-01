module.exports = async (client, node, error) => {
	client.logger?.log(`LAVALINK => [STATUS] ${node.options.identifier} encountered an error: ${error.message}.`, 'error');

}