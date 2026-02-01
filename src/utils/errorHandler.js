/**
 * Centralized error handler for Discord interactions
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Send safe error reply to interaction (handles already-replied state)
 */
async function replyError(interaction, message, client) {
  const embed = new EmbedBuilder()
    .setColor((typeof client !== 'undefined' && client?.embedColor) ? client.embedColor : '#ff0051')
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
    .setColor((typeof client !== 'undefined' && client?.embedColor) ? client.embedColor : '#ff0051')
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
    const sanitize = require('./sanitize');
    const msg = sanitize(error?.message || String(error));
    const stack = sanitize(error?.stack || '');

    client?.logger?.log(`[${context.source || 'ERROR'}] ${msg}`, 'error');

  // Send to webhook if configured. Allow env override and an enable flag.
  try {
    if (process.env.ENABLE_WEBHOOK_LOGS && process.env.ENABLE_WEBHOOK_LOGS.toLowerCase() === 'false') return;
    const webhookUrl = process.env.ERROR_WEBHOOK_URL || client?.config?.webhooks?.errorLogs;
    if (!webhookUrl) return;
    const { WebhookClient, EmbedBuilder } = require('discord.js');
    const web = new WebhookClient({ url: webhookUrl });
    const embed = new EmbedBuilder()
      .setTitle(context.source || 'Bot Error')
      .setDescription(`\`\`\`js\n${String(msg)}\n\`\`\``)
      .addFields({ name: 'Context', value: sanitize(JSON.stringify(context, null, 2)).slice(0, 1024) })
      .setColor((typeof client !== 'undefined' && client?.embedColor) ? client.embedColor : 'Red')
      .setTimestamp();
    await web.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    // Webhook send failed, continue
  }
}

module.exports = { replyError, replyMessageError, logError };
