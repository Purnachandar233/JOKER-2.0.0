const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/general/info.js');

module.exports = {
  name: 'info',
  description: legacy.description || 'Converted slash for info',
  options: [ { name: 'args', description: 'Arguments (space separated)', required: false, type: 3 } ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const argstr = interaction.options.getString('args') || '';
    const args = argstr.length ? argstr.trim().split(/ +/) : [];

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
      client.logger?.log('Converted slash info error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};
