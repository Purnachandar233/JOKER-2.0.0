const { Schema, model } = require("mongoose");

const PremiumSchema = new Schema({
  Usage: Number,
  Code: String,
  Expiry: Number,
  Permanent: { type: Boolean, default: false }
});

module.exports = model("redeemCodes", PremiumSchema);