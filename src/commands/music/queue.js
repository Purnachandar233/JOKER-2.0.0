const { ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { messagepaginationEmbed } = require("../../utils/pagination.js");

const EMOJIS = require("../../utils/emoji.json");

function chunkArray(list, size) {
  if (!Array.isArray(list) || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  name: "queue",
  category: "music",
  aliases: ["q", "list"],
  description: "Displays the music queue.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };
    const createPaginationButtons = (page = 1, total = 1) => {
      const first = new ButtonBuilder().setCustomId("first").setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const back = new ButtonBuilder().setCustomId("back").setLabel("Back").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const next = new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      const last = new ButtonBuilder().setCustomId("last").setLabel("Last").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      try { first.setEmoji(getEmoji("first")); } catch (_e) {}
      try { back.setEmoji(getEmoji("back")); } catch (_e) {}
      try { next.setEmoji(getEmoji("next")); } catch (_e) {}
      try { last.setEmoji(getEmoji("last")); } catch (_e) {}
      return [first, back, next, last];
    };

    const { channel } = message.member.voice;

    if (!channel) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Voice Channel Required`,
        description: "Join a voice channel to view the queue."
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!client.lavalink) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Audio Backend Offline`,
        description: "Lavalink is not connected yet. Please try again in a moment."
      });
      return message.channel.send({ embeds: [embed] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    const { getQueueArray } = require("../../utils/queue.js");
    const tracks = getQueueArray(player);

    if (!player || !tracks || tracks.length === 0) {
      const embed = createEmbed({
        title: `${getEmoji("queue")} Queue Empty`,
        description: "Nothing is currently playing."
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Wrong Voice Channel`,
        description: "You must be in the same voice channel as the bot."
      });
      return message.channel.send({ embeds: [embed] });
    }

    const current = tracks[0];
    const currentTitle = current?.info?.title || current?.title || "No current track";
    const currentDuration = current?.info?.isStream || current?.isStream
      ? "LIVE"
      : (current?.info?.duration || current?.duration)
        ? new Date(current?.info?.duration || current?.duration).toISOString().slice(11, 19)
        : "Unknown";

    const upcoming = tracks.slice(1).map((track, i) => {
      const title = track?.info?.title?.slice(0, 55) || track?.title?.slice(0, 55) || "Unknown Title";
      const isStream = track?.info?.isStream || track?.isStream;
      const duration = track?.info?.duration || track?.duration;
      const durationText = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(14, 19) : "Unknown");
      return `**${i + 1}.** ${title} \`[${durationText}]\``;
    });

    const pages = chunkArray(upcoming, 10);
    const embeds = [];

    if (!pages.length) {
      embeds.push(createEmbed({
        title: `${getEmoji("queue")} Queue Overview`,
        description: `**Now Playing**\n${currentTitle} - \`${currentDuration}\`\n\n**Upcoming Tracks**\n*No more tracks in line.*`,
        author: {
          name: message.guild.name,
          iconURL: message.guild.iconURL({ forceStatic: false }) || client.user.displayAvatarURL({ forceStatic: false })
        },
        footer: `${getEmoji("music")} Page 1/1`
      }));
    } else {
      for (let i = 0; i < pages.length; i++) {
        const list = pages[i].join("\n") || "*No more tracks in line.*";
        embeds.push(createEmbed({
          title: `${getEmoji("queue")} Queue Overview`,
          description: `**Now Playing**\n${currentTitle} - \`${currentDuration}\`\n\n**Upcoming Tracks**\n${list}`,
          author: {
            name: message.guild.name,
            iconURL: message.guild.iconURL({ forceStatic: false }) || client.user.displayAvatarURL({ forceStatic: false })
          },
          footer: `${getEmoji("music")} Page ${i + 1}/${pages.length}`
        }));
      }
    }

    if (embeds.length === 1) {
      return message.channel.send({ embeds: [embeds[0]] });
    }

    const buttonList = createPaginationButtons(1, embeds.length).map(button =>
      ButtonBuilder.from(button).setDisabled(false)
    );

    return messagepaginationEmbed(message, embeds, buttonList, message.member.user, 30000);
  }
};

