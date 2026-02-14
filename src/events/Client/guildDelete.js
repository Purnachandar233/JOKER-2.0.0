const { EmbedBuilder, WebhookClient } = require('discord.js');
const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, guild) => {
    try {
        // CLEANUP: Destroy player and clear all guild-related data
        if (client.lavalink) {
            try {
                const player = client.lavalink.players.get(guild.id);
                if (player) {
                    await safePlayer.safeDestroy(player);
                    client.lavalink.players.delete(guild.id);
                    client.logger?.log?.(`Cleaned up player for deleted guild ${guild.id}`, 'info');
                }
            } catch (err) {
                client.logger?.log?.(`Error cleaning up player for guild ${guild.id}: ${err?.message}`, 'warn');
            }
        }

        // Clear any guild cache data
        try {
            // Clear guild-specific data from cache/database here if needed
            client.logger?.log?.(`Guild ${guild.id} cleaned up on delete`, 'info');
        } catch (err) {
            client.logger?.log?.(`Error clearing guild ${guild.id} cache: ${err?.message}`, 'warn');
        }
    } catch (e) {
        client.logger?.log?.(`guildDelete cleanup error for ${guild.id}: ${e?.message}`, 'error');
    }

    // Send webhook notification
    const url = process.env.GUILD_WEBHOOK_URL || client.config.webhooks?.guildLogs;
    if (!url) return;
    
    const web = new WebhookClient({ url });
    try {
        let servers = client.cluster ? await client.cluster.fetchClientValues('guilds.cache.size') : [client.guilds.cache.size];
        let totalServers = servers.reduce((prev, val) => prev + val, 0);
        
        let ownerInfo;
        try {
            ownerInfo = await guild.fetchOwner();
        } catch (err) {
            ownerInfo = { user: { tag: 'Unknown' }, id: guild?.ownerId || 'Unknown' };
            client.logger?.log?.(`Failed to fetch owner for guild ${guild.id}: ${err?.message}`, 'warn');
        }

        const embed = new EmbedBuilder()
            .setTitle("📤 Left Server")
            .setColor(client?.embedColor || '#ff0051')
            .addFields(
                { name: "Server Name", value: String(guild.name || 'Unknown'), inline: true },
                { name: "ID", value: String(guild.id || 'Unknown'), inline: true },
                { name: "Owner", value: `Tag - \`${ownerInfo.user?.tag || 'Unknown'}\`\nID - \`${ownerInfo.id || 'Unknown'}\``, inline: true },
                { name: "Members", value: `\`${guild.memberCount || 0}\` `, inline: true }
            )
            .setFooter({ text: `Bot - ${client.user.username} TS - ${totalServers}` })
        
        web.send({ embeds: [embed] }).catch(err => {
            client.logger?.log?.(`Failed to send guildDelete webhook for ${guild.id}: ${err?.message}`, 'warn');
        });
    } catch (e) { 
        client.logger?.log?.(`guildDelete handler error for ${guild.id}: ${e?.message}`, 'error');
    }
}