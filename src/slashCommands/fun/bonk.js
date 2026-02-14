const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/bonk.js');

module.exports = {
  name: 'bonk',
  description: legacy.description || 'Bonk someone to horny jail!',
  options: [ { name: 'user', description: 'User to bonk', required: true, type: 9 } ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const user = interaction.options.getUser('user');
    const args = [user.id];

    const replyFunc = async (payload) => {
      try {
        if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => {});
        return interaction.editReply(payload).catch(() => interaction.followUp(payload).catch(() => {}));
      } catch(e) {}
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
      client.logger?.log('Converted slash bonk error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
