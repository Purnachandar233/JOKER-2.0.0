const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")

module.exports = {
    name: "ping",
    description: "return websocket ping",
    wl : true,

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
        await interaction.deferReply({
            ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
                const msg = await interaction.editReply({ content: `Pinging..`}).catch(() => {});
                if (!msg) return;
                const embed = new EmbedBuilder()
              .setDescription(`\`\`\`fix\nWebsocket Latency : ${Math.floor(msg.createdAt - interaction.createdAt)}ms\nAPI Latency : ${client.ws.ping}ms\`\`\``)
              .setColor(0xff0051)
              msg.edit({ content: "⠀", embeds : [embed]}).catch(() => {});
    } 
}