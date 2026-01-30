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
        const pre = args[0];

        if (!pre) {
            const embed = new EmbedBuilder()
                .setDescription('*Please provide the prefix you wish to set.*')
                .setColor(0xff0051);
            return message.reply({ embeds: [embed] });
        }
       
        if (pre.length > 5) {
            const embed = new EmbedBuilder()
                .setDescription('*The prefix must be 5 characters or less.*')
                .setColor(0xff0051);
            return message.reply({ embeds: [embed] });
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
            .setColor(0xff0051)
            .setFooter({ text: "Joker Music" });
        return message.reply({ embeds: [success] });
    },
};
