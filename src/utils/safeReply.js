/**
 * Safe reply utility - prevents "Unknown Interaction" errors
 * Handles deferred/replied states automatically.
 */

function isAlreadyAcknowledged(error) {
  return (
    error?.code === 40060 ||
    /already been acknowledged/i.test(error?.message || "") ||
    /already been sent or deferred/i.test(error?.message || "")
  );
}

async function safeReply(interaction, options = {}) {
  try {
    if (!interaction) {
      console.error("safeReply: interaction is null/undefined");
      return null;
    }

    if (typeof options !== "object" || options === null) {
      options = { content: String(options) };
    }

    if (interaction.replied) {
      return await interaction.followUp(options).catch((err) => {
        if (isAlreadyAcknowledged(err)) {
          return interaction.editReply(options).catch(() => null);
        }
        console.error("safeReply followUp error:", err && (err.message || err));
        return null;
      });
    }

    if (interaction.deferred) {
      return await interaction.editReply(options).catch((err) => {
        console.error("safeReply editReply error:", err && (err.message || err));
        return null;
      });
    }

    return await interaction.reply(options).catch(async (err) => {
      if (isAlreadyAcknowledged(err)) {
        if (interaction.deferred) return interaction.editReply(options).catch(() => null);
        return interaction.followUp(options).catch(() => null);
      }

      console.error("safeReply reply error:", err && (err.message || err));
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: options.ephemeral ?? false });
        }
        return await interaction.editReply(options).catch(() => null);
      } catch (fallbackError) {
        if (isAlreadyAcknowledged(fallbackError)) {
          if (interaction.deferred) return interaction.editReply(options).catch(() => null);
          return interaction.followUp(options).catch(() => null);
        }
        console.error("safeReply fallback failed:", fallbackError && (fallbackError.message || fallbackError));
      }
      return null;
    });
  } catch (err) {
    console.error("safeReply unexpected error:", err && (err.stack || err.message || err));
    return null;
  }
}

async function safeDeferReply(interaction, options = {}) {
  try {
    if (!interaction) {
      console.error("safeDeferReply: interaction is null/undefined");
      return false;
    }

    if (interaction.deferred || interaction.replied) {
      return true;
    }

    await interaction.deferReply(options);
    return true;
  } catch (err) {
    if (isAlreadyAcknowledged(err)) return true;
    console.error("safeDeferReply error:", err && (err.message || err));
    return false;
  }
}

module.exports = { safeReply, safeDeferReply };
