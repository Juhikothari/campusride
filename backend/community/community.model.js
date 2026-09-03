// backend/community/community.model.js
// FIX: Added `college` field so posts are scoped per college and
//      don't disappear on refresh (the query now filters by it).
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: '' },
  content:    { type: String, required: true, maxlength: 300 },
  anonymous:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // CRITICAL: Store college so posts can be retrieved without losing them on refresh
  college:     { type: String, required: true, index: true },
  content:     { type: String, required: true, maxlength: 500 },
  type:        { type: String, enum: ['general', 'tip', 'question', 'landmark', 'alert', 'walk'], default: 'general' },
  anonymous:   { type: Boolean, default: false },
  likes:       { type: Number, default: 0 },
  attachments: [{
    url:  { type: String },
    type: { type: String, enum: ['image', 'pdf'] },
    name: { type: String },
  }],
  replies:     [replySchema],
}, { timestamps: true });

module.exports = mongoose.model('CommunityPost', postSchema);
