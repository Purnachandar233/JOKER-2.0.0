const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

const FILTER_FLAGS = [
  'eightD',
  'bassboost',
  'nightcore',
  'soft',
  'pop',
  'treblebass',
  'vaporwave',
  'karaoke',
  'vibrato',
  'tremolo',
  'chipmunk',
  'slowmo',
];

module.exports = {
  name: "reset",
  category: "Filters",
  description: "Resets all the filters enabled.",
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

    for (const key of FILTER_FLAGS) {
      player[key] = false;
    }

    await client.core.filterSettings.setFilter(interaction.guild.id, 'chipmunk', false);
    await client.core.filterSettings.setFilter(interaction.guild.id, 'slowmo', false);
    await client.core.filters.resetPlayerFilters(player, interaction.guild.id);
    player.set("eq", "None");
    player.set("filter", "None");

    return await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} All filters have been reset. - <@!${interaction.member.id}>`)]
    });
  }
};
