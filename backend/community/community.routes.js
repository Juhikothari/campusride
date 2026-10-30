// backend/community/community.routes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getPosts, createPost, toggleLike, addReply, deleteReply, deletePost, toggleJoinWalk,
} = require('./community.controller');

router.get('/',               auth, getPosts);
router.get('/posts',          auth, getPosts);
router.post('/',              auth, createPost);
router.post('/posts',         auth, createPost);
router.patch('/:id/like',     auth, toggleLike);
router.post('/:id/like',      auth, toggleLike);
router.post('/posts/:id/like',auth, toggleLike);
router.post('/:id/reply',     auth, addReply);
router.post('/posts/:id/reply', auth, addReply);
router.delete('/:id/reply/:replyId', auth, deleteReply);
router.delete('/posts/:id/reply/:replyId', auth, deleteReply);
router.post('/:id/join-walk', auth, toggleJoinWalk);
router.post('/posts/:id/join-walk', auth, toggleJoinWalk);
router.delete('/:id',         auth, deletePost);
router.delete('/posts/:id',   auth, deletePost);

// ── Chat messages (college-scoped) ────────────────────────────────
const handleGetChatMessages = async (req, res) => {
  try {
    const User    = require('../users/users.model');
    const ChatMsg = require('./chatmsg.model');

    const user = await User.findById(req.user.userId).select('college role');
    const collegeParam = req.params?.college ? decodeURIComponent(req.params.college).trim().toLowerCase() : (user?.college || '').trim().toLowerCase();
    if (!collegeParam) return res.status(400).json({ message: 'College not found' });

    const messages = await ChatMsg
      .find({ college: collegeParam })
      .populate('sender', 'name usn role')
      .sort({ createdAt: 1 })
      .limit(100);

    const isAdmin = user?.role === 'admin';
    const result = messages.map(m => {
      const obj = m.toObject();
      const isAnon = !!obj.anonymous;
      return {
        _id: obj._id,
        senderId: isAnon ? null : (obj.sender?._id || obj.sender),
        senderName: isAnon ? 'Anonymous' : (obj.sender?.name || 'User'),
        senderUsn: isAnon ? '' : (obj.sender?.usn || ''),
        college: obj.college,
        message: obj.message,
        anonymous: isAnon,
        createdAt: obj.createdAt,
        ...(isAdmin ? { _adminSenderInfo: `${obj.sender?.name} (${obj.sender?.usn || 'no USN'})` } : {}),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.get('/chat/messages', auth, handleGetChatMessages);
router.get('/chat/:college', auth, handleGetChatMessages);

const handleDeleteChatMessage = async (req, res) => {
  try {
    const ChatMsg = require('./chatmsg.model');
    const msg = await ChatMsg.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.sender.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Can only delete your own messages' });
    }
    await msg.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.delete('/chat/messages/:id', auth, handleDeleteChatMessage);
router.delete('/chat/:id', auth, handleDeleteChatMessage);

module.exports = router;
