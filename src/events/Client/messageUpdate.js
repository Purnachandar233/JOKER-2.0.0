const { scheduleErrorMessageDeletion } = require("../../utils/errorMessageAutoDelete");

module.exports = async (client, _oldMessage, newMessage) => {
  let message = newMessage;

  try {
    if (newMessage?.partial && typeof newMessage.fetch === "function") {
      message = await newMessage.fetch().catch(() => newMessage);
    }
  } catch (_err) {}

  if (!message?.author?.id || message.author.id !== client?.user?.id) return;
  scheduleErrorMessageDeletion(client, message);
};
