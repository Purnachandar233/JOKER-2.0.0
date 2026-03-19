const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "slowmo",
    category: "Filters",
    description: "Enables/disables the slowmo filter.",
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
        return await interaction.editReply({embeds: [noperms]});
    }
        //

        const settings = require('../../utils/settings');
        const filted = await settings.getFilter(interaction.guild.id, 'slowmo');
if(!filted) {
  await settings.setFilter(interaction.guild.id, 'slowmo', true);
  player.node.send({
    op: "filters",
    guildId: interaction.guild.id,
    equalizer: player.bands.map((gain, index) => {
      var Obj = {
        "band": 0,
        "gain": 0,
      };
      Obj.band = Number(index);
      Obj.gain = Number(gain)
      return Obj;
    }),
    timescale: {
      "speed": 0.5,
      "pitch": 1.0,
      "rate": 0.8
    },
  });
  player.set("filter", "⏱ Slowmode");
         const noperms = new EmbedBuilder()
    .setColor(interaction.client?.embedColor || '#ff0051')
         .setDescription(`${ok} Slowmode has been \`enabled\`. - <@!${interaction.member.id}>`)
         const noperms1 = new EmbedBuilder()
         .setColor(interaction.client?.embedColor || '#ff0051')
               .setDescription(`${ok} Applying the \`slowmo\` Filter (*It might take up to 5 seconds until you hear the Filter*)`)
         return  await interaction.editReply({embeds: [noperms1]}),
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
        }else{
          await settings.setFilter(interaction.guild.id, 'slowmo', false);
          player.clearEQ();
          player.node.send({
            op: "filters",
            guildId: interaction.guild.id,
            equalizer: player.bands.map((gain, index) => {
              var Obj = {
                "band": 0,
                "gain": 0,
              };
              Obj.band = Number(index);
              Obj.gain = Number(gain)
              return Obj;
            }),
          });
          player.set("eq", "💣 None");
          player.set("filter", "💣 None");
          const noperms = new EmbedBuilder()
     .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} Slowmode has been \`disabled\`. - <@!${interaction.member.id}>`)
          const noperms1 = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
                .setDescription(`${ok} Removing the \`slowmo\` Filter(*It might take up to 5 seconds to remove the filter.*)`)
          return  await interaction.editReply({embeds: [noperms1]}),
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
  }

