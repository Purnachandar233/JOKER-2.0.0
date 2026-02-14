const { EmbedBuilder } = require('discord.js');
const Schema = require('../../schema/welcome');

module.exports = {
    name: 'welcome',
    category: 'settings',
    aliases: ['welcomeset', 'welcomeconfig'],
    description: 'Setup the professional welcome system for your server',
    userPermissions: ['Administrator'],
    execute: async (message, args, client, prefix) => {
        const sub = args[0];
        const { guildId, guild, author } = message;

        if (!sub) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(client.embedColor)
                    .setTitle('📋 Welcome System - Commands')
                    .addFields(
                        { name: '📍 Setup Channel', value: `\`${prefix}welcome setup <channel> [message] [color]\`` },
                        { name: '🎁 Auto-Role', value: `\`${prefix}welcome role <@role>\`` },
                        { name: '👁️ View Settings', value: `\`${prefix}welcome view\`` },
                        { name: '✉️ Test System', value: `\`${prefix}welcome test\`` },
                        { name: '⚙️ Toggle', value: `\`${prefix}welcome toggle <on/off>\`` }
                    )
                    .setDescription('**Variables for message:**\n`{user}` - Mention user\n`{server}` - Server name\n`{count}` - Member count')
                    .setFooter({ text: 'Example: ' + prefix + 'welcome setup #welcome Welcome {user} to {server}!' })]
            });
        }

        if (sub.toLowerCase() === 'setup') {
            const channel = message.mentions.channels.first();
            const messageContent = args.slice(2).join(' ');
            const customMsg = messageContent || `🎉 Welcome {user} to **{server}**!`;
            const color = client.embedColor;

            if (!channel) {
                return message.reply('❌ Please mention a valid channel! Usage: `' + prefix + 'welcome setup <#channel> [message]`');
            }

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { channelID: channel.id, message: customMsg, enabled: true, embedColor: color },
                    { upsert: true }
                );

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(color)
                        .setTitle('✅ Welcome System Configured')
                        .addFields(
                            { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
                            { name: '🎨 Color', value: color, inline: true },
                            { name: '📝 Message', value: `\`${customMsg}\``, inline: false }
                        )
                        .setFooter({ text: 'Use ' + prefix + 'welcome test to see a preview' })]
                });
            } catch (err) {
                return message.reply('❌ Failed to setup welcome system');
            }
        }

        if (sub.toLowerCase() === 'role') {
            const role = message.mentions.roles.first();

            if (!role) {
                return message.reply('❌ Please mention a valid role! Usage: `' + prefix + 'welcome role <@role>`');
            }

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { roleID: role.id },
                    { upsert: true }
                );

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(client.embedColor)
                        .setTitle('✅ Auto-Role Configured')
                        .setDescription(`New members will automatically receive <@&${role.id}>`)]
                });
            } catch (err) {
                return message.reply('❌ Failed to set auto-role');
            }
        }

        if (sub.toLowerCase() === 'view') {
            try {
                const data = await Schema.findOne({ guildID: guildId });

                if (!data) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff6b6b')
                            .setTitle('❌ Welcome System Not Configured')
                            .setDescription('Use `' + prefix + 'welcome setup` to configure the welcome system')]
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

                return message.reply({ embeds: [embed] });
            } catch (err) {
                return message.reply('❌ Failed to retrieve settings');
            }
        }

        if (sub.toLowerCase() === 'test') {
            try {
                const data = await Schema.findOne({ guildID: guildId });

                if (!data || !data.channelID) {
                    return message.reply({
                        content: '❌ Welcome system not configured. Use `' + prefix + 'welcome setup` first'
                    });
                }

                const channel = guild.channels.cache.get(data.channelID);
                if (!channel) {
                    return message.reply('❌ Welcome channel not found or was deleted');
                }

                const testMessage = data.message
                    .replace(/{user}/g, `<@${author.id}>`)
                    .replace(/{server}/g, guild.name)
                    .replace(/{count}/g, guild.memberCount);

                const testEmbed = new EmbedBuilder()
                    .setColor(data.embedColor || client.embedColor)
                    .setTitle('Welcome!')
                    .setDescription(testMessage)
                    .setThumbnail(author.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Member #${guild.memberCount}` });

                await channel.send({ embeds: [testEmbed] });

                return message.reply('✅ Test welcome message sent to <#' + channel.id + '>');
            } catch (err) {
                return message.reply('❌ Failed to send test message');
            }
        }

        if (sub.toLowerCase() === 'toggle') {
            const status = args[1]?.toLowerCase();

            if (!status || (status !== 'on' && status !== 'off' && status !== 'true' && status !== 'false')) {
                return message.reply('❌ Please specify `on` or `off`. Usage: `' + prefix + 'welcome toggle <on/off>`');
            }

            const enabled = status === 'on' || status === 'true';

            try {
                await Schema.findOneAndUpdate(
                    { guildID: guildId },
                    { enabled },
                    { upsert: true }
                );

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(enabled ? '#51cf66' : '#ff6b6b')
                        .setTitle(enabled ? '✅ Welcome System Enabled' : '❌ Welcome System Disabled')
                        .setDescription(enabled ? 'New members will be welcomed!' : 'Welcome messages are disabled')]
                });
            } catch (err) {
                return message.reply('❌ Failed to toggle welcome system');
            }
        }

        message.reply('❌ Invalid command! Use `' + prefix + 'welcome` for help');
    }
};
