const { EmbedBuilder, PermissionFlagsBits, ApplicationCommandOptionType } = require('discord.js');
const Schema = require('./welcome');

module.exports = {
    name: 'welcome',
    description: 'Setup the professional welcome system',
    userPermissions: ['Administrator'],
    options: [
        {
            name: 'setup',
            description: 'Setup the welcome channel',
            type: 1,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to send welcome messages in',
                    type: ApplicationCommandOptionType.Channel,
                    required: true
                },
                {
                    name: 'message',
                    description: 'The welcome message (use {user} and {server})',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        },
        {
            name: 'role',
            description: 'Auto-role for new members',
            type: 1,
            options: [
                {
                    name: 'role',
                    description: 'The role to give to new members',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                }
            ]
        },
        {
            name: 'toggle',
            description: 'Enable or disable the welcome system',
            type: 1,
            options: [
                {
                    name: 'status',
                    description: 'Enable or disable',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                }
            ]
        }
    ],

    run: async (client, interaction) => {
        const sub = interaction.options.getSubcommand();
        const { guildId } = interaction;

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const msg = interaction.options.getString('message') || 'Welcome {user} to {server}!';

            await Schema.findOneAndUpdate(
                { guildID: guildId },
                { channelID: channel.id, message: msg, enabled: true },
                { upsert: true }
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(client.embedColor)
                    .setTitle('Welcome System Setup')
                    .setDescription(`Welcome channel set to <#${channel.id}>\nMessage: \`${msg}\``)]
            });
        }

        if (sub === 'role') {
            const role = interaction.options.getRole('role');

            await Schema.findOneAndUpdate(
                { guildID: guildId },
                { roleID: role.id },
                { upsert: true }
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(client.embedColor)
                    .setDescription(`Auto-role for new members set to <@&${role.id}>`)]
            });
        }

        if (sub === 'toggle') {
            const status = interaction.options.getBoolean('status');

            await Schema.findOneAndUpdate(
                { guildID: guildId },
                { enabled: status },
                { upsert: true }
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(client.embedColor)
                    .setDescription(`Welcome system has been **${status ? 'enabled' : 'disabled'}**`)]
            });
        }
    }
};
