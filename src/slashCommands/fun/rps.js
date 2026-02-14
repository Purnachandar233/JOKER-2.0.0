const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/games/rps.js');
const { safeReply } = require('../../utils/safeReply');

module.exports = {
  name: 'rps',
  description: legacy.description || 'Converted slash for rps',
  options: [ { name: 'args', description: 'Arguments (space separated)', required: false, type: 3 } ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const argstr = interaction.options.getString('args') || '';
    const args = argstr.length ? argstr.trim().split(/ +/) : [];

    const replyFunc = async (payload) => {
      try {
        return await safeReply(interaction, typeof payload === 'string' ? { content: payload } : payload);
      } catch (e) { return null; }
    };

    const message = {
      member: interaction.member,
      author: interaction.user,
      guild: interaction.guild,
      channel: {
        send: (p) => replyFunc(typeof p === 'string' ? { content: p } : p),
      },
      reply: (p) => replyFunc(typeof p === 'string' ? { content: p } : p),
    };

    try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(message, args, client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash rps error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
