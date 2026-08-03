const express = require('express');
const siteContentController = require('../controllers/siteContentController');

const router = express.Router();

router.get('/', siteContentController.getPublic);

module.exports = router;
