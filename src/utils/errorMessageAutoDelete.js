const DEFAULT_ERROR_DELETE_MS = 60 * 1000;

const ERROR_TEXT_PATTERN = /\berror\b|\bfailed\b|\bfailure\b|\bcannot\b|\bcould not\b|\bcouldn't\b|\bunable\b|\binvalid\b|\bforbidden\b|\bdenied\b|\bblacklisted\b|\bunavailable\b|\bnot connected\b|\bpermission check failed\b|\brequired\b|\bno mirror found\b/i;

const scheduledDeletions = new Set();

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveDeleteDelayMs(client) {
  const configured =
    client?.config?.errorMessageDeleteMs ??
    process.env.ERROR_MESSAGE_DELETE_MS ??
    null;

  return toPositiveNumber(configured, DEFAULT_ERROR_DELETE_MS);
}

function extractMessageText(message) {
  const chunks = [];

  if (typeof message?.content === "string" && message.content.trim()) {
    chunks.push(message.content.trim());
  }

  const embeds = Array.isArray(message?.embeds) ? message.embeds : [];
  for (const embed of embeds) {
    const title = embed?.title || embed?.data?.title || "";
    const description = embed?.description || embed?.data?.description || "";

    if (title) chunks.push(String(title));
    if (description) chunks.push(String(description));

    const fields = embed?.fields || embed?.data?.fields || [];
    if (Array.isArray(fields)) {
      for (const field of fields) {
        if (field?.name) chunks.push(String(field.name));
        if (field?.value) chunks.push(String(field.value));
      }
    }
  }

  return chunks.join("\n").trim();
}

function isLikelyErrorMessage(message) {
  const text = extractMessageText(message);
  if (!text) return false;
  return ERROR_TEXT_PATTERN.test(text);
}

function scheduleErrorMessageDeletion(client, message) {
  try {
    if (!message?.id) return false;
    if (scheduledDeletions.has(message.id)) return true;
    if (!message?.author?.bot) return false;
    if (!message?.deletable) return false;
    if (!isLikelyErrorMessage(message)) return false;

    const delayMs = resolveDeleteDelayMs(client);
    scheduledDeletions.add(message.id);

    const timer = setTimeout(() => {
      scheduledDeletions.delete(message.id);
      message.delete().catch(() => {});
    }, delayMs);

    if (typeof timer.unref === "function") timer.unref();
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = {
  scheduleErrorMessageDeletion,
  isLikelyErrorMessage,
};
