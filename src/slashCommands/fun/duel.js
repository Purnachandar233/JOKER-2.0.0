const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/games/duel.js');
const { safeReply, safeDeferReply } = require('../../utils/safeReply');

module.exports = {
  name: 'duel',
  description: legacy.description || 'Battle another player in an epic duel!',
  options: [
    {
      name: 'opponent',
      description: 'The user you want to duel',
      type: 9,
      required: true
    }
  ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });

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
      mentions: {
        users: {
          first: () => interaction.options.getUser('opponent')
        }
      }
    };

    try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(message, [], client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await safeReply(interaction, { content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash duel error: ' + (err && (err.stack || err.toString())), 'error');
      await safeReply(interaction, { content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
