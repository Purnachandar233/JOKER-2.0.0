const legacy = require("../../commands/general/badges.js");

module.exports = {
  name: "badges",
  description: legacy.description || "Shows all badges and perks.",
  wl: true,
  run: async (client, interaction) => {
    return legacy.execute(interaction, [], client);
  },
};
