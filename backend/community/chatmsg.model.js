const mongoose = require('mongoose');

const chatMsgSchema = new mongoose.Schema({
  college:  { type: String, required: true, index: true },
  sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:  { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('ChatMsg', chatMsgSchema);
