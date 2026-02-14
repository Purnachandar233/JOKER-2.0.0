const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/ship.js');
const { safeReply } = require('../../utils/safeReply');

module.exports = {
  name: 'ship',
  description: legacy.description || 'Ship two users together!',
  options: [ 
    { name: 'user1', description: 'First user to ship', required: true, type: 9 },
    { name: 'user2', description: 'Second user to ship', required: true, type: 9 }
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const args = [];

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
        users: new Map([[user1.id, user1], [user2.id, user2]])
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
      client.logger?.log('Converted slash ship error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
