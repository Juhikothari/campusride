const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getPosts, createPost, toggleLike, addReply } = require('./community.controller');

router.get('/',               auth, getPosts);
router.post('/',              auth, createPost);
router.patch('/:id/like',     auth, toggleLike);
router.post('/:id/reply',     auth, addReply);

module.exports = router;

// ── Chat messages (college-scoped) ────────────────────────────────
router.get('/chat/messages', auth, async (req, res) => {
  try {
    const User = require('../users/users.model');
    const user = await User.findById(req.user.userId).select('college role');
    if (!user?.college) return res.status(400).json({ message: 'College not found' });

    const ChatMsg = require('./chatmsg.model');
    const messages = await ChatMsg.find({ college: user.college.trim().toLowerCase() })
      .populate('sender', 'name usn role')
      .sort({ createdAt: 1 })
      .limit(100);

    const isAdmin = user.role === 'admin';
    // Admin gets full sender info, others get normal data
    const result = messages.map(m => {
      const obj = m.toObject();
      if (isAdmin) obj._adminSenderInfo = `${obj.sender?.name} (${obj.sender?.usn || 'no USN'})`;
      return obj;
    });

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/chat/messages/:id', auth, async (req, res) => {
  try {
    const ChatMsg = require('./chatmsg.model');
    const msg = await ChatMsg.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.sender.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Can only delete your own messages' });
    }
    await msg.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
