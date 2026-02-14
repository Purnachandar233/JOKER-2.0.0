const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/kiss.js');
const { safeReply } = require('../../utils/safeReply');

module.exports = {
  name: 'kiss',
  description: legacy.description || 'Give someone a sweet kiss!',
  options: [ { name: 'user', description: 'User to kiss', required: true, type: 9 } ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const user = interaction.options.getUser('user');
    const args = [user.id];

    const replyFunc = async (payload) => {
      try {
        return await safeReply(interaction, typeof payload === 'string' ? { content: payload } : payload);
      } catch (e) { return null; }
    };

    const message = {
      member: interaction.member,
      author: interaction.user,
      guild: interaction.guild,
      mentions: {
        users: new Map([[user.id, user]])
      },
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
      client.logger?.log('Converted slash kiss error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
