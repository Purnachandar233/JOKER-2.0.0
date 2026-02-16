const { EmbedBuilder } = require("discord.js");
const { createBar } = require('../../functions.js');
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
	name: "grab",
    description: "grab a song to your dms",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock: true,
    wl: true,

    /**
     *
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction) => {
      return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
        await safeReply.safeDeferReply(interaction);

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

        // Run music checks
        const check = await musicChecks.runMusicChecks(client, interaction, {
          inVoiceChannel: true,
          botInVoiceChannel: true,
          sameChannel: true,
          requirePlayer: true,
          requireQueue: true
        });

        if (!check.valid) {
          return await safeReply.safeReply(interaction, { embeds: [check.embed] });
        }

        const player = check.player;
        const tracks = safePlayer.getQueueArray(player);
        const song = tracks[0];

        try {
          let embed = new EmbedBuilder()
            .setTitle("Now playing")
            .addFields([
              { name: 'Song', value: `[${song.info?.title || song.title}](https://discord.gg/pCj2UBbwST)` },
              { name: 'Song By', value: `[${song.info?.author || song.author}]` },
              { name: 'Duration', value: !song.isStream ? `\`${new Date(song.duration).toISOString().slice(11, 19)}\`` : `\`◉ LIVE\`` },
              { name: `Queue length: `, value: `${tracks.length} Songs` },
              { name: `Progress: `, value: createBar(player) }
            ])
            .setColor(interaction.client?.embedColor || '#ff0051');

          await interaction.member.send({ embeds: [embed] }).catch(e => {
            return safeReply.safeReply(interaction, {
              content: `Couldn't send you a DM\n\nPossible reasons:\n- Your DM's are disabled\n- You have me blocked\n\nNone of these helped? Join our [**Support Server**](https://discord.gg/pCj2UBbwST) for more help.`
            });
          });

          await safeReply.safeReply(interaction, { content: "**📪 Check your DM's.**" });

          // Log the command
          client.logger.logCommand('grab', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to grab song: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};

