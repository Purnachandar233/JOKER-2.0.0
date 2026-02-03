const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, InteractionType } = require("discord.js");
const { queuepaginationEmbed } = require('../../utils/pagination.js');
const blacklist = require("../../schema/blacklistSchema.js");
const Premium = require("../../schema/Premium.js");
let chunk = require('chunk');
const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, interaction) => {
    const ownerids = [client.config.ownerId];
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    if (interaction.type === InteractionType.ApplicationCommand) {
        const SlashCommands = client.sls.get(interaction.commandName);
        if (!SlashCommands) return;

        // Commands handle deferring/replying themselves to avoid double-reply errors.

        if (SlashCommands.djonly) {
            const djSchema = require('../../schema/djroleSchema');
            try {
                let djdata = await djSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
                if (djdata && djdata.Roleid) {
                    if (!interaction.member.roles.cache.has(djdata.Roleid)) {
                        const embed = new EmbedBuilder()
                            .setColor(client?.embedColor || '#ff0051')
                            .setDescription(`<@${interaction.member.id}> This command requires you to have the DJ role.`);
                        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    }
                } else {
                    // No DJ role configured, only allow owner
                    if (!ownerids.includes(interaction.user.id)) {
                        const embed = new EmbedBuilder()
                            .setColor(client?.embedColor || '#ff0051')
                            .setDescription(`<@${interaction.member.id}> No DJ role configured. Contact server owner.`);
                        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    }
                }
            } catch (err) {
                client.logger?.log(`DJ role check error: ${err.message}`, 'error');
                const embed = new EmbedBuilder()
                    .setColor(client?.embedColor || '#ff0051')
                    .setDescription(`Error checking DJ permissions. Please try again.`);
                return await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }
        }

        if (SlashCommands.wl) {
            const nooo = await blacklist.findOne({ UserID: interaction.member.id });
            if (nooo && !ownerids.includes(interaction.member.id)) {
                const embed = new EmbedBuilder()
                    .setColor(client?.embedColor || '#ff0051')
                    .setDescription(`<@${interaction.member.id}> You are blacklisted from using the bot!`);
                return await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }
        }

        if (SlashCommands.owneronly && !ownerids.includes(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setColor(client?.embedColor || '#ff0051')
                .setDescription(`✧ This command is restricted to the **Bot Owner** only.`);
            return await interaction.editReply({ embeds: [embed] }).catch(() => {});
        }

        const isVoted = client.topgg && typeof client.topgg.hasVoted === 'function' ? 
            await client.topgg.hasVoted(interaction.user.id).catch((err) => {
                // Suppress Top.gg warnings for unauthorized (e.g., unverified bot token)
                if (err && (err.statusCode === 401 || (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))))) {
                    return false;
                }
                client.logger?.log(`Top.gg vote check error: ${err && err.message ? err.message : String(err)}`, 'warn');
                return false;
            }) : false;

        if (SlashCommands.premium) {
            const pUser = await Premium.findOne({ Id: interaction.user.id, Type: 'user' });
            const pGuild = await Premium.findOne({ Id: interaction.guild.id, Type: 'guild' });

            // Check if user premium is valid
            const isUserPremium = pUser && (pUser.Permanent || pUser.Expire > Date.now());
            // Check if guild premium is valid
            const isGuildPremium = pGuild && (pGuild.Permanent || pGuild.Expire > Date.now());
            
            // Clean up expired premium if found
            if (pUser && !pUser.Permanent && pUser.Expire <= Date.now()) {
                await pUser.deleteOne();
            }
            if (pGuild && !pGuild.Permanent && pGuild.Expire <= Date.now()) {
                await pGuild.deleteOne();
            }

            if (!isUserPremium && !isGuildPremium && !isVoted) {
                const embed = new EmbedBuilder()
                    .setColor(client?.embedColor || '#ff0051')
                    .setAuthor({ name: "Premium Required", iconURL: client.user.displayAvatarURL() })
                    .setDescription(`✧ This command requires a [Premium Subscription](https://discord.gg/JQzBqgmwFm) or a [Vote](https://top.gg/bot/${client.user.id}/vote) on Top.gg.`);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel("Vote Me").setStyle(5).setURL(`https://top.gg/bot/${client.user.id}/vote`),
                    new ButtonBuilder().setLabel("Get Premium").setStyle(5).setURL(`https://discord.gg/JQzBqgmwFm`)
                );

                return await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
            }
        }

        try {
            await SlashCommands.run(client, interaction);
        } catch (error) {
            // Log error with detailed context
            const { logError } = require('../../utils/errorHandler');
            await logError(client, error, {
                source: 'SlashCommand',
                command: interaction.commandName,
                user: interaction.user?.id,
                guild: interaction.guild?.id,
                channel: interaction.channel?.id
            });

            const errorMsg = error?.message || error?.toString() || 'An unknown error occurred';
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: `❌ Error: ${errorMsg}` }).catch(() => {});
                } else {
                    await interaction.reply({ content: `❌ Error: ${errorMsg}`, flags: [64] }).catch(() => {});
                }
            } catch (replyErr) {
                // Avoid logging InteractionAlreadyReplied as it's expected in some cases
                if (!replyErr.message?.includes('InteractionAlreadyReplied')) {
                    client.logger?.log(`Failed to reply error: ${replyErr.message}`, 'error');
                }
            }
        }
    }

    if (interaction.customId === 'evaldelete') {
        if (!ownerids.includes(interaction.user.id)) return;
        return interaction.message.delete().catch(() => {});
    }

    if (interaction.type === InteractionType.MessageComponent) {
        const player = client.lavalink.players.get(interaction.guild.id);
        if (!player) return interaction.reply({ content: `${no} No player found.`, flags: [64] });

        const { channel } = interaction.member.voice;
        if (!channel) return interaction.reply({ content: `${no} You must be in a voice channel.`, flags: [64] });
        if (player && channel.id !== player.voiceChannelId) return interaction.reply({ content: `${no} You must be in the same voice channel as me.`, flags: [64] });
        if (interaction.member.voice.selfDeaf) return interaction.reply({ content: `${no} You cannot use this while deafened.`, flags: [64] });

        switch (interaction.customId) {
            case 'prtrack':
                try {
                    try {
                        const { getQueueArray } = require('../../utils/queue.js');
                        const qi = (getQueueArray(player) || []).length;
                        // prtrack pressed (diagnostics suppressed)
                    } catch (e) {
                        // prtrack pressed (diagnostics suppressed)
                    }

                    const isPaused = !!player.paused;
                    const sleep = ms => new Promise(r => setTimeout(r, ms));

                    // Try to pause or resume using conservative methods.
                    if (!isPaused) {
                        // Attempt to pause
                        let ok = await safePlayer.safeCall(player, 'pause');
                        if (ok === false) {
                            // retry once
                            await sleep(200);
                            ok = await safePlayer.safeCall(player, 'pause');
                        }
                        await sleep(200);
                    } else {
                        // Attempt to resume: prefer `play()` then fallback to `pause(false)`
                        let ok = await safePlayer.safeCall(player, 'play');
                        if (ok === false) {
                            // try pause(false) which some implementations accept
                            await sleep(200);
                            ok = await safePlayer.safeCall(player, 'pause', false);
                        }
                        if (ok === false) {
                            // last resort: call play() again
                            await sleep(200);
                            await safePlayer.safeCall(player, 'play');
                        }
                        await sleep(250);
                    }

                    // Verify final state
                    const finalPaused = !!player.paused;
                    // compute queue diagnostics via getQueueArray when available
                    let queueItems = 'n/a';
                    try {
                        const { getQueueArray } = require('../../utils/queue.js');
                        const arr = getQueueArray(player) || [];
                        queueItems = arr.length;
                    } catch (e) {}

                    // prtrack result (diagnostics suppressed)

                    if (isPaused !== finalPaused) {
                        interaction.reply({ content: finalPaused ? `${ok} Paused the player.` : `${ok} Resumed the player.`, flags: [64] });
                    } else {
                        interaction.reply({ content: `${no} Requested toggle sent but the player state did not change yet. It may be delayed.`, flags: [64] });
                    }
                } catch (e) {
                    client.logger?.log(`Pause/Resume error: ${e && (e.stack || e.toString())}`, 'error');
                    interaction.reply({ content: `${no} Failed to toggle pause.`, flags: [64] });
                }
                break;
            case 'skiptrack':
                try {
                    // Defensively compute whether there are upcoming tracks using multiple possible shapes
                    const { getQueueArray } = require('../../utils/queue.js');
                                        const upcomingArr = getQueueArray(player) || [];
                                            const reportedSize = safePlayer.queueSize(player);
                                            // getQueueArray returns an array where index 0 is the current track.
                                            // upcomingCount should represent tracks AFTER the current one.
                                            const upcomingCount = Math.max(0, (upcomingArr.length > 0 ? upcomingArr.length - 1 : 0), (reportedSize > 0 ? reportedSize - 1 : 0));

                    // Debug log queue diagnostics
                    try {
                        const preview = upcomingArr.slice(0, 5).map(t => ({ title: t?.info?.title || t?.title || 'Unknown', uri: t?.info?.uri || t?.uri || '' }));
                        // SkipHandler diagnostics suppressed
                    } catch (e) { try { client.logger?.log('SkipHandler log failure: ' + (e && (e.stack || e.toString())), 'warn'); } catch (err) { console.log('SkipHandler log failure', e); } }

                    if (upcomingCount > 0) {
                        // Advance to next track
                        try {
                            await safePlayer.safeStop(player);
                        } catch (e) {
                            try { await safePlayer.safeStop(player); } catch (_) {}
                        }
                        return interaction.reply({ content: `${ok} Skipped to the next track.`, flags: [64] });
                    }

                    // No upcoming tracks — do not destroy the player, just inform the user.
                    const twentyfourseven = require('../../schema/twentyfourseven.js');
                    const is247Enabled = await twentyfourseven.findOne({ guildID: interaction.guild.id });
                    if (is247Enabled) {
                        return interaction.reply({ content: `${no} No songs in queue, add more to skip.`, flags: [64] });
                    }

                    return interaction.reply({ content: `${no} There are no more tracks to skip.`, flags: [64] });
                } catch (error) {
                    client.logger?.log(`Skip error: ${error?.message || error}`, 'error');
                    return interaction.reply({ content: `${no} Failed to skip track.`, flags: [64] });
                }
                break;
            case 'looptrack':
                try {
                    const currentMode = player.repeatMode || 'off';
                    if (currentMode === 'track') {
                        player.setRepeatMode('off');
                        interaction.reply({ content: `${ok} Loop disabled.`, flags: [64] });
                    } else {
                        player.setRepeatMode('track');
                        interaction.reply({ content: `${ok} Looping current track.`, flags: [64] });
                    }
                } catch (error) {
                    client.logger?.log(`Loop toggle error: ${error.message}`, 'error');
                    interaction.reply({ content: `${no} Failed to toggle loop.`, flags: [64] });
                }
                break;
            case 'showqueue':
                try {
                    const { getQueueArray } = require('../../utils/queue.js');
                    const qi = (getQueueArray(player) || []).length;
                    // showqueue pressed (diagnostics suppressed)
                } catch (e) {
                    // showqueue pressed (diagnostics suppressed)
                }
                if (safePlayer.queueSize(player) === 0) {
                    interaction.reply({ content: `${no} Queue is empty.`, flags: [64] });
                } else {
                    try {
                        const { getQueueArray } = require('../../utils/queue.js');
                        const tracks = getQueueArray(player) || [];
                        const current = tracks[0] || null;
                        const upcoming = tracks.slice(1);

                        const queue = upcoming.map((track, i) => {
                            const title = track.info?.title?.substring(0, 30) || track.title?.substring(0, 30) || 'Unknown Title';
                            const duration = track.info?.duration || track.duration;
                            const isStream = track.info?.isStream || track.isStream;
                            const durationStr = isStream ? 'LIVE' : (duration ? new Date(duration).toISOString().slice(14, 19) : 'Unknown');
                            return `**${i+1}.** ${title}... \`[${durationStr}]\``;
                        });

                        const chunked = chunk(queue, 10);
                        const embeds = [];

                        if (chunked.length === 0) {
                            const nowTitle = current?.info?.title || current?.title || "No current track";
                            embeds.push(new EmbedBuilder()
                                .setColor(client?.embedColor || '#ff0051')
                                .setTitle(`Current Queue`)
                                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                                .setDescription(`**Now Playing**\n┕ ${nowTitle}\n\n**Upcoming Tracks**\n*No more tracks in line.*`)
                                .setFooter({ text: `Classic Page 1/1 • Joker Music` }));
                        } else {
                            for (let i = 0; i < chunked.length; i++) {
                                const nowTitle = current?.info?.title || current?.title || "No current track";
                                embeds.push(new EmbedBuilder()
                                    .setColor(client?.embedColor || '#ff0051')
                                    .setTitle(`Current Queue`)
                                    .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                                    .setDescription(`**Now Playing**\n┕ ${nowTitle}\n\n**Upcoming Tracks**\n${chunked[i].join('\n') || "*No more tracks in line.*"}`)
                                    .setFooter({ text: `Classic Page ${i + 1}/${chunked.length} • Joker Music` }));
                            }
                        }

                        if (embeds.length === 1) {
                            interaction.reply({ embeds: [embeds[0]], flags: [64] });
                        } else {
                            const buttonList = [
                                new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(2),
                                new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2),
                                new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2),
                                new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(2)
                            ];
                            queuepaginationEmbed(interaction, embeds, buttonList, interaction.member.user, 30000);
                        }
                    } catch (error) {
                        client.logger?.log(`Queue display error: ${error.message}`, 'error');
                        interaction.reply({ content: `${no} Failed to display queue.`, flags: [64] });
                    }
                }
                break;
            case 'stop':
                try {
                    const autoplay = player.get("autoplay")
                    if (autoplay === true) {
                        player.set("autoplay", false);
                    }

                    player.set("stopped", true);
                    try {
                        await safePlayer.safeStop(player);
                    } catch (e) {
                        client.logger?.log(`Stop action error: ${e && (e.stack || e.toString())}`, 'error');
                        try { await safePlayer.safeDestroy(player); } catch (_) {}
                    }

                    try { await safePlayer.queueClear(player); } catch (e) {}

                    interaction.reply({ content: `${ok} Stopped the player and cleared the queue.`, flags: [64] });
                } catch (error) {
                    client.logger?.log(`Stop error: ${error.message}`, 'error');
                    interaction.reply({ content: `${no} Failed to stop the player.`, flags: [64] });
                }
                break;
        }
    }
};