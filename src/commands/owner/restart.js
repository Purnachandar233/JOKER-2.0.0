const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
  name: "restart",
  category: "owner",
  description: "restarts the bot",
  owneronly: true,
  execute: async (message, args, client, prefix) => {
       message.channel.send({content: "Restarting!"})
       setTimeout(() => {
         process.exit();
       }, 2000);
   }
 }

