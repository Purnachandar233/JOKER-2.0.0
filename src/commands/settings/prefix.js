const { EmbedBuilder } = require('discord.js');
const db = require('../../schema/prefix.js');

module.exports = {
    name: 'setprefix',
    category: 'Settings',
    description: 'Set Custom Prefix',
    args: false,
    usage: '<prefix>',
    aliases: ['prefix'],
    owner: false,
    votelock: true,
    wl: true,
    execute: async (message, args, client, prefix) => {
        // Require Manage Server (Manage Guild) or Administrator to change prefix
        if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
            const noperms = new EmbedBuilder()
                .setColor(message.client?.embedColor || '#ff0051')
                .setDescription('*You need the `Manage Server` or `Administrator` permission to change the prefix.*');
            return message.channel.send({ embeds: [noperms] });
        }

        const pre = args[0];

        if (!pre) {
            const embed = new EmbedBuilder()
                .setDescription('*Please provide the prefix you wish to set.*')
                .setColor(message.client?.embedColor || '#ff0051');
            return message.channel.send({ embeds: [embed] });
        }

        if (pre.length > 5) {
            const embed = new EmbedBuilder()
                .setDescription('*The prefix must be 5 characters or less.*')
                .setColor(message.client?.embedColor || '#ff0051');
            return message.channel.send({ embeds: [embed] });
        }

        const data = await db.findOne({ Guild: message.guild.id });
        if (data) {
            data.oldPrefix = prefix;
            data.Prefix = pre;
            await data.save();
        } else {
            await new db({
                Guild: message.guild.id,
                Prefix: pre,
                oldPrefix: prefix,
            }).save();
        }

        const success = new EmbedBuilder()
            .setDescription(`✧ The prefix for this server has been updated to **${pre}**`)
            .setColor(message.client?.embedColor || '#ff0051')
        return message.channel.send({ embeds: [success] });
    },
};
