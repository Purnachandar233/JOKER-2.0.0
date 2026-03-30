const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

function resolveComponentEmoji(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const customMatch = raw.match(/^<(?<animated>a)?:(?<name>[A-Za-z0-9_]+):(?<id>\d+)>$/);
  if (customMatch?.groups?.id) {
    return {
      id: customMatch.groups.id,
      name: customMatch.groups.name || null,
      animated: Boolean(customMatch.groups.animated),
    };
  }

  return raw;
}

function createVoteButton({ label, url, emoji = null }) {
  if (!isHttpUrl(url)) return null;

  const button = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(label)
    .setURL(url);

  try {
    const resolvedEmoji = resolveComponentEmoji(emoji);
    if (resolvedEmoji) button.setEmoji(resolvedEmoji);
  } catch (_error) {}

  return button;
}

function buildDescription(commandLabel, isPremiumCommand) {
  if (isPremiumCommand) {
    return [
      `**Opps! ${commandLabel}** is a premium command.`,
      "",
      "Vote on Top.gg to unlock premium-tier access for 12 hours.",
      "A single vote opens the door to the elevated experience instantly.",
    ].join("\n");
  }

  return [
    `**${commandLabel}** needs a vote before it can be used.`,
    "",
    "Vote on Top.gg to unlock access for 12 hours and continue without limits.",
  ].join("\n");
}

function buildAccessRequiredPrompt({
  client,
  commandLabel = "this command",
  isPremiumCommand = false,
  avatarURL = null,
  getEmoji = () => "",
} = {}) {
  const safeCommandLabel = String(commandLabel || "this command").trim() || "this command";
  const voteUrl = client?.user?.id ? `https://top.gg/bot/${client.user.id}/vote` : null;

  const embed = new EmbedBuilder()
    .setColor(isPremiumCommand ? "#E3B85A" : (client?.embedColor || "#ff0051"))
    .setAuthor({
      name: isPremiumCommand ? "Elite Access" : "Access Required",
      ...(avatarURL ? { iconURL: avatarURL } : {}),
    })
    .setDescription(buildDescription(safeCommandLabel, isPremiumCommand))
    .setFooter({
      text: isPremiumCommand
        ? "Vote once, unlock the premium tier for 12 hours."
        : "Vote once, unlock access for 12 hours.",
    });

  const voteButton = createVoteButton({
    label: isPremiumCommand ? "Unlock With Vote" : "Vote To Unlock",
    url: voteUrl,
    emoji: getEmoji("vote"),
  });

  const components = voteButton
    ? [new ActionRowBuilder().addComponents(voteButton)]
    : [];

  return { embed, components };
}

module.exports = {
  buildAccessRequiredPrompt,
};
