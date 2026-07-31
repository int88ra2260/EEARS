const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const WEEKLY_REPORTS_DIR = path.join(__dirname, '../../docs/weekly-reports');

/**
 * GET /api/weekly-reports
 * 取得週報列表
 */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!fs.existsSync(WEEKLY_REPORTS_DIR)) {
      return res.json({ reports: [] });
    }

    const files = fs.readdirSync(WEEKLY_REPORTS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort((a, b) => b.localeCompare(a));

    const reports = files.map(filename => {
      const match = filename.match(/^(\d{4})-W(\d{2})-(\d{2})-(\d{2})-to-(\d{2})-(\d{2})\.md$/);
      if (match) {
        const [, year, week, startMonth, startDay, endMonth, endDay] = match;
        return {
          filename,
          year: parseInt(year),
          week: parseInt(week),
          startDate: `${year}/${startMonth}/${startDay}`,
          endDate: `${year}/${endMonth}/${endDay}`,
          title: `${year} 年第 ${week} 週週報 (${startMonth}/${startDay} - ${endMonth}/${endDay})`,
        };
      }
      return {
        filename,
        title: filename.replace('.md', ''),
      };
    });

    res.json({ reports });
  } catch (error) {
    console.error('Error fetching weekly reports:', error);
    res.status(500).json({ error: '無法取得週報列表' });
  }
});

/**
 * GET /api/weekly-reports/:filename
 * 取得單一週報內容
 */
router.get('/:filename', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: '無效的檔案名稱' });
    }

    const filePath = path.join(WEEKLY_REPORTS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '週報不存在' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    res.json({ 
      filename,
      content,
    });
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    res.status(500).json({ error: '無法取得週報內容' });
  }
});

/**
 * PUT /api/weekly-reports/:filename
 * 更新週報內容
 */
router.put('/:filename', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: '無效的檔案名稱' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: '週報內容不能為空' });
    }

    const filePath = path.join(WEEKLY_REPORTS_DIR, filename);
    
    if (!fs.existsSync(WEEKLY_REPORTS_DIR)) {
      fs.mkdirSync(WEEKLY_REPORTS_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    
    res.json({ 
      success: true,
      message: '週報已更新',
      filename,
    });
  } catch (error) {
    console.error('Error updating weekly report:', error);
    res.status(500).json({ error: '無法更新週報' });
  }
});

module.exports = router;
