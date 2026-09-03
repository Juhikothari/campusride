// backend/community/community.controller.js
// FIX: getPosts now fetches by college (same as createPost stores it)
//      so posts don't disappear on refresh.
const Post = require('./community.model'); // make sure this path is correct
const User = require('../users/users.model');

// GET /api/community  — list posts for logged-in user's college
exports.getPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('college');
    if (!user?.college) return res.status(400).json({ message: 'College not found for user' });

    const normalizedCollege = user.college.trim().toLowerCase();

    const posts = await Post.find({ college: normalizedCollege })
      .populate('author', 'name college')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/community  — create a post, store college on it
exports.createPost = async (req, res) => {
  try {
    const { content, type, anonymous, attachments } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });

    const user = await User.findById(req.user.userId).select('college');
    if (!user?.college) return res.status(400).json({ message: 'College not found for user' });

    let cleanType = type || 'tip';
    const allowed = ['tip', 'landmark', 'alert', 'walk', 'general', 'question'];
    if (!allowed.includes(cleanType)) cleanType = 'tip';

    const post = new Post({
      author:      req.user.userId,
      college:     user.college.trim().toLowerCase(), // FIX: always stored
      content:     content.trim(),
      type:        cleanType,
      anonymous:   !!anonymous,
      attachments: attachments || [],
    });

    await post.save();
    await post.populate('author', 'name college');
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/community/:id/like
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.likes = (post.likes || 0) + 1;
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/community/:id/reply
exports.addReply = async (req, res) => {
  try {
    const { content, anonymous } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Reply content required' });

    const user = await User.findById(req.user.userId).select('name');
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.replies.push({
      authorId:   req.user.userId,
      authorName: user?.name || 'Unknown',
      content:    content.trim(),
      anonymous:  !!anonymous,
      createdAt:  new Date(),
    });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/community/:id  — delete own post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }
    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
