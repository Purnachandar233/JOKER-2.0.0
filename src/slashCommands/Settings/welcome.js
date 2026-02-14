const { EmbedBuilder, PermissionFlagsBits, ApplicationCommandOptionType } = require('discord.js');
const Schema = require('../../schema/welcome');
const { safeReply, safeDeferReply } = require('../../utils/safeReply');

module.exports = {
    name: 'welcome',
    description: 'Setup the professional welcome system for your server',
    userPermissions: ['Administrator'],
    options: [
        {
            name: 'setup',
            description: '📋 Setup the welcome channel and message',
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
                    description: 'Welcome message (use {user}, {server}, {count} for member count)',
                    type: ApplicationCommandOptionType.String,
                    required: false
                },
                {
                    name: 'color',
                    description: 'Embed color in hex (default: #ff0051)',
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        },
        {
            name: 'role',
            description: '🎁 Set auto-role for new members',
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
            name: 'view',
            description: '👁️ View current welcome settings',
            type: 1
        },
        {
            name: 'test',
            description: '✉️ Test the welcome system',
            type: 1
        },
        {
            name: 'toggle',
            description: '⚙️ Enable or disable the welcome system',
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
        const deferred = await safeDeferReply(interaction, { ephemeral: false });
        if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
        
        const sub = interaction.options.getSubcommand();
        const { guildId, guild } = interaction;

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const msg = interaction.options.getString('message') || `🎉 Welcome {user} to **{server}**!`;
            const color = interaction.options.getString('color') || client.embedColor;

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { channelID: channel.id, message: msg, enabled: true, embedColor: color },
                    { upsert: true }
                );

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(color)
                        .setTitle('✅ Welcome System Configured')
                        .addFields(
                            { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
                            { name: '🎨 Color', value: color, inline: true },
                            { name: '📝 Message', value: `\`${msg}\``, inline: false }
                        )
                        .setFooter({ text: 'Use /welcome test to see a preview' })]
                });
            } catch (err) {
                return interaction.editReply({ content: '❌ Failed to setup welcome system', ephemeral: true });
            }
        }

        if (sub === 'role') {
            const role = interaction.options.getRole('role');

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { roleID: role.id },
                    { upsert: true }
                );

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(client.embedColor)
                        .setTitle('✅ Auto-Role Configured')
                        .setDescription(`New members will automatically receive <@&${role.id}>`)]
                });
            } catch (err) {
                return interaction.editReply({ content: '❌ Failed to set auto-role', ephemeral: true });
            }
        }

        if (sub === 'view') {
            try {
                const data = await Schema.findOne({ guildID: guildId });

                if (!data) {
                    return interaction.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff6b6b')
                            .setTitle('❌ Welcome System Not Configured')
                            .setDescription('Use `/welcome setup` to configure the welcome system')]
                    });
                }

                const channel = guild.channels.cache.get(data.channelID);
                const role = guild.roles.cache.get(data.roleID);

                const embed = new EmbedBuilder()
                    .setColor(data.embedColor || client.embedColor)
                    .setTitle('📋 Welcome System Settings')
                    .addFields(
                        { name: '📍 Channel', value: channel ? `<#${channel.id}>` : 'Not set', inline: true },
                        { name: '🎁 Auto-Role', value: role ? `<@&${role.id}>` : 'Not set', inline: true },
                        { name: '⚙️ Status', value: data.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: '📝 Message', value: `\`${data.message || 'None'}\`` }
                    );

                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply({ content: '❌ Failed to retrieve settings', ephemeral: true });
            }
        }

        if (sub === 'test') {
            try {
                const data = await Schema.findOne({ guildID: guildId });

                if (!data || !data.channelID) {
                    return interaction.editReply({
                        content: '❌ Welcome system not configured. Use `/welcome setup` first',
                        ephemeral: true
                    });
                }

                const channel = guild.channels.cache.get(data.channelID);
                if (!channel) {
                    return interaction.editReply({
                        content: '❌ Welcome channel not found or was deleted',
                        ephemeral: true
                    });
                }

                const testMessage = data.message
                    .replace(/{user}/g, `<@${interaction.user.id}>`)
                    .replace(/{server}/g, guild.name)
                    .replace(/{count}/g, guild.memberCount);

                const testEmbed = new EmbedBuilder()
                    .setColor(data.embedColor || client.embedColor)
                    .setTitle('Welcome!')
                    .setDescription(testMessage)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Member #${guild.memberCount}` });

                await channel.send({ embeds: [testEmbed] });

                return interaction.editReply({
                    content: `✅ Test welcome message sent to <#${channel.id}>`,
                    ephemeral: true
                });
            } catch (err) {
                return interaction.editReply({ content: '❌ Failed to send test message', ephemeral: true });
            }
        }

        if (sub === 'toggle') {
            const status = interaction.options.getBoolean('status');

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { enabled: status },
                    { upsert: true }
                );

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(status ? '#51cf66' : '#ff6b6b')
                        .setTitle(status ? '✅ Welcome System Enabled' : '❌ Welcome System Disabled')
                        .setDescription(status ? 'New members will be welcomed!' : 'Welcome messages are disabled')]
                });
            } catch (err) {
                return interaction.editReply({ content: '❌ Failed to toggle welcome system', ephemeral: true });
            }
        }
    }
};
