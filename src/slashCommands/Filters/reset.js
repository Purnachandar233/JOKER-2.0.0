const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "reset",
    category: "Filters",
    description: "Resets all the filters enabled.",
    votelock: true,
    djonly : true,
    wl : true,
   /**
   *
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */

    run: async (client, interaction) => {
      await interaction.deferReply({
        });

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;



       //
       const { channel } = interaction.member.voice;
       if (!channel) {
                       const noperms = new EmbedBuilder()

            .setColor(interaction.client?.embedColor || '#ff0051')
              .setDescription(`${no} You must be connected to a voice channel to use this command.`)
           return await interaction.editReply({embeds: [noperms]});
       }
       if(interaction.member.voice.selfDeaf) {
         let thing = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
          return await interaction.editReply({embeds: [thing]});
        }
              const player = client.lavalink.players.get(interaction.guild.id);
            const { getQueueArray } = require('../../utils/queue.js');
            const tracks = getQueueArray(player);
            if(!player || !tracks || tracks.length === 0) {
                       const noperms = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} There is nothing playing in this server.`)
           return await interaction.editReply({embeds: [noperms]});
       }
       if(player && channel.id !== player.voiceChannelId) {
                                   const noperms = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to the same voice channel as me.`)
           return await interaction.editReply({embeds: [noperms]}),
           interaction.channel.send({embeds: [noperms]});
       }
           //
    player.reset();
                   const noperms = new EmbedBuilder()
              .setColor(interaction.client?.embedColor || '#ff0051')
                   .setDescription(`${ok} All filters has been reseted. - <@!${interaction.member.id}>`)
                   const noperms1 = new EmbedBuilder()
                   .setColor(interaction.client?.embedColor || '#ff0051')
                         .setDescription(`${ok} Resetting all filters...(*It might take up to 5 seconds to reset the filters.*)`)
      return await interaction.editReply({embeds: [noperms1]}),
      interaction.channel.send({embeds: [noperms]}).then(responce => {
        setTimeout(() => {
            try {
                responce.delete().catch(() => {
                    return
                })
            } catch(err) {
                return
            }
        }, 30000)
    });;




    }
  }

