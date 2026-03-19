const mongoose = require('mongoose');

const GuildFilters = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  filters: {
    slowmo: { type: Boolean, default: false },
    chipmunk: { type: Boolean, default: false },
    tremolo: { type: Boolean, default: false },
    vaporwave: { type: Boolean, default: false },
    vibrato: { type: Boolean, default: false },
    trebblebass: { type: Boolean, default: false },
    soft: { type: Boolean, default: false },
    bassboost: { type: Boolean, default: false },
    nightcore: { type: Boolean, default: false },
    karaoke: { type: Boolean, default: false },
    pop: { type: Boolean, default: false },
    reset: { type: Boolean, default: false },
    // Add other filters as needed
  }
}, { timestamps: true });

module.exports = mongoose.model('GuildFilters', GuildFilters);
