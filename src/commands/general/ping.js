const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "ping",
  category: "general",
  description: "Check Ping Bot",
  args: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const embed = new EmbedBuilder()
      .setDescription('*Measuring the ping...*')
      .setColor(message.client?.embedColor || '#ff0051');
    
    const msg = await message.channel.send({ embeds: [embed] }).catch(() => {});
    if (!msg) return;

    const timestamp = (message.editedTimestamp) ? message.editedTimestamp : message.createdTimestamp;
    const latency = `${Math.floor(msg.createdTimestamp - timestamp)}ms`;
    const apiLatency = `${client.ws.ping}ms`;
    
    embed.setDescription(`\`\`\`fix\nWebsocket Latency : ${latency}\nAPI Latency : ${apiLatency}\n\`\`\``)
      .setAuthor({ name: `Ping Status`, iconURL: client.user.displayAvatarURL() })
      .setColor(message.client?.embedColor || '#ff0051')
    
    msg.edit({ embeds: [embed] }).catch(() => {});
  }
}
