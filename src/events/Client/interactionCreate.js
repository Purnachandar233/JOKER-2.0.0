const { EmbedBuilder, CommandInteraction, Client, ButtonBuilder, ActionRowBuilder, InteractionType } = require("discord.js");
const { queuepaginationEmbed } = require('../../utils/pagination.js');
const blacklist = require("../../schema/blacklistSchema.js");
const { convertTime } = require('../../utils/convert.js');
const Premium = require("../../schema/Premium.js");
let chunk = require('chunk');

module.exports = async (client, interaction) => {
    const ownerids = [client.config.ownerId];
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    if (interaction.type === InteractionType.ApplicationCommand) {
        const SlashCommands = client.sls.get(interaction.commandName);
        if (!SlashCommands) return;

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: [64] }).catch(() => {});
        }

        if (SlashCommands.djonly) {
            const djSchema = require('../../schema/djroleSchema');
            try {
                let djdata = await djSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
                if (djdata && djdata.Roleid) {
                    if (!interaction.member.roles.cache.has(djdata.Roleid)) {
                        const embed = new EmbedBuilder()
                            .setColor(0xff0051)
                            .setDescription(`<@${interaction.member.id}> This command requires you to have the DJ role.`);
                        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    }
                } else {
                    // No DJ role configured, only allow owner
                    if (!ownerids.includes(interaction.user.id)) {
                        const embed = new EmbedBuilder()
                            .setColor(0xff0051)
                            .setDescription(`<@${interaction.member.id}> No DJ role configured. Contact server owner.`);
                        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    }
                }
            } catch (err) {
                client.logger?.log(`DJ role check error: ${err.message}`, 'error');
                const embed = new EmbedBuilder()
                    .setColor(0xff0051)
                    .setDescription(`Error checking DJ permissions. Please try again.`);
                return await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }
        }

        if (SlashCommands.wl) {
            const nooo = await blacklist.findOne({ UserID: interaction.member.id });
            if (nooo && !ownerids.includes(interaction.member.id)) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0051)
                    .setDescription(`<@${interaction.member.id}> You are blacklisted from using the bot!`);
                return await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }
        }

        if (SlashCommands.owneronly && !ownerids.includes(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setColor(0x2f3136)
                .setDescription(`✧ This command is restricted to the **Bot Owner** only.`);
            return await interaction.editReply({ embeds: [embed] }).catch(() => {});
        }

        const isVoted = client.topgg && typeof client.topgg.hasVoted === 'function' ? 
            await client.topgg.hasVoted(interaction.user.id).catch((err) => {
                client.logger?.log(`Top.gg vote check error: ${err.message}`, 'warn');
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
                    .setColor(0x2f3136)
                    .setAuthor({ name: "Premium Required", iconURL: client.user.displayAvatarURL() })
                    .setDescription(`✧ This command requires a **Premium Subscription** or a **Vote** on Top.gg.`);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel("Vote Me").setStyle(5).setURL(`https://top.gg/bot/${client.user.id}/vote`),
                    new ButtonBuilder().setLabel("Get Premium").setStyle(5).setURL(`https://www.patreon.com/alexmusicbot/membership`)
                );

                return await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
            }
        }

        try {
            await SlashCommands.run(client, interaction);
        } catch (error) {
            client.logger?.log(error, "error");
            const errorMsg = error?.message || 'An unknown error occurred';
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: `❌ Error: ${errorMsg}` }).catch(() => {});
                } else {
                    await interaction.reply({ content: `❌ Error: ${errorMsg}`, flags: [64] }).catch(() => {});
                }
            } catch (replyErr) {
                client.logger?.log(`Failed to reply error: ${replyErr.message}`, 'error');
            }
        }
    }

    if (interaction.customId === 'evaldelete') {
        if (!ownerids.includes(interaction.user.id)) return;
        return interaction.message.delete().catch(() => {});
    }
};