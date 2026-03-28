const { EmbedBuilder, WebhookClient } = require("discord.js");
const sanitize = require("./sanitize");
const { safeReply, safeDeferReply } = require("./interactionResponder");

function resolveEmbedColor(client, fallback = "#ff0051") {
  return client?.embedColor || fallback;
}

function clampText(value, maxLength = 1024, fallback = "Unknown") {
  const text = String(value ?? "").trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function createErrorId(prefix = "ERR") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function resolveWebhookUrl(client, type = "error") {
  if (type === "owner") {
    return String(process.env.OWNER_CMDS_WEBHOOK_URL || client?.config?.webhooks?.ownerCmds || "").trim();
  }

  return String(process.env.ERROR_WEBHOOK_URL || client?.config?.webhooks?.errorLogs || "").trim();
}

async function sendWebhookEmbed(url, embed) {
  if (!url) return false;

  try {
    const webhook = new WebhookClient({ url });
    await webhook.send({ embeds: [embed] }).catch(() => {});
    webhook.destroy?.();
    return true;
  } catch (_err) {
    return false;
  }
}

function getSafeErrorMessage(error) {
  const message = sanitize(error?.message || error?.toString?.() || "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("mongodb") || lower.includes("mongoose")) {
    return "Database error occurred. Please try again later.";
  }
  if (lower.includes("lavalink") || lower.includes("lavalinkmanager")) {
    return "Music service error. Please try again in a moment.";
  }
  if (lower.includes("token") || lower.includes("auth") || lower.includes("credential")) {
    return "Authentication error. Please contact support.";
  }
  if (lower.includes("rate") || lower.includes("429")) {
    return "Too many requests. Please slow down and try again.";
  }
  if (lower.includes("permission") || lower.includes("forbidden")) {
    return "Missing permissions. Bot may need role updates.";
  }
  if (lower.includes("timeout") || lower.includes("econnrefused")) {
    return "Connection timeout. Please try again.";
  }
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("eai_again")) {
    return "Network request failed. Please try again in a moment.";
  }
  if (lower.includes("invalid") || lower.includes("malformed")) {
    return "Invalid input provided. Please check your parameters.";
  }

  return "An unexpected error occurred. Please try again.";
}

function buildCommandErrorEmbed(client, context = {}) {
  const safeMessage = clampText(context.safeMessage || "An unexpected error occurred. Please try again.", 4096);
  const errorId = clampText(context.errorId || createErrorId("CMD"), 128);
  const commandLabel = clampText(context.commandLabel || context.command || "Unknown", 256);
  const embed = new EmbedBuilder()
    .setColor(resolveEmbedColor(client))
    .setTitle("Command Error")
    .setDescription(safeMessage)
    .addFields(
      { name: "Command", value: `\`${commandLabel}\``, inline: true },
      { name: "Error ID", value: `\`${errorId}\``, inline: true }
    )
    .setTimestamp();

  if (Number.isFinite(Number(context.durationMs)) && Number(context.durationMs) >= 0) {
    embed.addFields({
      name: "Duration",
      value: `${Number(context.durationMs)}ms`,
      inline: true,
    });
  }

  return embed;
}

function createLogMetadata(context = {}) {
  const metadata = {};
  if (context.errorId) metadata.errorId = context.errorId;
  if (context.command) metadata.command = context.command;
  if (context.commandLabel) metadata.commandLabel = context.commandLabel;
  if (context.mode) metadata.mode = context.mode;
  if (context.stage) metadata.stage = context.stage;
  if (Number.isFinite(Number(context.durationMs)) && Number(context.durationMs) >= 0) {
    metadata.duration = `${Number(context.durationMs)}ms`;
  }
  return metadata;
}

