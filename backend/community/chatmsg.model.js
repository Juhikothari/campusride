const mongoose = require('mongoose');

const chatMsgSchema = new mongoose.Schema({
  college:        { type: String, required: true, index: true },
  sender:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:        { type: String, default: '', maxlength: 500 },
  anonymous:      { type: Boolean, default: false },
  fileAttachment: {
    url:      { type: String },
    name:     { type: String },
    size:     { type: Number },
    fileType: { type: String, default: 'pdf' },
  },
}, { timestamps: true });

module.exports = mongoose.model('ChatMsg', chatMsgSchema);
