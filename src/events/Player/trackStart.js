const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const dbtrack = require('../../schema/trackinfoSchema.js')

module.exports = async (client, player, track, res) => {
    try {
        // Log track start attempt (safely handle undefined player.state)
        const stateInfo = (typeof player?.state === 'undefined' || player?.state === null) ? 'unknown' : player.state;
        // TrackStart event fired

        // If a recent play command set a suppression timestamp, wait until it's expired
        try {
            const suppressUntil = typeof player.get === 'function' ? player.get('suppressUntil') : null;
            if (suppressUntil && Date.now() < suppressUntil) {
                const wait = suppressUntil - Date.now();
                // Suppressing trackStart message for brief period
                await new Promise(resolve => setTimeout(resolve, wait));
            }
        } catch (e) {
            // ignore any errors accessing player metadata
        }

        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) {
            client.logger?.log(`Channel not found for textChannelId: ${player.textChannelId} in guild ${player.guildId}`, 'error');
            return;
        }

        // Track metadata
        const title = track.info?.title || track.title || 'Unknown';
        const uri = track.info?.uri || track.uri || '';
        const duration = track.info?.duration || track.duration || 0;
        const isStream = track.info?.isStream || track.isStream || false;

        const thing = new EmbedBuilder()
            .setAuthor({ name: 'Now Playing', iconURL: client.user.displayAvatarURL() })
            .setDescription(`[${title}](${uri}) - \`${isStream ? 'LIVE' : convertTime(duration)}\``)
            .setColor((typeof client !== 'undefined' && client?.embedColor) ? client.embedColor : '#ff0051');

        // More professional button styling with labels + emojis
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prtrack').setStyle(2).setLabel('Pause'),
            new ButtonBuilder().setCustomId('skiptrack').setStyle(2).setLabel('Skip'),
            new ButtonBuilder().setCustomId('showqueue').setStyle(2).setLabel('Queue'),
            new ButtonBuilder().setCustomId('stop').setStyle(4).setLabel('Stop')
        );

        try {
            // Do NOT mutate lavalink internals (player.queue). Keep last track in
            // player metadata only. `addprevious` and similar features should
            // read from `player.get('lastTrack')` instead of touching `player.queue`.
            try {
                if (typeof player.set === 'function') player.set('lastTrack', player.get && player.get('lastTrack') ? player.get('lastTrack') : track);
            } catch (qerr) {
                // ignore metadata set failure
            }

            const oldMsg = player.get(`playingsongmsg`);
            if (oldMsg) {
              await oldMsg.delete().catch(err => {
                try {
                  console.warn('Failed to delete old track start message:', err?.message);
                } catch (e) {}
              });
            }
        } catch (e) {
          try {
            console.warn('trackStart message cleanup error:', e?.message);
          } catch (logErr) {}
        }

        const msg = await channel.send({ embeds: [thing], components: [row] }).catch(async (error) => {
            client.logger?.log(`Failed to send track start embed in guild ${player.guildId}: ${error.message}`, 'error');
            // Try sending a simple text message as fallback
            try {
                const simpleMsg = await channel.send(`🎵 Now Playing: ${title}`).catch(err => {
                  console.warn('Failed to send simple fallback message:', err?.message);
                  return null;
                });
                if (simpleMsg) {
                    player.set(`playingsongmsg`, simpleMsg);
                    // Sent fallback simple track start message
                }
            } catch (simpleError) {
                client.logger?.log(`Failed to send simple message too: ${simpleError.message}`, 'error');
            }
            return null;
        });

        if (msg) {
            player.set(`playingsongmsg`, msg);
            // Save lastTrack metadata so we can reference it on the next start
            try { player.set('lastTrack', track); } catch (e) {}
            // Track start message sent successfully
        } else {
            client.logger?.log(`Track start message failed to send in guild ${player.guildId}`, 'error');
        }
    } catch (error) {
        client.logger?.log(`[ERROR] trackStart: ${error.message}`, 'error');
    }
};
