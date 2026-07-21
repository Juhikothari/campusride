const CommunityPost = require('./community.model');
const User = require('../users/users.model');

// ── GET posts for the requesting user's college ───────────────────
const getPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('college');
    if (!user || !user.college) {
      return res.status(400).json({ message: 'College not found for this user' });
    }

    const posts = await CommunityPost.find({
      college: { $regex: new RegExp(`^${user.college.trim()}$`, 'i') }
    })
      .populate('author', 'name college')
      .sort({ createdAt: -1 })
      .limit(100);

    // For anonymous posts, strip the author name before sending
    const sanitized = posts.map(p => {
      const obj = p.toObject();
      if (obj.anonymous) {
        obj.author = null;  // hide author identity
      }
      // Sanitize anonymous replies too
      obj.replies = obj.replies.map(r => ({
        ...r,
        authorName: r.anonymous ? 'Anonymous' : r.authorName
      }));
      return obj;
    });

    res.json(sanitized);
  } catch (err) {
    console.error('getPosts error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE a new post ─────────────────────────────────────────────
const createPost = async (req, res) => {
  try {
    const { content, type, anonymous, attachments } = req.body;

    const user = await User.findById(req.user.userId).select('name college');
    if (!user || !user.college) {
      return res.status(400).json({ message: 'College not found for this user' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const post = await CommunityPost.create({
      author:      req.user.userId,
      college:     user.college,
      type:        type || 'tip',
      content:     content.trim(),
      anonymous:   !!anonymous,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const populated = await CommunityPost.findById(post._id).populate('author', 'name college');
    const obj = populated.toObject();

    // Strip author identity if anonymous before broadcasting
    const payload = obj.anonymous ? { ...obj, author: null } : obj;

    const io = req.app.get('io');
    if (io) {
      const collegeRoom = `college-${user.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      io.to(collegeRoom).emit('new-community-post', payload);
    }

    res.status(201).json(payload);
  } catch (err) {
    console.error('createPost error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── TOGGLE like ───────────────────────────────────────────────────
const toggleLike = async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.userId;
    const alreadyLiked = post.likedBy.some(id => id.toString() === userId);

    if (alreadyLiked) {
      post.likedBy.pull(userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }
    await post.save();
    res.json({ likes: post.likes, liked: !alreadyLiked });
  } catch (err) {
    console.error('toggleLike error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── ADD a reply ───────────────────────────────────────────────────
const addReply = async (req, res) => {
  try {
    const { content, anonymous } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const user = await User.findById(req.user.userId).select('name college');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Enforce same-college for replies
    if (user.college?.trim().toLowerCase() !== post.college?.trim().toLowerCase()) {
      return res.status(403).json({ message: 'You can only reply to posts from your college' });
    }

    const reply = {
      author:     req.user.userId,
      authorName: !!anonymous ? 'Anonymous' : user.name,
      anonymous:  !!anonymous,
      content:    content.trim(),
      createdAt:  new Date()
    };

    post.replies.push(reply);
    await post.save();

    const saved = post.replies[post.replies.length - 1];

    const io = req.app.get('io');
    if (io) {
      const collegeRoom = `college-${post.college.trim().toLowerCase().replace(/\s+/g, '-')}`;
      io.to(collegeRoom).emit('new-community-reply', { postId: post._id, reply: saved });
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('addReply error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPosts, createPost, toggleLike, addReply };
