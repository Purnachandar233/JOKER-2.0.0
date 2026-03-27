function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function clip(value, max = 1020) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function commandLabel(name, { slash = false } = {}) {
  const base = String(name || "").trim().toLowerCase();
  if (!base) return null;
  return slash ? `\`/${base}\`` : `\`${base}\``;
}

function getPrefixCategoryFromFilename(filename) {
  const normalized = normalizePath(filename);
  const parts = normalized.split("/");
  const idx = parts.indexOf("commands");
  if (idx === -1) return { category: null, subgroup: null };

  const category = String(parts[idx + 1] || "").toLowerCase() || null;
  const subgroup = String(parts[idx + 2] || "").toLowerCase() || null;
  return { category, subgroup };
}

function getSlashCategoryFromFilename(filename) {
  const normalized = normalizePath(filename);
  const parts = normalized.split("/");
  const idx = parts.indexOf("slashCommands");
  if (idx === -1) return null;
  return String(parts[idx + 1] || "").toLowerCase() || null;
}

function sortLabels(labels) {
  return [...labels].sort((a, b) => a.localeCompare(b));
}

function buildFunField(funGames, funActions, funOther, getEmoji) {
  const games = sortLabels(funGames);
  const actions = sortLabels(funActions);
  const other = sortLabels(funOther);
  const total = games.length + actions.length + other.length;
  if (!total) return null;

  const lines = [];
  if (games.length) lines.push(`**Games (${games.length})**: ${games.join(", ")}`);
  if (actions.length) lines.push(`**Actions (${actions.length})**: ${actions.join(", ")}`);
  if (other.length) lines.push(`**Other (${other.length})**: ${other.join(", ")}`);

  return {
    name: `${getEmoji("star")} Fun (${total})`,
    value: clip(lines.join("\n")),
    inline: false,
  };
}

function buildCategoryField(category, labels, getEmoji) {
  const sorted = sortLabels(labels);
  if (!sorted.length) return null;

  const title = `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  return {
    name: `${getEmoji("star")} ${title} (${sorted.length})`,
    value: clip(sorted.join(", ")),
    inline: false,
  };
}

function buildPrefixHelpFields(client, getEmoji) {
  const byCategory = new Map();
  const funGames = [];
  const funActions = [];
  const funOther = [];

  for (const command of client.commands.values()) {
    const label = commandLabel(command?.name, { slash: false });
    if (!label) continue;

    const fileInfo = getPrefixCategoryFromFilename(command?._filename);
    const category = String(fileInfo.category || command?.category || "general").toLowerCase();
    if (category === "owner") continue;

    if (category === "fun") {
      if (fileInfo.subgroup === "games") funGames.push(label);
      else if (fileInfo.subgroup === "actions") funActions.push(label);
      else funOther.push(label);
      continue;
    }

    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(label);
  }

  const fields = [];
  const funField = buildFunField(funGames, funActions, funOther, getEmoji);
  if (funField) fields.push(funField);

  for (const category of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
    const field = buildCategoryField(category, byCategory.get(category), getEmoji);
    if (field) fields.push(field);
  }

  return fields;
}

function buildSlashHelpFields(client, getEmoji) {
  const byCategory = new Map();

  for (const command of client.sls.values()) {
    const label = commandLabel(command?.name, { slash: true });
    if (!label) continue;

    const category = getSlashCategoryFromFilename(command?._filename) || "general";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(label);
  }

  const fields = [];
  for (const category of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
    const field = buildCategoryField(category, byCategory.get(category), getEmoji);
    if (field) fields.push(field);
  }
  return fields;
}

module.exports = {
  buildPrefixHelpFields,
  buildSlashHelpFields,
};
