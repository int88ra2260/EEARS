const express = require('express');
const adminWeeklyMediaController = require('../controllers/adminWeeklyMediaController');
const { weeklyMediaUpload } = require('../middlewares/weeklyMediaUpload');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware, requirePermission(P.CAN_MANAGE_ANNOUNCEMENTS));

router.get('/', adminWeeklyMediaController.list);
router.post('/', weeklyMediaUpload.single('file'), adminWeeklyMediaController.upload);
router.delete('/:id', adminWeeklyMediaController.remove);

module.exports = router;
