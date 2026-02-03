const User = require('../../schema/User.js');
const Premium = require("../../schema/Premium.js");
const blacklist = require("../../schema/blacklistSchema.js");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");
const db = require('../../schema/prefix.js');

module.exports = async (client, message) => {
  if (!message.guild || !message.guild.id || message.author.bot) return;

  const Owners = [client.config.ownerId];

  let prefix;
  try {
    let data = await db.findOne({ Guild: message.guild.id });
    prefix = data?.Prefix || client.prefix;
  } catch (err) {
    client.logger?.log(`Prefix lookup error: ${err.message}`, 'warn');
    prefix = client.prefix;
  }

  const mention = new RegExp(`^<@!?${client.user.id}>( |)$`);
  if (message.content.match(mention)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Invite").setStyle(5).setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`),
      new ButtonBuilder().setLabel("Support").setStyle(5).setURL(`https://discord.gg/JQzBqgmwFm`)
    );
    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || '#ff0051')
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
      .setDescription(`Joker Music is a high-quality  music bot built for high quallity music and stability . It is user friendly, low-latency audio and supports dreezer, Spotify,applemusic, SoundCloud and playlists. Features include advanced audio filters\n\nMy Prefix is: \`${prefix}\` \n\nType \`${prefix}help or /help\` to see commands.`);
    return message.channel.send({ embeds: [embed], components: [row] });
  }

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`); 
  const mentionprefix = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})`);
  if (!mentionprefix.test(message.content)) return;

  const matchedContent = message.content.match(mentionprefix)[0];
  const args = message.content.slice(matchedContent.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  
  const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));

  if (!command) return;

  let user = await User.findOne({ userId: message.author.id }).catch(() => null);
  if (!user) {
    try {
      user = await User.create({ userId: message.author.id });
    } catch (err) {
      client.logger?.log(`User creation error: ${err.message}`, 'warn');
    }
  }
  if (user) {
    user.count = (user.count || 0) + 1;
    await user.save().catch(() => {});
  }

  if (command.owneronly && !Owners.includes(message.author.id)) {
    // Silent rejection: do not send any message or grant access
    return;
  }

  // DJ role validation
  if (command.djonly) {
    const djSchema = require('../../schema/djroleSchema.js');
    try {
      let djdata = await djSchema.findOne({ guildID: message.guild.id }).catch(() => null);
      if (djdata && djdata.Roleid) {
        if (!message.member.roles.cache.has(djdata.Roleid)) {
          const embed = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setDescription(`This command requires you to have the DJ role.`);
          return message.channel.send({ embeds: [embed] });
        }
      } else {
        // No DJ role configured, only allow owner
        if (!Owners.includes(message.author.id)) {
          const embed = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setDescription(`No DJ role configured. Contact server owner.`);
          return message.channel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      client.logger?.log(`DJ role check error: ${err.message}`, 'error');
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setDescription(`Error checking DJ permissions. Please try again.`);
      return message.channel.send({ embeds: [embed] });
    }
  }

  if (command.premium) {
    const pUser = await Premium.findOne({ Id: message.author.id, Type: 'user' });
    const pGuild = await Premium.findOne({ Id: message.guild.id, Type: 'guild' });
    
    // Check if user premium is valid
    const isUserPremium = pUser && (pUser.Permanent || pUser.Expire > Date.now());
    // Check if guild premium is valid
    const isGuildPremium = pGuild && (pGuild.Permanent || pGuild.Expire > Date.now());
    
    // Clean up expired premium if found
    if (pUser && !pUser.Permanent && pUser.Expire <= Date.now()) {
        await pUser.deleteOne();
    }
    if (pGuild && !pGuild.Permanent && pGuild.Expire <= Date.now()) {
        await pGuild.deleteOne();
    }
    
    let isVoted = false;
    if (client.topgg && client.topgg.hasVoted) {
        try {
          isVoted = await client.topgg.hasVoted(message.author.id);
        } catch (e) {
          try { client.logger?.log(`Top.gg Vote Check Error: ${e && (e.stack || e.toString())}`, 'warn'); } catch (err) { console.log("Top.gg Vote Check Error:", e); }
        }
    }

    if (!isUserPremium && !isGuildPremium && !isVoted) {
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setAuthor({ name: "Premium Required", iconURL: client.user.displayAvatarURL() })
        .setDescription(`✧ This command requires a **Premium Subscription** or a **Vote** on [Top.gg](https://top.gg/bot/${client.user.id}/vote).`);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Vote Me").setStyle(5).setURL(`https://top.gg/bot/${client.user.id}/vote`),
        new ButtonBuilder().setLabel("Get Premium").setStyle(5).setURL(`https://discord.com/invite/JQzBqgmwFm`)
      );

      return message.channel.send({ embeds: [embed], components: [row] });
    }
  }

  try {
    command.execute(message, args, client, prefix);
  } catch (error) {
    client.logger?.log(`Command execution error: ${error?.message}`, 'error');
    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || '#ff0051')
      .setDescription(`❌ Error executing command: ${error?.message || 'Unknown error'}`);
    try {
      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (replyErr) {
      client.logger?.log(`Failed to reply error: ${replyErr.message}`, 'error');
    }
  }
};