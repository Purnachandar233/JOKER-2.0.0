const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, player) => {
	try {
		let eguild = client.guilds.cache.get(player.guildId);
		if (eguild) {
			try { client.logger?.log(`LAVALINK => [STATUS] player created in ${eguild.name} (${eguild.id}).`, 'info'); } catch (e) { console.log(`LAVALINK => [STATUS] player created in ${eguild.name} (${eguild.id}).`); }
		}

		const Schema = require('../../schema/defaultvolumeSchema');
		let volumedata = await Schema.findOne({
			guildID: player.guildId,
		});
		
		if (volumedata) {
			const volumetoset = volumedata.Volume || 100;
			await safePlayer.safeCall(player, 'setVolume', volumetoset);
		} else {
			await safePlayer.safeCall(player, 'setVolume', 100);
		}

		// Rehydrate autoplay/player settings from DB so they survive restarts
		try {
			const Autoplay = require('../../schema/autoplay');
			const doc = await Autoplay.findOne({ guildID: player.guildId }).catch(() => null);
			if (doc && doc.enabled) {
				player.set('autoplay', true);
				player.set('identifier', doc.identifier || null);
				if (doc.requesterId) {
					const guild = client.guilds.cache.get(player.guildId);
					if (guild) {
						const member = await guild.members.fetch(doc.requesterId).catch(() => null);
						if (member) player.set('requester', member);
					}
				}
			} else {
				player.set('autoplay', false);
			}
		} catch (e) {
			client.logger?.log(`Failed to rehydrate autoplay for guild ${player.guildId}: ${e.message}`, 'warn');
		}

		// Ensure a basic in-memory queue object exists on the player for commands that
		// expect `player.queue` to be present. Create a queue shape compatible with
		// lavalink-client expectations (`current`, `previous`, `tracks`) so any
		// lavalink code that inspects the queue won't crash if a real queue is
		// missing (e.g., during reconnection scenarios).
		try {
			if (!player.queue) {
				const tracks = [];
				const previous = [];
				player.queue = {
					current: null,
					previous,
					tracks,
					// alias for older code paths
					items: tracks,
					add(t) {
						if (!t) return false;
						if (Array.isArray(t)) tracks.push(...t);
						else tracks.push(t);
						return true;
					},
					remove(start = 0, end = 1) {
						return tracks.splice(start, end - start + 1);
					},
					shuffle() {
						for (let i = tracks.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[tracks[i], tracks[j]] = [tracks[j], tracks[i]];
						}
						return tracks;
					},
					clear() { tracks.length = 0; previous.length = 0; return true; },
					get size() { return tracks.length; },
					get totalSize() { return tracks.length; },
					values() { return tracks.values(); }
				};
			}
		} catch (e) {
			client.logger?.log(`Failed to attach queue to player ${player.guildId}: ${e.message}`, 'warn');
		}
	} catch (error) {
		console.error('[ERROR] playerCreate:', error.message);
	}
};