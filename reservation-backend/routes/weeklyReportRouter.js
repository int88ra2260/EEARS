const express = require('express');
const weeklyReportController = require('../controllers/weeklyReportController');
const weeklyInteractionRouter = require('./weeklyInteractionRouter');
const { publicAnnouncementLimiter } = require('../middlewares/announcementGuards');

const router = express.Router();

router.use(publicAnnouncementLimiter);

router.use('/interactions', weeklyInteractionRouter);

router.get('/current', weeklyReportController.getCurrent);
router.get('/preview/:token', weeklyReportController.getPreview);
router.get('/', weeklyReportController.list);
router.get('/:idOrSlug', weeklyReportController.getByKey);

module.exports = router;
