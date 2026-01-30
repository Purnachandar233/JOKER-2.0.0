// user schema for badges
const mongoose = require('mongoose')
const User = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    voted: { type: Boolean, default: false },
    badge: {
        dev: { type: Boolean, default: false },
        owner: { type: Boolean, default: false },
        supporter: { type: Boolean, default: false },
        bug: { type: Boolean, default: false },
        premium: { type: Boolean, default: false },
        partner: { type: Boolean, default: false },
        staff: { type: Boolean, default: false },
        manager: { type: Boolean, default: false },
        booster: { type: Boolean, default: false },
        vip: { type: Boolean, default: false },
    }
}, { timestamps: true });

module.exports = mongoose.model("user", User)
