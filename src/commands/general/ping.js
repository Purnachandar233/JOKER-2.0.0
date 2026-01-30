const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "ping",
  category: "general",
  description: "Check Ping Bot",
  args: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const embed = new EmbedBuilder()
      .setDescription('*Measuring the pulse...*')
      .setColor(0xff0051);
    
    const msg = await message.channel.send({ embeds: [embed] }).catch(() => {});
    if (!msg) return;

    const timestamp = (message.editedTimestamp) ? message.editedTimestamp : message.createdTimestamp;
    const latency = `${Math.floor(msg.createdTimestamp - timestamp)}ms`;
    const apiLatency = `${client.ws.ping}ms`;
    
    embed.setTitle('Connection Pulse')
      .setDescription(`\`\`\`fix\nWebsocket Latency : ${latency}\nAPI Latency : ${apiLatency}\n\`\`\``)
      .setAuthor({ name: `Ping Status`, iconURL: client.user.displayAvatarURL() })
      .setColor(0xff0051)
      .setFooter({ text: "Joker Music" });
    
    msg.edit({ embeds: [embed] }).catch(() => {});
  }
}
