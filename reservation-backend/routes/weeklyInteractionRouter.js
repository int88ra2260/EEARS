const express = require('express');
const weeklyInteractionController = require('../controllers/weeklyInteractionController');
const { publicAnnouncementLimiter } = require('../middlewares/announcementGuards');

const router = express.Router();

router.use(publicAnnouncementLimiter);

router.post('/poll', weeklyInteractionController.votePoll);
router.get('/poll/:blockId', weeklyInteractionController.getPoll);
router.post('/quiz', weeklyInteractionController.submitQuiz);
router.post('/event', weeklyInteractionController.recordEvent);

module.exports = router;
