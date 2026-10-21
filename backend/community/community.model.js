// backend/community/community.model.js
// Scoped per college, supports walk together joined students with USN
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: '' },
  content:    { type: String, required: true, maxlength: 300 },
  anonymous:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});

const joinedUserSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:     { type: String, default: '' },
  usn:      { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  college:     { type: String, required: true, index: true },
  content:     { type: String, required: true, maxlength: 500 },
  type:        { type: String, enum: ['general', 'tip', 'question', 'landmark', 'alert', 'walk'], default: 'general' },
  anonymous:   { type: Boolean, default: false },
  likes:       { type: Number, default: 0 },
  likedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attachments: [{
    url:  { type: String },
    type: { type: String, enum: ['image', 'pdf'] },
    name: { type: String },
  }],
  replies:     [replySchema],
  joinedUsers: [joinedUserSchema],
}, { timestamps: true });

module.exports = mongoose.model('CommunityPost', postSchema);
