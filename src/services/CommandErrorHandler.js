/**
 * Global Command Error Handler - Wraps slash command execution
 * Optimized to keep logs low-noise in production.
 */

const { EmbedBuilder } = require('discord.js');
const { safeDeferReply, safeReply } = require('../utils/interactionResponder');
const ERROR_COUNT_MAX = 250;

class CommandErrorHandler {
  constructor(client) {
    this.client = client;
    this.errorSampleRate = 0.1; // Log only 10% of errors to reduce noise/I/O
    this.errorCount = new Map();
    this.logSuccessfulCommands = String(process.env.LOG_COMMAND_SUCCESS || 'false').toLowerCase() === 'true';
  }

  pruneErrorCount() {
    if (this.errorCount.size < ERROR_COUNT_MAX) return;

    const overflow = this.errorCount.size - ERROR_COUNT_MAX + 1;
    let removed = 0;
    for (const key of this.errorCount.keys()) {
      this.errorCount.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }

  /**
   * Wrap command execution with defensive interaction handling.
   */
  async executeWithErrorHandling(interaction, commandFunction) {
    const startTime = Date.now();
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      const applicationId =
        interaction?.applicationId ||
        interaction?.application_id ||
        interaction?.client?.application?.id ||
        interaction?.client?.user?.id ||
        null;

      if (!interaction?.token || !applicationId) {
        console.error(`CommandErrorHandler: Invalid interaction state for /${commandName}`);
        return { error: 'interaction_invalid' };
      }

      if (interaction.replied || interaction.deferred) {
        await commandFunction(interaction);
        return { success: true, duration: Date.now() - startTime };
      }

      if (!interaction.deferred) {
        await safeDeferReply(interaction, { ephemeral: false });
      }

      await commandFunction(interaction);

      const duration = Date.now() - startTime;
      if (this.logSuccessfulCommands) {
        console.log(`OK /${commandName} executed by ${userId} in ${guildId} (${duration}ms)`);
      }

      return { success: true, duration };
    } catch (error) {
      const errorId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const duration = Date.now() - startTime;

      if (Math.random() < this.errorSampleRate) {
        this.pruneErrorCount();
        const count = (this.errorCount.get(commandName) || 0) + 1;
        this.errorCount.set(commandName, count);
        console.error(`Command /${commandName} failed: ${error && (error.message || error)}`);
      }

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Command Error')
        .setDescription(this.getSafeErrorMessage(error))
        .addFields(
          { name: 'Command', value: `\`/${commandName}\``, inline: true },
          { name: 'Error ID', value: `\`${errorId}\``, inline: true },
          { name: 'Duration', value: `${duration}ms`, inline: true }
        )
        .setTimestamp();

      try {
        if (!interaction.replied) {
          if (!interaction.deferred) {
            await safeDeferReply(interaction, { ephemeral: true });
          }
          await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
        } else {
          await safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
        }
      } catch (replyErr) {
        console.error('CommandErrorHandler: Failed to send error embed to user:', replyErr && (replyErr.message || replyErr));
      }

      return { error: error && error.message, errorId, duration };
    }
  }

  /**
   * Hide sensitive/internal details in user-facing errors.
   */
  getSafeErrorMessage(error) {
    const message = (error && (error.message || error.toString())) || 'Unknown error';
    const lower = message.toLowerCase();

    if (lower.includes('mongodb') || lower.includes('mongoose')) {
      return 'Database error occurred. Please try again later.';
    }
    if (lower.includes('lavalink') || lower.includes('lavalinkmanager')) {
      return 'Music service error. Please try again in a moment.';
    }
    if (lower.includes('token') || lower.includes('auth') || lower.includes('credential')) {
      return 'Authentication error. Please contact support.';
    }
    if (lower.includes('rate') || lower.includes('429')) {
      return 'Too many requests. Please slow down and try again.';
    }
    if (lower.includes('permission') || lower.includes('forbidden')) {
      return 'Missing permissions. Bot may need role updates.';
    }
    if (lower.includes('timeout') || lower.includes('econnrefused')) {
      return 'Connection timeout. Please try again.';
    }
    if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('eai_again')) {
      return 'Network request failed. Please try again in a moment.';
    }
    if (lower.includes('invalid') || lower.includes('malformed')) {
      return 'Invalid input provided. Please check your parameters.';
    }

    return 'An unexpected error occurred. Please try again.';
  }
}

module.exports = CommandErrorHandler;
