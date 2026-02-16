const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "duel",
  category: "fun",
  description: "Battle another player in a duel!",
  execute: async (message, args, client) => {
    const opponentUser = message.mentions.users.first();

    if (!opponentUser) {
      return message.reply("Please mention a player to duel! Example: `=duel @user`");
    }

    if (opponentUser.id === message.author.id) {
      return message.reply("You cannot duel yourself.");
    }

    if (opponentUser.bot && opponentUser.id !== client.user.id) {
      return message.reply("You can only duel real users or me.");
    }

    const player1 = { user: message.author, hp: 100, maxHp: 100 };
    const player2 = { user: opponentUser, hp: 100, maxHp: 100 };
    let currentTurn = player1;

    const actions = [
      { name: "Attack", damage: () => Math.floor(Math.random() * 25) + 10 },
      { name: "Defend", damage: () => Math.floor(Math.random() * 5) },
      { name: "Critical", damage: () => (Math.random() > 0.5 ? Math.floor(Math.random() * 35) + 20 : 5) }
    ];

    const getHealthBar = (hp, maxHp) => {
      const filledBars = Math.floor((hp / maxHp) * 10);
      const emptyBars = 10 - filledBars;
      return `${"#".repeat(filledBars)}${"-".repeat(emptyBars)} ${hp}/${maxHp}`;
    };

    const createDuelEmbed = (description = "") => new EmbedBuilder()
      .setColor(client.embedColor || "#ff0000")
      .setTitle("Duel")
      .addFields(
        { name: `${player1.user.username} (P1)`, value: getHealthBar(player1.hp, player1.maxHp), inline: false },
        { name: `${player2.user.username} (P2)`, value: getHealthBar(player2.hp, player2.maxHp), inline: false },
        { name: "Current Turn", value: `${currentTurn.user.username}'s turn`, inline: false }
      )
      .setDescription(description || "Choose your action.");

    const createActionButtons = () => {
      const row = new ActionRowBuilder();
      actions.forEach((action, index) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_${index}`)
            .setLabel(action.name)
            .setStyle(ButtonStyle.Danger)
        );
      });
      return row;
    };

    const duelMsg = await message.channel.send({
      embeds: [createDuelEmbed()],
      components: [createActionButtons()]
    });

    const collector = duelMsg.createMessageComponentCollector({
      filter: i => i.customId.startsWith("duel_"),
      time: 120000
    });

    let turnLog = "";

    collector.on("collect", async interaction => {
      if (interaction.user.id !== player1.user.id && interaction.user.id !== player2.user.id) {
        await interaction.reply({ content: "You are not part of this duel.", ephemeral: true }).catch(() => {});
        return;
      }

      if (interaction.user.id !== currentTurn.user.id) {
        await interaction.reply({ content: `It is ${currentTurn.user.username}'s turn.`, ephemeral: true }).catch(() => {});
        return;
      }

      const actionIndex = Number.parseInt(interaction.customId.split("_")[1], 10);
      if (Number.isNaN(actionIndex) || actionIndex < 0 || actionIndex >= actions.length) {
        await interaction.reply({ content: "Invalid action.", ephemeral: true }).catch(() => {});
        return;
      }

      const action = actions[actionIndex];
      const damage = action.damage();
      const target = currentTurn === player1 ? player2 : player1;

      target.hp = Math.max(0, target.hp - damage);
      turnLog = `**${currentTurn.user.username}** used **${action.name}** and dealt **${damage}** damage.`;

      if (target.hp === 0) {
        const winEmbed = new EmbedBuilder()
          .setColor(client.embedColor || "#ff0011")
          .setTitle("Duel Victory")
          .setDescription(`${currentTurn.user.username} wins the duel.`)
          .addFields(
            { name: `${player1.user.username} (P1)`, value: getHealthBar(player1.hp, player1.maxHp), inline: false },
            { name: `${player2.user.username} (P2)`, value: getHealthBar(player2.hp, player2.maxHp), inline: false },
            { name: "Last Action", value: turnLog, inline: false }
          );

        await interaction.update({ embeds: [winEmbed], components: [] }).catch(() => {});
        collector.stop("completed");
        return;
      }

      currentTurn = target;
      await interaction.update({
        embeds: [createDuelEmbed(turnLog)],
        components: [createActionButtons()]
      }).catch(() => {});
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "time" && player1.hp > 0 && player2.hp > 0) {
        await duelMsg.edit({ content: "Duel ended due to inactivity.", components: [] }).catch(() => {});
      }
    });
  }
};
