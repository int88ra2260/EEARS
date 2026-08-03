const express = require('express');
const router = express.Router();
const { WeeklyReport } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const { Op } = require('sequelize');

/**
 * 週報 API Token 驗證中間件
 * 支援兩種方式：
 * 1. 標準登入 token（透過 authMiddleware）
 * 2. 專用 API Token（透過環境變數 WEEKLY_REPORT_API_TOKEN）
 */
const weeklyReportAuth = (req, res, next) => {
  const apiToken = process.env.WEEKLY_REPORT_API_TOKEN;
  const authHeader = req.headers.authorization;
  
  // 檢查是否使用專用 API Token
  if (apiToken && authHeader === `Bearer ${apiToken}`) {
    req.user = { username: 'cursor-agent', role: 'admin' };
    return next();
  }
  
  // 否則使用標準登入驗證
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    adminMiddleware(req, res, next);
  });
};

/**
 * GET /api/weekly-reports
 * 取得週報列表
 */
router.get('/', weeklyReportAuth, async (req, res) => {
  try {
    const { status, year } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (year) where.year = parseInt(year);

    const reports = await WeeklyReport.findAll({
      where,
      order: [['year', 'DESC'], ['week', 'DESC']],
      attributes: ['id', 'year', 'week', 'title', 'startDate', 'endDate', 'status', 'createdAt', 'updatedAt', 'publishedAt'],
    });

    const formattedReports = reports.map(r => ({
      id: r.id,
      weekCode: `${r.year}-W${String(r.week).padStart(2, '0')}`,
      year: r.year,
      week: r.week,
      title: r.title,
      startDate: r.startDate,
      endDate: r.endDate,
      dateRange: `${r.startDate} ~ ${r.endDate}`,
      status: r.status,
      statusLabel: { draft: '草稿', pending: '待審', published: '已發布' }[r.status],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      publishedAt: r.publishedAt,
    }));

    res.json({ reports: formattedReports });
  } catch (error) {
    console.error('Error fetching weekly reports:', error);
    res.status(500).json({ error: '無法取得週報列表' });
  }
});

/**
 * GET /api/weekly-reports/:id
 * 取得單一週報
 */
router.get('/:id', weeklyReportAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await WeeklyReport.findByPk(id);
    
    if (!report) {
      return res.status(404).json({ error: '週報不存在' });
    }

    res.json({
      id: report.id,
      weekCode: `${report.year}-W${String(report.week).padStart(2, '0')}`,
      year: report.year,
      week: report.week,
      title: report.title,
      startDate: report.startDate,
      endDate: report.endDate,
      content: report.content,
      status: report.status,
      statusLabel: { draft: '草稿', pending: '待審', published: '已發布' }[report.status],
      createdBy: report.createdBy,
      updatedBy: report.updatedBy,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      publishedAt: report.publishedAt,
    });
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    res.status(500).json({ error: '無法取得週報' });
  }
});

/**
 * POST /api/weekly-reports
 * 新增週報
 */
router.post('/', weeklyReportAuth, async (req, res) => {
  try {
    const { year, week, title, startDate, endDate, content, status } = req.body;
    
    if (!year || !week || !title || !startDate || !endDate) {
      return res.status(400).json({ error: '缺少必要欄位 (year, week, title, startDate, endDate)' });
    }

    const existing = await WeeklyReport.findOne({
      where: { year, week }
    });

    if (existing) {
      return res.status(409).json({ error: `${year} 年第 ${week} 週的週報已存在` });
    }

    const username = req.user?.username || 'system';
    
    const report = await WeeklyReport.create({
      year,
      week,
      title,
      startDate,
      endDate,
      content: content || '',
      status: status || 'draft',
      createdBy: username,
      updatedBy: username,
    });

    res.status(201).json({
      success: true,
      message: '週報已建立',
      report: {
        id: report.id,
        weekCode: `${report.year}-W${String(report.week).padStart(2, '0')}`,
        title: report.title,
        status: report.status,
      },
    });
  } catch (error) {
    console.error('Error creating weekly report:', error);
    res.status(500).json({ error: '無法建立週報' });
  }
});

/**
 * PUT /api/weekly-reports/:id
 * 更新週報
 */
router.put('/:id', weeklyReportAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, startDate, endDate, content } = req.body;
    
    const report = await WeeklyReport.findByPk(id);
    
    if (!report) {
      return res.status(404).json({ error: '週報不存在' });
    }

    if (report.status === 'published') {
      return res.status(400).json({ error: '已發布的週報無法編輯' });
    }

    const username = req.user?.username || 'system';

    await report.update({
      title: title ?? report.title,
      startDate: startDate ?? report.startDate,
      endDate: endDate ?? report.endDate,
      content: content ?? report.content,
      updatedBy: username,
    });

    res.json({
      success: true,
      message: '週報已更新',
      report: {
        id: report.id,
        weekCode: `${report.year}-W${String(report.week).padStart(2, '0')}`,
        title: report.title,
        status: report.status,
      },
    });
  } catch (error) {
    console.error('Error updating weekly report:', error);
    res.status(500).json({ error: '無法更新週報' });
  }
});

