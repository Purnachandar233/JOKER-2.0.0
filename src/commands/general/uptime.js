const { EmbedBuilder } = require("discord.js");

const moment = require("moment");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "uptime",
  category: "general",
  description: "Shows the uptime of the bot.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
  
    const d = moment.duration(client.uptime);
    const days = `${d.days()} day${d.days() === 1 ? "" : "s"}`;
    const hours = `${d.hours()} hour${d.hours() === 1 ? "" : "s"}`;
    const minutes = `${d.minutes()} minute${d.minutes() === 1 ? "" : "s"}`;
    const seconds = `${d.seconds()} second${d.seconds() === 1 ? "" : "s"}`;

    const embed = new EmbedBuilder()
      .setTitle(` Uptime`)
      .setColor(client?.embedColor || "#ff0051")
      .setDescription(
        `**${days}, ${hours}, ${minutes}, and ${seconds}**.`);
  
    return message.channel.send({ embeds: [embed] });
  }
};

