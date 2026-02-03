const { EmbedBuilder, WebhookClient } = require('discord.js');
module.exports = async (client, guild) => {
   
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
            client.logger?.log && client.logger.log(`Failed to fetch owner for guild ${guild.id}: ${err && (err.stack || err.message || err)}`, 'warn');
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
            client.logger?.log && client.logger.log(`Failed to send guildDelete webhook for ${guild.id}: ${err && (err.stack || err.message || err)}`, 'error');
        });
    } catch (e) { 
        client.logger?.log && client.logger.log(`guildDelete handler error for ${guild.id}: ${e && (e.stack || e.message || e)}`, 'error');
    }
}