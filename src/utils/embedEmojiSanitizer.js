const { EmbedBuilder } = require("discord.js");

const PATCH_FLAG = Symbol.for("joker.embed.emoji_sanitizer_patched");
const CUSTOM_EMOJI_REGEX = /<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g;
const UNICODE_EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const EMOJI_COMPONENT_REGEX = /[\u200D\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}]/gu;

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  const cleaned = value
    .replace(CUSTOM_EMOJI_REGEX, "")
    .replace(UNICODE_EMOJI_REGEX, "")
    .replace(EMOJI_COMPONENT_REGEX, "");
  const trimmed = cleaned.trim();
  return trimmed.length > 0 ? trimmed : " ";
}

function sanitizeFieldEntries(builder) {
  if (!builder?.data || !Array.isArray(builder.data.fields)) return;

  builder.data.fields = builder.data.fields.map(field => {
    if (!field || typeof field !== "object") return field;

    const next = { ...field };
    if (typeof next.name === "string") next.name = sanitizeText(next.name);
    if (typeof next.value === "string") next.value = sanitizeText(next.value);

    return next;
  });
}

function patchMethod(methodName, patcher) {
  const original = EmbedBuilder.prototype[methodName];
  if (typeof original !== "function") return;

  EmbedBuilder.prototype[methodName] = patcher(original);
}

function patchEmbedEmojiSanitizer() {
  if (EmbedBuilder.prototype[PATCH_FLAG]) return;

  patchMethod("setTitle", original => function setTitlePatched(title) {
    return original.call(this, sanitizeText(title));
  });

  patchMethod("setDescription", original => function setDescriptionPatched(description) {
    return original.call(this, sanitizeText(description));
  });

  patchMethod("setAuthor", original => function setAuthorPatched(author) {
    if (author && typeof author === "object" && typeof author.name === "string") {
      author = { ...author, name: sanitizeText(author.name) };
    }
    return original.call(this, author);
  });

  patchMethod("updateAuthor", original => function updateAuthorPatched(author) {
    if (author && typeof author === "object" && typeof author.name === "string") {
      author = { ...author, name: sanitizeText(author.name) };
    }
    return original.call(this, author);
  });

  patchMethod("setFooter", original => function setFooterPatched(footer) {
    if (footer && typeof footer === "object" && typeof footer.text === "string") {
      footer = { ...footer, text: sanitizeText(footer.text) };
    }
    return original.call(this, footer);
  });

  patchMethod("updateFooter", original => function updateFooterPatched(footer) {
    if (footer && typeof footer === "object" && typeof footer.text === "string") {
      footer = { ...footer, text: sanitizeText(footer.text) };
    }
    return original.call(this, footer);
  });

  patchMethod("addFields", original => function addFieldsPatched(...fields) {
    const result = original.apply(this, fields);
    sanitizeFieldEntries(this);
    return result;
  });

  patchMethod("setFields", original => function setFieldsPatched(...fields) {
    const result = original.apply(this, fields);
    sanitizeFieldEntries(this);
    return result;
  });

  patchMethod("spliceFields", original => function spliceFieldsPatched(...args) {
    const result = original.apply(this, args);
    sanitizeFieldEntries(this);
    return result;
  });

  Object.defineProperty(EmbedBuilder.prototype, PATCH_FLAG, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  });
}

module.exports = {
  patchEmbedEmojiSanitizer,
  sanitizeText
};
