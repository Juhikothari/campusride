const mongoose = require('mongoose');

const chatMsgSchema = new mongoose.Schema({
  college:   { type: String, required: true, index: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:   { type: String, required: true, maxlength: 500 },
  anonymous: { type: Boolean, default: false },   // ← NEW
}, { timestamps: true });

module.exports = mongoose.model('ChatMsg', chatMsgSchema);
