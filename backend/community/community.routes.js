const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getPosts, createPost, toggleLike, addReply } = require('./community.controller');

router.get('/',               auth, getPosts);
router.post('/',              auth, createPost);
router.patch('/:id/like',     auth, toggleLike);
router.post('/:id/reply',     auth, addReply);

module.exports = router;
