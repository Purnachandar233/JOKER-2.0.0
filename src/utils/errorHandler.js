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

    // If we received an Error object, pass it directly so the logger
    // can extract the stack frame and filename. Otherwise log as string.
    try {
      if (error instanceof Error) {
        client?.logger?.log(error, 'error');
      } else {
        // If this originated from a slash command, attempt to resolve the
        // actual source filename from the registered slash commands map.
        let sourceLabel = context.source || 'ERROR';
        try {
          if (context.source === 'SlashCommand' && context.command && client && client.sls && typeof client.sls.get === 'function') {
            const cmd = client.sls.get(context.command);
            if (cmd && cmd._filename) sourceLabel = cmd._filename;
          }
        } catch (x) {}
        client?.logger?.log(`[${sourceLabel}] ${msg}`, 'error');
      }
    } catch (e) {
      // Fallback to string logging on unexpected failures
      client?.logger?.log(`[${context.source || 'ERROR'}] ${msg}`, 'error');
    }

  // Send to webhook if configured. Allow env override and an enable flag.
  try {
  
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
