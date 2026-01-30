const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const load = require('lodash');

module.exports = {
  name: 'topsecret',
  category: 'owner',
  description: 'Shows the server list (Owner Only)',
  aliases: ['sl'],
  args: false,
  usage: '<string>',
  permission: [],
  owneronly: true,

  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const serverlist = client.guilds.cache.map(
      (guild, i) => `\` ${guild.name}\` | \`[ ${guild.id} ]\` | \`[${guild.memberCount}]\``,
    );
    const mapping = load.chunk(serverlist, 10);
    const pages = mapping.map((s) => s.join('\n'));
    let page = 0;

    const embed2 = new EmbedBuilder()
      .setColor(0xff0051)
      .setDescription(pages[page])

      .setFooter({
        text: `Page ${page + 1}/${pages.length}`,
        iconURL: message.author.displayAvatarURL({ forceStatic: false }),
      })
      .setTitle(`${message.client.user.username} serverlist`);

    const but1 = new ButtonBuilder()
      .setCustomId('queue_cmd_but_1')
      .setEmoji('⏭️')
      .setStyle(1);

    const but2 = new ButtonBuilder()
      .setCustomId('queue_cmd_but_2')
      .setEmoji('⏮️')
      .setStyle(1);

    const but3 = new ButtonBuilder()
      .setCustomId('queue_cmd_but_3')
      .setEmoji('⏹️')
      .setStyle(4);

    const row1 = new ActionRowBuilder().addComponents([but2, but3, but1]);

    const msg = await message.channel.send({
      embeds: [embed2],
      components: [row1],
    });

    const collector = message.channel.createMessageComponentCollector({
      filter: (b) => {
        if (b.user.id === message.author.id) return true;
        else {
          b.reply({
            flags: [64],
            content: `Only **${message.author.tag}** can use this button, if you want then you've to run the command again.`,
          });
          return false;
        }
      },
      time: 60000 * 5,
      idle: 30e3,
    });

    collector.on('collect', async (button) => {
      if (button.customId === 'queue_cmd_but_1') {
        await button.deferUpdate().catch(() => {});
        page = page + 1 < pages.length ? ++page : 0;

        const embed3 = new EmbedBuilder()
          .setColor(0xff0051)
          .setDescription(pages[page])

          .setFooter({
            text: `Page ${page + 1}/${pages.length}`,
            iconURL: message.author.displayAvatarURL({ forceStatic: false }),
          })
          .setTitle(`${message.client.user.username} serverlist`);

        await msg.edit({
          embeds: [embed3],
          components: [row1],
        });
      } else if (button.customId === 'queue_cmd_but_2') {
        await button.deferUpdate().catch(() => {});
        page = page > 0 ? --page : pages.length - 1;

        const embed4 = new EmbedBuilder()
          .setColor(0xff0051)
          .setDescription(pages[page])

          .setFooter({
            text: `Page ${page + 1}/${pages.length}`,
            iconURL: message.author.displayAvatarURL({ forceStatic: false }),
          })
          .setTitle(`${message.client.user.username} serverlist`);

        await msg
          .edit({
            embeds: [embed4],
            components: [row1],
          })
          .catch(() => {});
      } else if (button.customId === 'queue_cmd_but_3') {
        await button.deferUpdate().catch(() => {});
        collector.stop();
      } else return;
    });

    collector.on('end', async () => {
      await msg.edit({
        components: [],
      });
    });
  },
};