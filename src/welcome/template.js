const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

function normalizeWelcomeColor(input, fallback = "#ff0051") {
  if (!input) return fallback;
  const value = String(input).trim();
  if (value.toLowerCase() === "default") return fallback;
  if (!HEX_COLOR_RE.test(value)) return null;
  return value.startsWith("#") ? value : `#${value}`;
}

function renderWelcomeTemplate(template, member) {
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

  let output = String(template || "Welcome {user} to {server}!");
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
  normalizeWelcomeColor,
  renderWelcomeTemplate,
  welcomeVariablesText
};
