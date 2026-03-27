const { ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

function getAuthor(ctx) {
  return ctx?.author || ctx?.user || null;
}

function getOpponent(ctx, args, client) {
  if (isInteraction(ctx)) {
    const optionUser = ctx.options?.getUser?.("opponent");
    if (optionUser) return optionUser;
  }

  const users = ctx?.mentions?.users;
  if (users?.first) return users.first() || (args[0] ? client.users.cache.get(args[0]) : null);
  if (users instanceof Map) return users.values().next().value || (args[0] ? client.users.cache.get(args[0]) : null);
  return args[0] ? client.users.cache.get(args[0]) : null;
}

async function sendResponse(ctx, payload) {
  const normalized = typeof payload === "string" ? { content: payload } : { ...(payload || {}) };
  const usesComponentsV2 = Array.isArray(normalized.components) && normalized.components.some((component) => {
    const type = component?.data?.type || component?.toJSON?.().type || null;
    return type !== 1;
  });

  if (usesComponentsV2 && normalized.flags == null) {
    normalized.flags = MessageFlags.IsComponentsV2;
  }

  if (isInteraction(ctx)) {
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(normalized);
}

function withActionRows(container, ...rows) {
  for (const row of rows.flat().filter(Boolean)) {
    container.addActionRowComponents(row);
  }
  return container;
}

module.exports = {
  name: "duel",
  category: "fun",
  description: "Battle another player in an epic duel!",
  execute: async (ctx, args, client) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const opponentUser = getOpponent(ctx, args, client);
    if (!opponentUser) {
      return sendResponse(ctx, "Please mention a player to duel! Example: `=duel @user`");
    }
    if (opponentUser.id === author.id) {
      return sendResponse(ctx, "You cannot duel yourself.");
    }

    const player1 = { user: author, hp: 100, maxHp: 100 };
    const player2 = { user: opponentUser, hp: 100, maxHp: 100 };
    let currentTurn = player1;

    const actions = [
      { name: "⚔️ Attack", id: "attack", damage: () => Math.floor(Math.random() * 25) + 10 },
      { name: "🛡️ Defend", id: "defend", damage: () => Math.floor(Math.random() * 5) },
      { name: "💥 Critical", id: "critical", damage: () => (Math.random() > 0.5 ? Math.floor(Math.random() * 35) + 20 : 5) }
    ];

    const getHealthBar = (hp, maxHp) => {
      const percentage = Math.round((hp / maxHp) * 100);
      const filled = Math.floor((hp / maxHp) * 10);
      const empty = 10 - filled;
      return `${"██".repeat(filled)}${"░░".repeat(empty)} ${hp}/${maxHp} (${percentage}%)`;
    };

    const createDuelPanel = (statusMessage = "") => {
      const container = new ContainerBuilder().setAccentColor(0xff0000);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ⚔️ DUEL\n${player1.user.username} vs ${player2.user.username}`),
        new TextDisplayBuilder().setContent(
          `**${player1.user.username}** (P1)\n${getHealthBar(player1.hp, player1.maxHp)}\n\n` +
          `**${player2.user.username}** (P2)\n${getHealthBar(player2.hp, player2.maxHp)}`
        ),
        new TextDisplayBuilder().setContent(`${"─".repeat(30)}\n**${currentTurn.user.username}'s Turn**\n${statusMessage}`)
      );
      return container;
    };

    const createActionButtons = () => {
      const row = new ActionRowBuilder();
      actions.forEach((action) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_${action.id}`)
            .setLabel(action.name)
            .setStyle(ButtonStyle.Danger)
        );
      });
      return row;
    };

    const gameMsg = await sendResponse(ctx, {
      components: [withActionRows(createDuelPanel("Choose your action..."), createActionButtons())]
    });
    if (!gameMsg) return null;

    const playTurn = () => new Promise((resolve) => {
      const filter = (i) => i.customId.startsWith("duel_") && i.user.id === currentTurn.user.id;
      const collector = gameMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on("collect", async (interaction) => {
        const actionId = interaction.customId.split("_")[1];
        const action = actions.find((a) => a.id === actionId);
        const damage = action.damage();
        const opponent = currentTurn === player1 ? player2 : player1;

        opponent.hp = Math.max(0, opponent.hp - damage);

        let resultMessage = `🎯 **${currentTurn.user.username}** used **${action.name}**!\n`;
        resultMessage += damage > 0 ? `💥 Dealt **${damage}** damage!` : "Miss!";

        await interaction.deferUpdate().catch(() => {});
        await gameMsg.edit({ components: [withActionRows(createDuelPanel(resultMessage), createActionButtons())] }).catch(() => {});
        resolve();
      });

      collector.on("end", () => resolve());
    });

    while (player1.hp > 0 && player2.hp > 0) {
      currentTurn = player1;
      await playTurn();
      if (player2.hp <= 0) break;

      currentTurn = player2;
      await playTurn();
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const winner = player1.hp > 0 ? player1.user : player2.user;
    const container = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🏆 VICTORY\n**${winner.username}** wins the duel!`),
        new TextDisplayBuilder().setContent(`**${player1.user.username}**: ${player1.hp} HP\n**${player2.user.username}**: ${player2.hp} HP`)
      );

    await gameMsg.edit({ components: [container] }).catch(() => {});
    return null;
  }
};
