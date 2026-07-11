const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('./chat.model');

router.get('/:rideId', auth, async (req, res) => {
  try {

    const messages = await Chat.find({
      rideId: req.params.rideId
    })
    .populate('sender', 'name')
    .sort({ createdAt: 1 });

    res.json(messages);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;