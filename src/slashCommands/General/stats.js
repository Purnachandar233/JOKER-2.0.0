const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
const { mem, cpu, os } = require('node-os-utils');
const { stripIndent } = require('common-tags');
const bytes = require("bytes");

module.exports = {
  name: "stats",
  description: "Returns the stats of the bot",
  owneronly: false,
  wl: true,
  type: ApplicationCommandType.ChatInput,
  run: async (client, interaction) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const servers = client.cluster ? (await client.cluster.fetchClientValues('guilds.cache.size')).reduce((prev, val) => prev + val, 0) : client.guilds.cache.size;
    const users = client.cluster ? (await client.cluster.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))).reduce((acc, memberCount) => acc + memberCount, 0) : interaction.guild.memberCount;

    const memusage = process.memoryUsage();
    const { usedMemMb } = await mem.info().catch(() => ({ usedMemMb: 0 }));

    const clmao = stripIndent`
      Total Servers       :: ${servers} guilds
      Total Users         :: ${users} users
      Ping                :: ${client.ws.ping}ms
      Used Memory         :: ${Math.round(memusage.heapUsed / 1024 / 1024)}mb
      System Used         :: ${bytes(bytes(`${usedMemMb}MB`))}
      Platform            :: ${process.platform}
    `;

    const statsEmbed = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setAuthor({ 
        name: `Joker Music Stats`, 
        iconURL: interaction.member.user.displayAvatarURL({ forceStatic: false }) 
      })
      .setDescription(`\`\`\`asciidoc\n${clmao}\n\`\`\``);

    return interaction.editReply({ embeds: [statsEmbed] });
  },
};