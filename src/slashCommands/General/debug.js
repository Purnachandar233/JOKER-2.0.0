const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")

module.exports = {
    name: "debug",
    description: "debug node info",
    wl : true,

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
                await interaction.deferReply();
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
        let state;
        try{
            state = client.lavalink.players.get(interaction.guild.id).state
        } catch(e){
            state = 'NOT_CONNECTED'
        }
         const embed = new EmbedBuilder()
         .setTitle("Debug")
         .addFields([
            { name: "Server Id", value: `\`\`\`js\n${interaction.guild.id}\`\`\``, inline: true },
            { name: "Cluster Id", value: `\`\`\`js\n${interaction.guild.shard.id*1+1 }\`\`\``, inline: true },
            { name: "Shard Id", value: `\`\`\`js\n${interaction.guild.shard.id*1+1 }\`\`\``, inline: true },
            { name: "Guild Player state", value: `\`\`\`js\n${state}\`\`\``, inline: true },
            { name: "Players", value: `\`\`\`js\n${client.lavalink.nodeManager.nodes.values().next().value.stats.playingPlayers}/${client.lavalink.nodeManager.nodes.values().next().value.stats.players}\`\`\``, inline: true }
         ])
             .setColor(interaction.client?.embedColor || '#ff0051')
        await interaction.followUp({embeds: [embed]})
    }
}
