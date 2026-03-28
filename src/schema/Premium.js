const mongoose = require("mongoose");

const premiumSchema = new mongoose.Schema({
    Id: { type: String, required: true }, // GuildID or UserID
    Type: { type: String, enum: ['user', 'guild'], required: true },
    Code: { type: String },
    ActivatedBy: { type: String, default: null },
    ActivatedAt: { type: Number, default: Date.now },
    Expire: { type: Number, default: 0 },
    Permanent: { type: Boolean, default: false },
    PlanType: { type: String, default: "Standard" }
});

premiumSchema.index({ Id: 1, Type: 1 }, { unique: true });

module.exports = mongoose.model("Premium", premiumSchema);
