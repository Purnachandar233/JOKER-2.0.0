const { EmbedBuilder, ChannelType } = require("discord.js");
const delay = require("delay");

module.exports = async (client, oldState, newState) => {
    const channel = newState.guild.channels.cache.get(
        newState.channel?.id ?? newState.channelId
    );
    const player = client.lavalink?.players.get(newState.guild.id);

    if (!player) return;

    const botMember = newState.guild.members.cache.get(client.user.id);
    if (!botMember || !botMember.voice || !botMember.voice.channelId) {
        player.destroy();
        return;
    }

    // Check for stage channel audience change
    if (newState.id === client.user.id && channel?.type === ChannelType.GuildStageVoice) {
        if (!oldState.channelId) {
            try {
                await newState.guild.me.voice.setSuppressed(false);
            } catch (err) {
                player.pause(true);
            }
        } else if (oldState.suppress !== newState.suppress) {
            player.pause(newState.suppress);
        }
    }

    if (oldState.id === client.user.id) return;

    const oldBotMember = oldState.guild.members.cache.get(client.user.id);
    if (!oldBotMember || !oldBotMember.voice || !oldBotMember.voice.channelId) return;

    const vcDontleaveSchema = require('../../schema/twentyfourseven.js');
    const isactivated = await vcDontleaveSchema.findOne({ guildID: oldState.guild.id });

    if (isactivated) return;

    // Make sure the bot is in the voice channel that 'activated' the event
    if (oldBotMember.voice.channelId === oldState.channelId) {
        if (
            oldBotMember.voice.channel &&
            oldBotMember.voice.channel.members.filter((m) => !m.user.bot).size === 0 &&
            !is247Enabled  // Only leave if 24/7 is NOT enabled
        ) {
            await delay(180000);

            // Re-fetch state after delay
            const currentBotMember = oldState.guild.members.cache.get(client.user.id);
            if (
                currentBotMember?.voice?.channel &&
                currentBotMember.voice.channel.members.filter((m) => !m.user.bot).size === 0
            ) {
                await player.destroy();

                const embed = new EmbedBuilder()
                    .setDescription(`I have left the voice channel due to inactivity. Enable 24/7 to disable this!`)
                    .setColor(0x2f3136);

                try {
                    const textChannel = client.channels.cache.get(player.textChannelId);
                    if (textChannel) textChannel.send({ embeds: [embed] });
                } catch (err) {
                    // Ignore errors sending message
                }
            }
        }
    }
};
