const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('./alerts.controller');

router.post('/', auth, controller.createAlert);
router.get('/my', auth, controller.getMyAlerts);
router.get('/:id/check', auth, controller.checkAlertMatches);
router.put('/:id', auth, controller.updateAlert);
router.delete('/:id', auth, controller.deleteAlert);

module.exports = router;