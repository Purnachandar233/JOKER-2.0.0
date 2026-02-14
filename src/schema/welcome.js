const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
  guildID: { 
    type: String, 
    required: true, 
    unique: true 
  },
  channelID: { 
    type: String 
  },
  roleID: { 
    type: String 
  },
  message: { 
    type: String, 
    default: 'Welcome {user} to {server}!' 
  },
  enabled: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

module.exports = mongoose.model('welcome', welcomeSchema);