/**
 * POST /api/weekly-reports/:id/submit
 * 送審週報
 */
router.post('/:id/submit', weeklyReportAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await WeeklyReport.findByPk(id);
    
    if (!report) {
      return res.status(404).json({ error: '週報不存在' });
    }

    if (report.status !== 'draft') {
      return res.status(400).json({ error: '只有草稿狀態的週報可以送審' });
    }

    const username = req.user?.username || 'system';

    await report.update({
      status: 'pending',
      updatedBy: username,
    });

    res.json({
      success: true,
      message: '週報已送審',
    });
  } catch (error) {
    console.error('Error submitting weekly report:', error);
    res.status(500).json({ error: '無法送審週報' });
  }
});

/**
 * POST /api/weekly-reports/:id/publish
 * 發布週報
 */
router.post('/:id/publish', weeklyReportAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await WeeklyReport.findByPk(id);
    
    if (!report) {
      return res.status(404).json({ error: '週報不存在' });
    }

    if (report.status === 'published') {
      return res.status(400).json({ error: '週報已發布' });
    }

    const username = req.user?.username || 'system';

    await report.update({
      status: 'published',
      publishedAt: new Date(),
      updatedBy: username,
    });

    res.json({
      success: true,
      message: '週報已發布',
    });
  } catch (error) {
    console.error('Error publishing weekly report:', error);
    res.status(500).json({ error: '無法發布週報' });
  }
});

/**
 * DELETE /api/weekly-reports/:id
 * 刪除週報
 */
router.delete('/:id', weeklyReportAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await WeeklyReport.findByPk(id);
    
    if (!report) {
      return res.status(404).json({ error: '週報不存在' });
    }

    if (report.status === 'published') {
      return res.status(400).json({ error: '已發布的週報無法刪除' });
    }

    await report.destroy();

    res.json({
      success: true,
      message: '週報已刪除',
    });
  } catch (error) {
    console.error('Error deleting weekly report:', error);
    res.status(500).json({ error: '無法刪除週報' });
  }
});

/**
 * POST /api/weekly-reports/generate
 * 自動生成週報（供 Cursor Agent 使用）
 * 根據日期自動計算年份和週數
 */
router.post('/generate', weeklyReportAuth, async (req, res) => {
  try {
    const { startDate, endDate, title, content, autoPublish } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '缺少必要欄位 (startDate, endDate)' });
    }

    // 從起始日期計算年份和 ISO 週數
    const start = new Date(startDate);
    const year = start.getFullYear();
    const week = getISOWeek(start);
    
    // 自動生成標題
    const generatedTitle = title || `EEARS Weekly 第 ${week} 期`;

    const existing = await WeeklyReport.findOne({
      where: { year, week }
    });

    if (existing) {
      return res.status(409).json({ 
        error: `${year} 年第 ${week} 週的週報已存在`,
        existingReport: {
          id: existing.id,
          title: existing.title,
          status: existing.status,
        }
      });
    }

    const username = req.user?.username || 'cursor-agent';
    
    const report = await WeeklyReport.create({
      year,
      week,
      title: generatedTitle,
      startDate,
      endDate,
      content: content || generateDefaultContent(year, week, startDate, endDate),
      status: autoPublish ? 'published' : 'draft',
      createdBy: username,
      updatedBy: username,
      publishedAt: autoPublish ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      message: `週報已建立${autoPublish ? '並發布' : ''}`,
      report: {
        id: report.id,
        weekCode: `${report.year}-W${String(report.week).padStart(2, '0')}`,
        year: report.year,
        week: report.week,
        title: report.title,
        startDate: report.startDate,
        endDate: report.endDate,
        status: report.status,
      },
    });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ error: '無法生成週報' });
  }
});

/**
 * 計算 ISO 週數
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * 生成預設週報內容
 */
function generateDefaultContent(year, week, startDate, endDate) {
  const startDateFormatted = startDate.replace(/-/g, '/');
  const endDateFormatted = endDate.replace(/-/g, '/');
  
  return `# EEARS 系統週報

**週報期間**: ${startDateFormatted} ~ ${endDateFormatted}
**週次**: ${year}-W${String(week).padStart(2, '0')}

---

## 📌 本週摘要

（請填寫本週主要完成的工作和重要進展）

---

## ✅ 本週完成項目

| 項目 | 狀態 | 備註 |
|------|------|------|
| | | |

---

## 🔄 進行中項目

| 項目 | 進度 | 備註 |
|------|------|------|
| | | |

---

## 📅 下週計劃

1. 
2. 
3. 

---

## ⚠️ 問題與風險

| 問題描述 | 影響範圍 | 處理狀態 |
|----------|----------|----------|
| | | |

---

## 📝 其他備註

`;
}

module.exports = router;
