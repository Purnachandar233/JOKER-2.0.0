const mongoose = require("mongoose");

const premiumUserSchema = new mongoose.Schema({
    UserID: { type: String, required: true, unique: true },
    Expire: { type: Number, required: true },
    Permanent: { type: Boolean, default: false },
});

module.exports = mongoose.model("premium-user", premiumUserSchema);
