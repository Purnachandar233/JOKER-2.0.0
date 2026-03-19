const mongoose = require('mongoose');

const autoplaySchema = new mongoose.Schema({
    guildID: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    // store requester id instead of full member object
    requesterId: { type: String, default: null },
    identifier: { type: String, default: null },
    // optional fallback query (title + artist) for non-YouTube sources
    query: { type: String, default: null },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Autoplay", autoplaySchema);
