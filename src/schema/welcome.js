const mongoose = require("mongoose");

const welcomeSchema = new mongoose.Schema(
  {
    guildID: {
      type: String,
      required: true,
      unique: true
    },
    channelID: {
      type: String,
      default: null
    },
    roleID: {
      type: String,
      default: null
    },
    message: {
      type: String,
      default: "Welcome {user} to {server}!"
    },
    title: {
      type: String,
      default: "Welcome!"
    },
    embedColor: {
      type: String,
      default: null
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("welcome", welcomeSchema);
