const mongoose = require("mongoose");

const premiumSchema = new mongoose.Schema({
    Id: { type: String, required: true, unique: true }, // GuildID or UserID
    Type: { type: String, enum: ['user', 'guild'], required: true },
    Code: { type: String },
    ActivatedAt: { type: Number, default: Date.now },
    Expire: { type: Number, default: 0 },
    Permanent: { type: Boolean, default: false },
    PlanType: { type: String, default: "Standard" }
});

module.exports = mongoose.model("Premium", premiumSchema);
