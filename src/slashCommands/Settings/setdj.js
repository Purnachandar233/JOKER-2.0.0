const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/settings/setdj.js');
const { safeReply, safeDeferReply } = require('../../utils/safeReply');

module.exports = {
  name: 'setdj',
  description: legacy.description || 'Converted slash for setdj',
  options: [ { name: 'args', description: 'Arguments (space separated)', required: false, type: 3 } ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
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
      client.logger?.log('Converted slash setdj error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
