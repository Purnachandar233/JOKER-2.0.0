/**
 * Centralized error handler for Discord interactions
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Send safe error reply to interaction (handles already-replied state)
 */
async function replyError(interaction, message, client) {
  const embed = new EmbedBuilder()
    .setColor(0xff0051)
    .setDescription(message);

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], flags: [64] }).catch(() => {});
    }
  } catch (err) {
    client?.logger?.log(`Error replying to interaction: ${err.message}`, 'error');
  }
}

/**
 * Send safe error reply to message
 */
async function replyMessageError(message, error, client) {
  const embed = new EmbedBuilder()
    .setColor(0xff0051)
    .setDescription(error);

  try {
    await message.reply({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    client?.logger?.log(`Error replying to message: ${err.message}`, 'error');
  }
}

/**
 * Log error with optional Discord webhook
 */
async function logError(client, error, context = {}) {
  const msg = error?.message || String(error);
  const stack = error?.stack || '';
  
  client?.logger?.log(`[${context.source || 'ERROR'}] ${msg}`, 'error');

  // Send to webhook if configured
  if (client?.config?.webhooks?.errorLogs) {
    try {
      const { WebhookClient, EmbedBuilder } = require('discord.js');
      const web = new WebhookClient({ url: client.config.webhooks.errorLogs });
      const embed = new EmbedBuilder()
        .setTitle(context.source || 'Bot Error')
        .setDescription(`\`\`\`js\n${msg}\n\`\`\``)
        .addFields({ name: 'Context', value: JSON.stringify(context, null, 2).slice(0, 1024) })
        .setColor('Red')
        .setTimestamp();
      await web.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      // Webhook send failed, continue
    }
  }
}

module.exports = { replyError, replyMessageError, logError };
