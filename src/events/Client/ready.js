const { ActivityType, Events } = require("discord.js");
const Topgg = require("@top-gg/sdk");
const autojoin = require("../../schema/twentyfourseven.js");

const LAVALINK_INIT_DELAY = 1;// 5 second delay for Lavalink to initialize

module.exports = async (client) => {
    client.logger.log(`${client.user.username} online!`, "ready");
    client.user.setPresence({
        status: 'Streaming',
        activities: [{
            name: `STREAMING QUALITY MUSIC`,
            type: ActivityType.Streaming,
            url: 'https://twitch.tv/musical'
        }]
    });

    // Set up Top.gg API
    if (process.env.TOPGG_TOKEN) {
        client.topgg = new Topgg.Api(process.env.TOPGG_TOKEN);
    }

    // Reconnect to 24/7 voice channels after Lavalink is ready
    setTimeout(async () => {
        if (!client.lavalink) return;
        const safePlayer = require('../../utils/safePlayer');
        const data = await autojoin.find();
        for (const vc of data) {
            const guild = client.guilds.cache.get(vc.guildID);
            if (!guild) continue;
            const voiceChannel = guild.channels.cache.get(vc.voiceChannel);
            if (!voiceChannel) continue;
            const textChannel = guild.channels.cache.get(vc.textChannel);
            if (!textChannel) continue;

            try {
                // Check if player already exists
                let player = client.lavalink.players.get(vc.guildID);
                if (!player) {
                    // Create player for 24/7
                    player = client.lavalink.createPlayer({
                        guildId: vc.guildID,
                        textChannelId: vc.textChannel,
                        voiceChannelId: vc.voiceChannel,
                        selfDeafen: true,
                    });
                }

                // Ensure connection
                await safePlayer.safeCall(player, 'connect');

                // Restore autoplay state if it was enabled
                const autoplaySchema = require('../../schema/autoplay.js');
                const savedAutoplay = await autoplaySchema.findOne({ guildID: vc.guildID });
                if (savedAutoplay && savedAutoplay.enabled) {
                    player.set("autoplay", true);
                    // savedAutoplay stores requesterId; keep requesterId and clear any full object
                    player.set("requester", null);
                    player.set("requesterId", savedAutoplay.requesterId || null);
                    player.set("identifier", savedAutoplay.identifier);
                    player.set("autoplayQuery", savedAutoplay.query || null);
                    client.logger.log(`Restored autoplay state for 24/7 in ${guild.name}`, "ready");
                }

                client.logger.log(`Reconnected to 24/7 VC in ${guild.name}`, "ready");
            } catch (error) {
                console.error(`Failed to reconnect to 24/7 VC in ${guild.name}:`, error);
            }
        }
    }, 5000); // Wait 5 seconds for Lavalink to be ready

};
