/**
 * Safe reply utility - prevents "Unknown Interaction" errors
 * Handles deferred/replied states automatically
 */

async function safeReply(interaction, options = {}) {
  try {
    if (!interaction) {
      console.error('safeReply: interaction is null/undefined');
      return null;
    }

    // Ensure options is an object
    if (typeof options !== 'object' || options === null) {
      options = { content: String(options) };
    }

    // Check if already replied
    if (interaction.replied) {
      return await interaction.followUp(options).catch(err => {
        console.error('safeReply followUp error:', err && (err.message || err));
        return null;
      });
    }

    // Check if deferred
    if (interaction.deferred) {
      return await interaction.editReply(options).catch(err => {
        console.error('safeReply editReply error:', err && (err.message || err));
        return null;
      });
    }

    // Not replied, not deferred - reply normally
    return await interaction.reply(options).catch(async (err) => {
      console.error('safeReply reply error:', err && (err.message || err));
      // Try to defer and edit as fallback
      if (!interaction.deferred) {
        try {
          await interaction.deferReply({ ephemeral: options.ephemeral ?? false });
          return await interaction.editReply(options).catch(() => null);
        } catch (e) {
          console.error('safeReply fallback failed:', e && (e.message || e));
        }
      }
      return null;
    });
  } catch (err) {
    console.error('safeReply unexpected error:', err && (err.stack || err.message || err));
    return null;
  }
}

async function safeDeferReply(interaction, options = {}) {
  try {
    if (!interaction || interaction.deferred || interaction.replied) {
      return;
    }
    await interaction.deferReply(options).catch(err => {
      console.error('safeDeferReply error:', err && (err.message || err));
    });
  } catch (err) {
    console.error('safeDeferReply unexpected error:', err && (err.message || err));
  }
}

module.exports = { safeReply, safeDeferReply };
