/**
 * Interaction responder utility.
 * Replaces legacy safeReply/safeDeferReply helpers with low-noise behavior.
 */

const EPHEMERAL_FLAG = 1 << 6;

function isAlreadyAcknowledged(error) {
  return (
    error?.code === 40060 ||
    /already been acknowledged/i.test(error?.message || "") ||
    /already been sent or deferred/i.test(error?.message || "")
  );
}

function normalizeInteractionOptions(options, { forEdit = false } = {}) {
  if (!options || typeof options !== "object") return options;

  const cloned = { ...options };
  if (Object.prototype.hasOwnProperty.call(cloned, "ephemeral")) {
    const ephemeral = Boolean(cloned.ephemeral);
    delete cloned.ephemeral;

    if (!forEdit && ephemeral) {
      if (typeof cloned.flags === "number") cloned.flags |= EPHEMERAL_FLAG;
      else cloned.flags = EPHEMERAL_FLAG;
    }
  }

  return cloned;
}

async function deferReply(interaction, options = {}) {
  try {
    if (!interaction) return false;
    if (interaction.deferred || interaction.replied) return true;
    await interaction.deferReply(normalizeInteractionOptions(options));
    return true;
  } catch (err) {
    if (isAlreadyAcknowledged(err)) return true;
    return false;
  }
}

async function reply(interaction, options = {}) {
  try {
    if (!interaction) return null;
    if (typeof options !== "object" || options === null) {
      options = { content: String(options) };
    }

    if (interaction.replied) {
      return await interaction.followUp(normalizeInteractionOptions(options)).catch((err) => {
        if (isAlreadyAcknowledged(err)) {
          return interaction.editReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
        }
        return null;
      });
    }

    if (interaction.deferred) {
      return await interaction.editReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
    }

    return await interaction.reply(normalizeInteractionOptions(options)).catch(async (err) => {
      if (isAlreadyAcknowledged(err)) {
        if (interaction.deferred) return interaction.editReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
        return interaction.followUp(normalizeInteractionOptions(options)).catch(() => null);
      }

      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply(normalizeInteractionOptions({ ephemeral: options.ephemeral ?? false }));
        }
        return await interaction.editReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
      } catch (fallbackError) {
        if (isAlreadyAcknowledged(fallbackError)) {
          if (interaction.deferred) return interaction.editReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
          return interaction.followUp(normalizeInteractionOptions(options)).catch(() => null);
        }
      }
      return null;
    });
  } catch (_err) {
    return null;
  }
}

module.exports = {
  // New names
  reply,
  deferReply,

  // Backward compatibility aliases
  safeReply: reply,
  safeDeferReply: deferReply,
};
