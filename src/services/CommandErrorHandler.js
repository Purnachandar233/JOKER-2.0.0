const { safeDeferReply } = require("../utils/interactionResponder");
const { handleInteractionCommandError } = require("../utils/errorHandler");

class CommandErrorHandler {
  constructor(client) {
    this.client = client;
  }

  async executeWithErrorHandling(interaction, commandFunction) {
    const startTime = Date.now();
    const commandName = interaction?.commandName || "command";

    try {
      const applicationId =
        interaction?.applicationId ||
        interaction?.application_id ||
        interaction?.client?.application?.id ||
        interaction?.client?.user?.id ||
        null;

      if (!interaction?.token || !applicationId) {
        return { error: "interaction_invalid" };
      }

      if (!interaction.deferred && !interaction.replied) {
        await safeDeferReply(interaction, { ephemeral: false });
      }

      await commandFunction(interaction);

      return { success: true, duration: Date.now() - startTime };
    } catch (error) {
      const duration = Date.now() - startTime;
      const { errorId } = await handleInteractionCommandError(this.client, interaction, error, {
        source: "SlashCommand",
        mode: "slash",
        command: commandName,
        commandLabel: `/${commandName}`,
        durationMs: duration,
      });

      return {
        error: error?.message || String(error),
        errorId,
        duration,
      };
    }
  }
}

module.exports = CommandErrorHandler;
