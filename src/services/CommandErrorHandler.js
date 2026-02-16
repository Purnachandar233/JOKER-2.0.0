/**
 * Global Command Error Handler - Wraps all slash command execution
 * Lightweight version: logs only critical errors, skips owner notifications
 */

const { EmbedBuilder } = require('discord.js');

class CommandErrorHandler {
  constructor(client) {
    this.client = client;
    this.errorSampleRate = 0.1; // Only log 10% of errors to reduce I/O
    this.errorCount = new Map(); // Track errors per command
  }

  /**
   * Wrap command execution with error handling
   */
  async executeWithErrorHandling(interaction, commandFunction) {
    const startTime = Date.now();
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Check if interaction is still valid
      if (!interaction.token || !interaction.application_id) {
        console.error(`CommandErrorHandler: Invalid interaction state for /${commandName}`);
        return { error: 'interaction_invalid' };
      }

      // Check if interaction is resolved
      if (interaction.replied || interaction.deferred) {
        // Already responded, just execute
        await commandFunction(interaction);
        return { success: true, duration: Date.now() - startTime };
      }

      // Defer reply to get more time
      if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }

      // Execute command
      await commandFunction(interaction);

      const duration = Date.now() - startTime;
      console.log(`✅ /${commandName} executed by ${userId} in ${guildId} (${duration}ms)`);

      return { success: true, duration };
    } catch (error) {
      const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = Date.now() - startTime;

      // Log error with context (sampled to reduce load)
      const shouldLog = Math.random() < this.errorSampleRate;
      if (shouldLog) {
        const count = (this.errorCount.get(commandName) || 0) + 1;
        this.errorCount.set(commandName, count);

        console.error(`❌ /${commandName}: ${error && (error.message || error)}`);
      }

      // Prepare error embed
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Command Error')
        .setDescription(this.getSafeErrorMessage(error))
        .addFields(
          { name: 'Command', value: `\`/${commandName}\``, inline: true },
          { name: 'Error ID', value: `\`${errorId}\``, inline: true },
          { name: 'Duration', value: `${duration}ms`, inline: true }
        )
        .setTimestamp();

      // Try to send error to user
      try {
        if (!interaction.replied) {
          if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
          }
          await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
        } else {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
      } catch (replyErr) {
        console.error(`CommandErrorHandler: Failed to send error embed to user:`, replyErr && (replyErr.message || replyErr));
      }

      // Skip owner notification (reduce DM spam and load)
      return { error: error.message, errorId, duration };
    }
  }

  /**
   * Get safe error message to show users (hide internals)
   */
  getSafeErrorMessage(error) {
    const message = error && (error.message || error.toString() || 'Unknown error');

    // Hide sensitive information
    if (message.includes('mongodb') || message.includes('mongoose')) {
      return 'Database error occurred. Please try again later.';
    }
    if (message.includes('lavalink') || message.includes('lavalinkmanager')) {
      return 'Music service error. Please try again in a moment.';
    }
    if (message.includes('token') || message.includes('auth') || message.includes('credential')) {
      return 'Authentication error. Please contact support.';
    }
    if (message.includes('rate') || message.includes('429')) {
      return 'Too many requests. Please slow down and try again.';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'Missing permissions. Bot may need role updates.';
    }
    if (message.includes('timeout') || message.includes('econnrefused')) {
      return 'Connection timeout. Please try again.';
    }
    if (message.includes('invalid') || message.includes('malformed')) {
      return 'Invalid input provided. Please check your parameters.';
    }

    // Default message
    return 'An unexpected error occurred. Please try again.';
  }

}

module.exports = CommandErrorHandler;
