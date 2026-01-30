const mongoose = require('mongoose');

const autoplaySchema = new mongoose.Schema({
    guildID: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    requester: { type: Object, default: null },
    identifier: { type: String, default: null },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Autoplay", autoplaySchema);
