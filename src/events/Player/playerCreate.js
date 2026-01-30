module.exports = async (client, player) => {
	try {
		let eguild = client.guilds.cache.get(player.guildId);
		if (eguild) {
			console.log(`LAVALINK => [STATUS] player created in ${eguild.name} (${eguild.id}).`);
		}

		const Schema = require('../../schema/defaultvolumeSchema');
		let volumedata = await Schema.findOne({
			guildID: player.guildId,
		});
		
		if (volumedata) {
			const volumetoset = volumedata.Volume || 100;
			player.setVolume(volumetoset);
		} else {
			player.setVolume(100);
		}
	} catch (error) {
		console.error('[ERROR] playerCreate:', error.message);
	}
};