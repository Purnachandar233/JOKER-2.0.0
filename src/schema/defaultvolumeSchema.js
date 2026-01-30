const mongoose = require('mongoose');

const Schema = new mongoose.Schema({
    guildID: { type: String, required: true },
    Volume: { type: Number, default: 100 },
}, { timestamps: true });

module.exports = mongoose.model('defaultvolumesg', Schema);
