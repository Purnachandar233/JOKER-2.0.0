const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function createEmbed(client, options = {}) {
  const {
    title,
    description,
    fields,
    author,
    thumbnail,
    image,
    footer,
    timestamp = false
  } = options;

  const embed = new EmbedBuilder().setColor(client?.embedColor || EMBED_COLOR);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
  if (author) embed.setAuthor(author);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  const footerText = footer || `${getEmoji(client, "music", "[M]")} Joker Music`;
return embed;
}

function createLinkRow(client) {
  const support = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Support")
    .setURL("https://discord.gg/JQzBqgmwFm");

  const invite = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Invite")
    .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

  const vote = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Vote")
    .setURL(`https://top.gg/bot/${client.user.id}/vote`);

  const supportEmoji = getEmoji(client, "support");
  const inviteEmoji = getEmoji(client, "invite");
  const voteEmoji = getEmoji(client, "vote");
  try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
  try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
  try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}

  return new ActionRowBuilder().addComponents(support, invite, vote);
}

const User = require("../../schema/User.js");
const Premium = require("../../schema/Premium.js");
const blacklist = require("../../schema/blacklistSchema.js");
const db = require("../../schema/prefix.js");

function createModernMessage(message, client) {
  const originalReply = message.reply.bind(message);
  const originalSend = message.channel.send.bind(message.channel);
  const originalChannel = message.channel;

  const wrappedChannel = new Proxy(originalChannel, {
    get(target, prop, receiver) {
      if (prop === "send") {
        return async payload => originalSend(payload);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });

  return new Proxy(message, {
    get(target, prop, receiver) {
      if (prop === "reply") {
        return async payload => originalReply(payload);
      }
      if (prop === "channel") {
        return wrappedChannel;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

module.exports = async (client, message) => {
  if (!message.guild || !message.guild.id || message.author.bot) return;

  const owners = Array.isArray(client.config.ownerId)
    ? client.config.ownerId
    : [client.config.ownerId].filter(Boolean);

  let prefix;
  try {
    const data = await db.findOne({ Guild: message.guild.id });
    prefix = data?.Prefix || client.prefix;
  } catch (err) {
    client.logger?.log(`Prefix lookup error: ${err.message}`, "warn");
    prefix = client.prefix;
  }

  const mention = new RegExp(`^<@!?${client.user.id}>( |)$`);
  if (message.content.match(mention)) {
    const embed = createEmbed(client, {
      title: `${getEmoji(client, "music")} Joker Music`,
      author: {
        name: "Professional Music Assistant",
        iconURL: client.user.displayAvatarURL({ forceStatic: false })
      },
      description: [
        "High-quality audio, stable playback, and clean interactions.",
        "",
        `Prefix: \`${prefix}\``,
        `Start here: \`${prefix}help\` or \`/help\``
      ].join("\n"),
      footer: `${getEmoji(client, "support")} Need setup help? Open Support`
    });

    return message.channel.send({
      embeds: [embed],
      components: [createLinkRow(client)]
    });
  }

  const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionPrefix = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})`);
  if (!mentionPrefix.test(message.content)) return;

  const matchedContent = message.content.match(mentionPrefix)[0];
  const args = message.content.slice(matchedContent.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
  if (!command) return;

  let user = await User.findOne({ userId: message.author.id }).catch(() => null);
  if (!user) {
    user = await User.create({ userId: message.author.id }).catch(() => null);
  }
  if (user) {
    user.count = (user.count || 0) + 1;
    await user.save().catch(() => {});
  }

  if (command.owneronly && !owners.includes(message.author.id)) return;

  if (command.wl && !owners.includes(message.author.id)) {
    const blocked = await blacklist.findOne({ UserID: message.author.id }).catch(() => null);
    if (blocked) {
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "error")} Access Blocked`,
        description: "You are blacklisted from using this bot."
      });
      return message.channel.send({ embeds: [embed] });
    }
  }

  if (command.djonly) {
    const djSchema = require("../../schema/djroleSchema.js");
    try {
      const djData = await djSchema.findOne({ guildID: message.guild.id }).catch(() => null);
      if (djData?.Roleid) {
        if (!message.member.roles.cache.has(djData.Roleid)) {
          const embed = createEmbed(client, {
            title: `${getEmoji(client, "error")} DJ Role Required`,
            description: "You need the configured DJ role to use this command."
          });
          return message.channel.send({ embeds: [embed] });
        }
      } else if (!owners.includes(message.author.id)) {
        const embed = createEmbed(client, {
          title: `${getEmoji(client, "error")} DJ Role Not Configured`,
          description: "No DJ role is configured yet. Ask an admin to set one."
        });
        return message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      client.logger?.log(`DJ role check error: ${err.message}`, "error");
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "error")} Permission Check Failed`,
        description: "I couldn't verify DJ permissions. Please try again."
      });
      return message.channel.send({ embeds: [embed] });
    }
  }

  if (command.premium) {
    const pUser = await Premium.findOne({ Id: message.author.id, Type: "user" });
    const pGuild = await Premium.findOne({ Id: message.guild.id, Type: "guild" });

    const isUserPremium = pUser && (pUser.Permanent || pUser.Expire > Date.now());
    const isGuildPremium = pGuild && (pGuild.Permanent || pGuild.Expire > Date.now());

    if (pUser && !pUser.Permanent && pUser.Expire <= Date.now()) {
      await pUser.deleteOne();
    }
    if (pGuild && !pGuild.Permanent && pGuild.Expire <= Date.now()) {
      await pGuild.deleteOne();
    }

    let isVoted = false;
    if (client.topgg && typeof client.topgg.hasVoted === "function") {
      try {
        isVoted = await client.topgg.hasVoted(message.author.id);
      } catch (err) {
        client.logger?.log(`Top.gg vote check error: ${err?.message || err}`, "warn");
      }
    }

    if (!isUserPremium && !isGuildPremium && !isVoted) {
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "premium")} Premium Required`,
        description: "This command needs a premium subscription or an active Top.gg vote."
      });
      return message.channel.send({ embeds: [embed], components: [createLinkRow(client)] });
    }
  }

  try {
    const modernMessage = createModernMessage(message, client);
    await command.execute(modernMessage, args, client, prefix);
  } catch (error) {
    client.logger?.log(`Command execution error: ${error?.message || error}`, "error");
    const embed = createEmbed(client, {
      title: `${getEmoji(client, "error")} Command Error`,
      description: `Error executing command: ${error?.message || "Unknown error"}`
    });
    await message.reply({ embeds: [embed] }).catch(() => {});
  }
};