async function logError(client, error, context = {}) {
  const source = context.source || "Bot Error";
  const errorId = context.errorId || createErrorId(source === "Startup" ? "STARTUP" : "ERR");
  const messageText = sanitize(error?.message || String(error));
  const includeStack = String(process.env.LOG_STACKS || "false").toLowerCase() === "true";
  const stack = includeStack ? sanitize(error?.stack || "") : "";
  const shouldSkipLocalLog = context.skipLocalLog === true;
  const logMetadata = createLogMetadata({ ...context, errorId });

  if (!shouldSkipLocalLog) {
    try {
      if (client?.logger && typeof client.logger.error === "function") {
        client.logger.error(`[${source}] (${errorId}) ${messageText}`, error instanceof Error ? error : null, logMetadata);
      } else if (client?.logger && typeof client.logger.log === "function") {
        client.logger.log(`[${source}] (${errorId}) ${messageText}`, "error", logMetadata);
      } else {
        console.error(`[${source}] (${errorId}) ${messageText}`);
      }
    } catch (_err) {
      console.error(`[${source}] (${errorId}) ${messageText}`);
    }
  }

  try {
    const webhookUrl = resolveWebhookUrl(client, "error");
    if (!webhookUrl) return { errorId, delivered: false };

    const contextPayload = createLogMetadata({ ...context, errorId });

    let serializedContext = "No context";
    try {
      serializedContext = sanitize(JSON.stringify(contextPayload, null, 2));
    } catch (_err) {
      serializedContext = "[UNSERIALIZABLE_CONTEXT]";
    }

    const embed = new EmbedBuilder()
      .setColor(resolveEmbedColor(client, "#ff0051"))
      .setTitle(source)
      .setDescription(`\`\`\`js\n${clampText(messageText, 4000, "Unknown error")}\n\`\`\``)
      .addFields(
        { name: "Error ID", value: `\`${errorId}\``, inline: true },
        { name: "Context", value: clampText(serializedContext, 1024, "No context"), inline: false }
      )
      .setTimestamp();

    if (stack) {
      embed.addFields({ name: "Stack", value: clampText(stack, 1024, "Unavailable"), inline: false });
    }

    const delivered = await sendWebhookEmbed(webhookUrl, embed);
    return { errorId, delivered };
  } catch (_err) {
    return { errorId, delivered: false };
  }
}

async function reportStartupError(client, error, context = {}) {
  return logError(client, error, {
    ...context,
    source: "Startup",
    skipLocalLog: true,
  });
}

async function handleInteractionCommandError(client, interaction, error, context = {}) {
  const errorId = context.errorId || createErrorId("CMD");
  const safeMessage = context.safeMessage || getSafeErrorMessage(error);

  await logError(client, error, {
    ...context,
    errorId,
    safeMessage,
    source: context.source || "SlashCommand",
  });

  const embed = buildCommandErrorEmbed(client, {
    ...context,
    errorId,
    safeMessage,
  });

  try {
    if (!interaction?.deferred && !interaction?.replied) {
      await safeDeferReply(interaction, { ephemeral: true });
    }
    await safeReply(interaction, { embeds: [embed], ephemeral: true });
  } catch (_err) {}

  return { errorId };
}

async function handleMessageCommandError(client, message, error, context = {}) {
  const errorId = context.errorId || createErrorId("CMD");
  const safeMessage = context.safeMessage || getSafeErrorMessage(error);

  await logError(client, error, {
    ...context,
    errorId,
    safeMessage,
    source: context.source || "PrefixCommand",
  });

  const embed = buildCommandErrorEmbed(client, {
    ...context,
    errorId,
    safeMessage,
  });

  await message?.reply?.({ embeds: [embed] }).catch(() => {});
  return { errorId };
}

async function logOwnerCommand(client, context = {}) {
  try {
    const webhookUrl = resolveWebhookUrl(client, "owner");
    if (!webhookUrl) return false;

    const commandLabel = clampText(context.command, 256, "Unknown");
    const mode = clampText(context.mode || "unknown", 256, "unknown");

    const embed = new EmbedBuilder()
      .setColor(resolveEmbedColor(client))
      .setTitle("Owner Command Used")
      .addFields(
        { name: "Command", value: `\`${commandLabel}\``, inline: true },
        { name: "Mode", value: `\`${mode}\``, inline: true }
      )
      .setTimestamp();

    return await sendWebhookEmbed(webhookUrl, embed);
  } catch (_err) {
    return false;
  }
}

module.exports = {
  createErrorId,
  getSafeErrorMessage,
  logError,
  reportStartupError,
  handleInteractionCommandError,
  handleMessageCommandError,
  logOwnerCommand,
};
