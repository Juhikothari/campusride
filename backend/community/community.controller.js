// backend/community/community.controller.js
// Scoped per college, supports walk joins with USN, deletes, and replies
const Post = require('./community.model');
const User = require('../users/users.model');

// GET /api/community  — list posts for logged-in user's college
exports.getPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('college');
    if (!user?.college) return res.status(400).json({ message: 'College not found for user' });

    const normalizedCollege = user.college.trim().toLowerCase();

    const posts = await Post.find({ college: normalizedCollege })
      .populate('author', 'name college usn')
      .sort({ createdAt: -1 })
      .limit(100);

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
      college:     user.college.trim().toLowerCase(),
      content:     content.trim(),
      type:        cleanType,
      anonymous:   !!anonymous,
      attachments: attachments || [],
    });

    await post.save();
    await post.populate('author', 'name college usn');
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

    // Notify post author if replied by someone else
    const authorId = post.author?.toString();
    const replierName = anonymous ? 'Someone' : (user?.name || 'A classmate');
    if (authorId && authorId !== req.user.userId.toString()) {
      const io = req.app.get('io');
      if (io) {
        const snippet = content.trim().length > 60 ? `${content.trim().slice(0, 60)}…` : content.trim();
        const notifPayload = {
          title: '💬 New Reply to Your Post',
          message: `${replierName} replied: "${snippet}"`,
          type: 'community-reply',
          postId: post._id,
          createdAt: new Date(),
        };
        io.to(`user-${authorId}`).emit('new-notification', notifPayload);
        io.to(`user-${authorId}`).emit('community-reply', {
          postId: post._id,
          reply: { authorName: replierName, content: content.trim() },
        });
      }
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/community/:id/join-walk  — toggle join walk with USN
exports.toggleJoinWalk = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Walk request not found' });
    if (post.type !== 'walk') return res.status(400).json({ message: 'Can only join walk requests' });

    const user = await User.findById(req.user.userId).select('usn college');
    const userIdStr = req.user.userId.toString();

    if (!post.joinedUsers) post.joinedUsers = [];
    const existingIndex = post.joinedUsers.findIndex(j => j.userId?.toString() === userIdStr);

    let isJoined = false;
    if (existingIndex > -1) {
      post.joinedUsers.splice(existingIndex, 1);
      isJoined = false;
    } else {
      const studentUsn = user?.usn?.trim() || `STU-${userIdStr.slice(-4).toUpperCase()}`;
      post.joinedUsers.push({
        userId: req.user.userId,
        usn: studentUsn,
        joinedAt: new Date(),
      });
      isJoined = true;
    }

    await post.save();
    await post.populate('author', 'name college usn');

    res.json({
      post,
      isJoined,
      joinedCount: post.joinedUsers.length,
      joinedUsers: post.joinedUsers,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/community/:id  — delete own post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const currentUserId = (req.user?.userId || req.user?.id || '').toString();
    const authorId = (post.author?._id || post.author || '').toString();
    const isOwner = authorId === currentUserId;
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }
    await post.deleteOne();
    res.json({ message: 'Post deleted successfully', postId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
