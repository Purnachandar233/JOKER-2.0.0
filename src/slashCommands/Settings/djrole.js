const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "djrole",
    description: "Enable or disable the DJ role.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock : true,
    wl : true,
    options: [
        {
          name: "role",
          description: "role for DJ",
          required: true,
          type: 8
          }
      ],
      votelock: true,


    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

     run: async (client, interaction) => {
        await interaction.deferReply({
          ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
        if (!interaction.member.permissions.has('MANAGE_ROLES')) {
            const noperms = new EmbedBuilder()
           .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`You need this required Permissions: \`MANAGE_ROLES\` to run this command.`)
           return await interaction.editReply({embeds: [noperms]});
        }
        const role = interaction.options.getRole("role");
        if (!role) {
            const noperms = new EmbedBuilder()
           .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`Please provide a valid role.`)
           return await interaction.editReply({embeds: [noperms]});
        }
        const dSchema = require('../../schema/djroleSchema.js');
        try {
            await dSchema.findOneAndUpdate(
                { guildID: interaction.guild.id },
                { $set: { Roleid: role.id } },
                { upsert: true, new: true }
            );
        } catch(err) {
            try { client.logger?.log(err && (err.stack || err.toString()), 'error'); } catch (e) { console.log(err); }
        }
        const embed = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
             .setDescription(`${ok} DJ role mode is now **enabled** and set to <@&${role.id}>.`)
             return await interaction.editReply({ embeds : [embed]})
       }
     };