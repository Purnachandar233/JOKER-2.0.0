const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { inspect } = require('util');

module.exports = {
  name: "eval",
  category: "owner",
  description: "Evaluates JavaScript code (Owner Only)",
  owneronly: true, // Ensured strict owner-only access
  execute: async (message, args, client, prefix) => {
    // Evaluation logic...
    const player = client.lavalink.players.get(message.guild.id);
    try {
      const drow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("Delete")
            .setStyle(4)
            .setCustomId("evaldelete")
        );
      const code = args.join(' ');
      if (!code) return message.reply("Please provide code to evaluate.");

      if (code.toLowerCase().includes("token")) {
        return message.channel.send({ content: `\`\`\`js\nT0K3N\`\`\``, components: [drow] });
      }

      let result = await eval(code);
      let output = result;
      if (typeof output !== 'string') {
        output = inspect(result);
      }

      if (output.length > 2000) {
        // Output too long, using snippet
        return message.channel.send({ content: `\`\`\`js\n${output.substring(0, 1990)}...\n// Output truncated\`\`\``, components: [drow] });
      }

      return message.channel.send({ content: `\`\`\`js\n${output}\`\`\``, components: [drow] });
    } catch (error) {
      const deletea = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("Delete")
            .setStyle(4)
            .setCustomId("evaldelete")
        );
      return message.reply({ content: `\`\`\`js\n${error}\`\`\``, components: [deletea] });
    }
  }
};
