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
    const queryFilter = { college: normalizedCollege };

    // If 'walk' requested, filter to walk only; if not specified or 'community', exclude walk posts
    if (req.query.type === 'walk') {
      queryFilter.type = 'walk';
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      queryFilter.createdAt = { $gte: twentyFourHoursAgo };
    } else if (req.query.type !== 'all') {
      queryFilter.type = { $ne: 'walk' };
    }

    const posts = await Post.find(queryFilter)
      .populate('author', 'name college usn')
      .populate('joinedUsers.userId', 'name college')
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

// POST / PATCH /api/community/:id/like - Track likes with toggle support
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (!post.likedBy) post.likedBy = [];
    const uid = req.user?.userId || req.user?.id || req.user?._id;
    const userIdStr = (uid || '').toString();
    const existingIdx = post.likedBy.findIndex(id => (id._id || id).toString() === userIdStr);
    let userLiked = false;

    if (existingIdx >= 0) {
      post.likedBy.splice(existingIdx, 1);
      post.likes = Math.max(0, (post.likes || 1) - 1);
      userLiked = false;
    } else {
      if (uid) post.likedBy.push(uid);
      post.likes = (post.likes || 0) + 1;
      userLiked = true;
    }

    await post.save();
    res.json({ likes: post.likes, liked: userLiked, likedBy: post.likedBy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/community/:id/reply - Only notifies post author (never the commenter)
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
    await post.populate('author', 'name college usn');

    // Notify post author and prior commenters
    const authorId = (post.author?._id || post.author || '').toString();
    const currentUserId = (req.user?.userId || req.user?.id || '').toString();
    const replierName = anonymous ? 'Someone' : (user?.name || 'A classmate');
    const snippet = content.trim().length > 60 ? `${content.trim().slice(0, 60)}…` : content.trim();

    const usersToNotify = new Map(); // userId -> { isAuthor: boolean }
    if (authorId && authorId !== currentUserId) {
      usersToNotify.set(authorId, { isAuthor: true });
    }
    (post.replies || []).forEach(r => {
      const commenterId = (r.authorId?._id || r.authorId || '').toString();
      if (commenterId && commenterId !== currentUserId && !usersToNotify.has(commenterId)) {
        usersToNotify.set(commenterId, { isAuthor: false });
      }
    });

    const Notification = require('../notifications/notifications.model');
    const io = req.app.get('io') || global.io;

    for (const [targetUserId, info] of usersToNotify.entries()) {
      const title = info.isAuthor ? '💬 New Reply to Your Post' : '💬 New Reply in Conversation';
      const body = `${replierName} replied: "${snippet}"`;

      try {
        await Notification.create({
          userId: targetUserId,
          userType: 'user',
          type: 'community-reply',
          title,
          body,
          data: { postId: post._id },
          priority: 'medium',
          channels: ['in_app', 'push', 'socket'],
        });
      } catch (notifErr) {
        console.log('[Community] Save notification error:', notifErr.message);
      }

      if (io) {
        const notifPayload = {
          title,
          message: body,
          type: 'community-reply',
          postId: post._id,
          authorId: targetUserId,
          createdAt: new Date(),
        };
        // Emit only community-reply to avoid duplicate notifications on client
        io.to(`user-${targetUserId}`).emit('community-reply', notifPayload);
      }
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/community/:id/reply/:replyId - Delete comment on post
exports.deleteReply = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const reply = post.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Comment not found' });

    const currentUserId = (req.user?.userId || req.user?.id || '').toString();
    const isReplyAuthor = (reply.authorId?._id || reply.authorId || '').toString() === currentUserId;
    const isPostAuthor  = (post.author?._id || post.author || '').toString() === currentUserId;
    const isAdmin       = req.user?.role === 'admin';

    if (!isReplyAuthor && !isPostAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    post.replies.pull(req.params.replyId);
    await post.save();
    await post.populate('author', 'name college usn');
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

    const user = await User.findById(req.user.userId).select('name usn college');
    const userIdStr = req.user.userId.toString();

    if (!post.joinedUsers) post.joinedUsers = [];
    const existingIndex = post.joinedUsers.findIndex(j => (j.userId?.toString() === userIdStr || j.userId?._id?.toString() === userIdStr));

    let isJoined = false;
    if (existingIndex > -1) {
      post.joinedUsers.splice(existingIndex, 1);
      isJoined = false;
    } else {
      const studentName = user?.name?.trim() || 'Verified Student';
      const studentUsn = user?.usn?.trim() || `STU-${userIdStr.slice(-4).toUpperCase()}`;
      post.joinedUsers.push({
        userId: req.user.userId,
        name: studentName,
        usn: studentUsn,
        joinedAt: new Date(),
      });
      isJoined = true;
    }

    await post.save();
    await post.populate('author', 'name college usn');
    await post.populate('joinedUsers.userId', 'name college');

    // Notify walk post author when someone joins
    const authorId = (post.author?._id || post.author || '').toString();
    if (isJoined && authorId && authorId !== userIdStr) {
      const io = req.app.get('io');
      const studentName = user?.name?.trim() || 'A verified student';
      const notifPayload = {
        title: '🚶 Someone Joined Your Walk Together!',
        message: `${studentName} just joined your walk companion request!`,
        type: 'walk-join',
        postId: post._id,
        createdAt: new Date(),
      };

      // Save notification to DB if model is available
      try {
        const Notification = require('../notifications/notifications.model');
        if (Notification) {
          await Notification.create({
            userId: authorId,
            type: 'WALK_JOIN',
            title: notifPayload.title,
            body: notifPayload.message,
            data: { postId: post._id },
          });
        }
      } catch (e) {
        // notification save is non-blocking
      }

      if (io) {
        io.to(`user-${authorId}`).emit('new-notification', notifPayload);
        io.to(`user-${authorId}`).emit('walk-joined', {
          postId: post._id,
          name: studentName,
          usn: user?.usn?.trim(),
          joinedCount: post.joinedUsers.length,
        });
      }
    }

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
