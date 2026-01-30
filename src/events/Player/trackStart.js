const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const dbtrack = require('../../schema/trackinfoSchema.js')
const db = require("quick.db")

module.exports = async (client, player, track, res) => {
    try {
        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) return;

        const title = track.info?.title || track.title || 'Unknown';
        const uri = track.info?.uri || track.uri || '';
        const duration = track.info?.duration || track.duration || 0;
        const isStream = track.info?.isStream || track.isStream || false;

        const thing = new EmbedBuilder()
            .setAuthor({ name: 'Now Playing', iconURL: client.user.displayAvatarURL() })
            .setDescription(`[${title}](${uri}) - \`${isStream ? 'LIVE' : convertTime(duration)}\``)
            .setColor(0xff0051);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(2).setEmoji('⏸️').setCustomId("prtrack"),
            new ButtonBuilder().setStyle(2).setEmoji('⏭️').setCustomId("skiptrack"),
            new ButtonBuilder().setStyle(2).setEmoji('🔁').setCustomId("looptrack"),
            new ButtonBuilder().setStyle(2).setEmoji('📜').setCustomId("showqueue"),
            new ButtonBuilder().setStyle(2).setEmoji('⏹️').setCustomId("stop")
        );

        try {
            const oldMsg = player.get(`playingsongmsg`);
            if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch (e) {}

        const msg = await channel.send({ embeds: [thing], components: [row] }).catch(() => {});
        if (msg) player.set(`playingsongmsg`, msg);
    } catch (error) {
        console.error('[ERROR] trackStart:', error.message);
    }
};