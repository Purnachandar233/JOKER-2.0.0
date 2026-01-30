const { EmbedBuilder, WebhookClient } = require('discord.js');
module.exports = async (client, guild) => {
    const url = client.config.webhooks.guildLogs;
    if (!url) return;
    const web = new WebhookClient({ url: url });
    try {
      let servers = client.cluster ? await client.cluster.fetchClientValues('guilds.cache.size') : [client.guilds.cache.size];
      let totalServers = servers.reduce((prev, val) => prev + val, 0);
   
        const owner = await guild.fetchOwner()
        const embed = new EmbedBuilder()           
        .setTitle(" Joined Server")
       .setColor(0xff0051)
        .addFields(
            { name: "Server Name", value: guild.name, inline: true },
            { name: "ID", value: guild.id, inline: true },
            { name: "Owner", value: `Tag - \`${owner.user.tag}\`\nID - \`${owner.id}\``, inline: true },
            { name: "Members", value: `\`${guild.memberCount}\` `, inline: true }
        )
        .setFooter({ text: `Bot - ${client.user.username} TS - ${totalServers}` })
    web.send({embeds: [embed]}).catch(() => {});
  } catch (e) { }
}