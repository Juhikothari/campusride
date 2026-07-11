const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  college: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['tip', 'landmark', 'alert'],
    default: 'tip'
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  anonymous: {
    type: Boolean,
    default: false
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName:{ type: String },
    anonymous: { type: Boolean, default: false },
    content:   { type: String, required: true, maxlength: 300 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('CommunityPost', communityPostSchema);
