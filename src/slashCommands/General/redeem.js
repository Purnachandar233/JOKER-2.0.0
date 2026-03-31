const legacy = require("../../commands/special/redeem.js");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder.js");

module.exports = {
  name: "redeem",
  description: legacy.description || "Redeem premium code for user or server.",
  options: [
    {
      name: "target",
      description: "Choose where the premium code should be applied",
      required: true,
      type: 3,
      choices: [
        { name: "User", value: "user" },
        { name: "Server", value: "server" },
      ],
    },
    {
      name: "code",
      description: "Premium redeem code",
      required: true,
      type: 3,
    },
  ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to defer reply." });

    try {
      await legacy.execute(interaction, [], client, client.prefix);
    } catch (err) {
      client.logger?.log(`Slash redeem error: ${err && (err.stack || err.toString())}`, "error");
      await interaction.editReply({ content: "An error occurred running this command." }).catch(() => {});
    }
  },
};
