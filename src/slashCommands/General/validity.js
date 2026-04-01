const legacy = require("../../commands/general/validity.js");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder.js");

module.exports = {
  name: "validity",
  description: legacy.description || "Check premium validity for user or server.",
  options: [
    {
      name: "target",
      description: "Choose whether to check user or server premium",
      required: true,
      type: 3,
      choices: [
        { name: "User", value: "user" },
        { name: "Server", value: "server" },
      ],
    },
    {
      name: "user",
      description: "User to check when target is user",
      required: false,
      type: 6,
    },
  ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to defer reply." });

    try {
      await legacy.execute(interaction, [], client, client.prefix);
    } catch (err) {
      client.logger?.log(`Slash validity error: ${err && (err.stack || err.toString())}`, "error");
      await interaction.editReply({ content: "An error occurred running this command." }).catch(() => {});
    }
  },
};
