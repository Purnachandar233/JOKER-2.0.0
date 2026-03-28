const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "slowmo",
  category: "Filters",
  description: "Enables/disables the slowmo filter.",
  votelock: true,
  djonly: true,
  wl: true,
  run: async (client, interaction) => {
    await interaction.deferReply({});

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const color = interaction.client?.embedColor || '#ff0051';
    const { channel } = interaction.member.voice;

    if (!channel) {
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} You must be connected to a voice channel to use this command.`)] });
    }

    if (interaction.member.voice.selfDeaf) {
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)] });
    }

    const player = client.lavalink.players.get(interaction.guild.id);
    const tracks = client.core.queue.getQueueArray(player);
    if (!player || !tracks.length) {
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} There is nothing playing in this server.`)] });
    }

    if (channel.id !== player.voiceChannelId) {
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} You must be connected to the same voice channel as me.`)] });
    }

    const filterCore = client.core.filters;
    const enabled = await client.core.filterSettings.getFilter(interaction.guild.id, 'slowmo');

    if (!enabled) {
      const applied = filterCore.sendRawFilters(player, interaction.guild.id, {
        timescale: {
          speed: 0.5,
          pitch: 1.0,
          rate: 0.8,
        },
      });

      if (!applied) {
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} This Lavalink player does not support raw audio filters right now.`)] });
      }

      await client.core.filterSettings.setFilter(interaction.guild.id, 'slowmo', true);
      player.set("filter", "Slowmode");

      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} Slowmode has been \`enabled\`. - <@!${interaction.member.id}>`)]
      });
    }

    await client.core.filterSettings.setFilter(interaction.guild.id, 'slowmo', false);
    await filterCore.resetPlayerFilters(player, interaction.guild.id);
    player.set("eq", "None");
    player.set("filter", "None");

    return await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} Slowmode has been \`disabled\`. - <@!${interaction.member.id}>`)]
    });
  }
};
