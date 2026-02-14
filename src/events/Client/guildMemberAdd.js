const { EmbedBuilder } = require('discord.js');
const Schema = require('../../schema/welcome.js');

module.exports = async (client, member) => {
    const data = await Schema.findOne({ guildID: member.guild.id });
    if (!data || !data.enabled) return;

    // Auto-role
    if (data.roleID) {
        const role = member.guild.roles.cache.get(data.roleID);
        if (role) member.roles.add(role).catch(() => {});
    }

    // Welcome Message
    if (data.channelID) {
        const channel = member.guild.channels.cache.get(data.channelID);
        if (channel) {
            const msg = data.message
                .replace('{user}', `<@${member.id}>`)
                .replace('{server}', member.guild.name);

            const embed = new EmbedBuilder()
                .setColor(client.embedColor || '#ff0051')
                .setTitle('Welcome!')
                .setDescription(msg)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            channel.send({ embeds: [embed] }).catch(() => {});
        }
    }
};
