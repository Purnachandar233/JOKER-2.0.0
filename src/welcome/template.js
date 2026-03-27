const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;
const DEFAULT_WELCOME_TITLE = "Welcome!";
const DEFAULT_WELCOME_EMBED_MESSAGE = "Welcome {user} to {server}!";
const DEFAULT_WELCOME_TEXT_MESSAGE = "Welcome {user} to {server}! You are member #{count}.";

function normalizeWelcomeColor(input, fallback = "#ff0051") {
  if (!input) return fallback;
  const value = String(input).trim();
  if (value.toLowerCase() === "default") return fallback;
  if (!HEX_COLOR_RE.test(value)) return null;
  return value.startsWith("#") ? value : `#${value}`;
}

function resolveWelcomeTemplate(template, fallback = DEFAULT_WELCOME_EMBED_MESSAGE) {
  const value = String(template || "").trim();
  return value || fallback;
}

function renderWelcomeTemplate(template, member, fallback = DEFAULT_WELCOME_EMBED_MESSAGE) {
  const guild = member.guild;
  const user = member.user || member;
  const memberId = member.id || user.id || "0";
  const userTag = user.tag || `${user.username || "User"}#0000`;
  const userName = user.username || user.globalName || "User";
  const replacements = {
    "{user}": `<@${memberId}>`,
    "{mention}": `<@${memberId}>`,
    "{user.tag}": userTag,
    "{user.name}": userName,
    "{server}": guild.name,
    "{count}": String(guild.memberCount),
    "{id}": memberId
  };

  let output = resolveWelcomeTemplate(template, fallback);
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
  }
  return output;
}

function welcomeVariablesText() {
  return [
    "`{user}` or `{mention}` - mention user",
    "`{user.tag}` - user tag",
    "`{user.name}` - username",
    "`{server}` - server name",
    "`{count}` - member count",
    "`{id}` - user id"
  ].join("\n");
}

module.exports = {
  DEFAULT_WELCOME_TITLE,
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  normalizeWelcomeColor,
  resolveWelcomeTemplate,
  renderWelcomeTemplate,
  welcomeVariablesText
};
