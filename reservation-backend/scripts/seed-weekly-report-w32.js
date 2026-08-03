/**
 * 新增 2026-W32 週報資料 (8/3-8/9)
 * 執行方式: node scripts/seed-weekly-report-w32.js
 */

require('dotenv').config();
const { WeeklyReport, sequelize } = require('../models');

const content = `# EEARS 系統週報

**週報期間**: 2026/08/03 (一) ~ 2026/08/09 (日)  
**週次**: 2026-W32  
**撰寫人**: ＿＿＿＿＿＿  
**撰寫日期**: 2026/08/＿＿

---

## 📌 本週摘要

<!-- 請簡述本週主要完成的工作和重要進展 -->

---

## ✅ 本週完成項目

### 1. Learning Journey 學習歷程模組

| 項目 | 狀態 | 備註 |
|------|------|------|
| V3 Read Model 切換 | ☐ 進行中 / ☐ 已完成 | |
| Governance Overview API | ☐ 進行中 / ☐ 已完成 | |
| Daily Governance 自動化 | ☐ 進行中 / ☐ 已完成 | |
| Legacy Usage Audit | ☐ 進行中 / ☐ 已完成 | |
| Job Runs 排程管理 | ☐ 進行中 / ☐ 已完成 | |

### 2. BESTEP 整合模組

| 項目 | 狀態 | 備註 |
|------|------|------|
| 資料庫 Migration | ☐ 進行中 / ☐ 已完成 | 出席/成績/場次/團體名次表 |
| 班級 BESTEP 查詢 API | ☐ 進行中 / ☐ 已完成 | |
| 出席資料匯入 API | ☐ 進行中 / ☐ 已完成 | |
| 成績資料匯入 API | ☐ 進行中 / ☐ 已完成 | |
| 團體名次計算 API | ☐ 進行中 / ☐ 已完成 | |
| 前端 UI 開發 | ☐ 進行中 / ☐ 已完成 | |

### 3. 英文測驗追蹤模組

| 項目 | 狀態 | 備註 |
|------|------|------|
| Progress Calculation | ☐ 進行中 / ☐ 已完成 | |
| Review 功能 | ☐ 進行中 / ☐ 已完成 | |

### 4. 其他項目

| 項目 | 狀態 | 備註 |
|------|------|------|
| | | |

---

## 🔄 進行中項目

### 高優先

1. **Learning Journey P10 正式上線驗收**
   - 進度：＿＿%
   - 預計完成日：＿＿＿＿
   - 待處理：
     - [ ] P0-P9 UAT checklist 驗收
     - [ ] Governance Overview 驗證
     - [ ] Legacy usage audit 觀察期

2. **BESTEP Phase 3 前端 UI**
   - 進度：＿＿%
   - 預計完成日：＿＿＿＿
   - 待處理：
     - [ ] ClassOverview.js 擴充
     - [ ] ClassDetail.js 擴充
     - [ ] BestepImportPage.js 建立

### 中優先

1. 
   - 進度：＿＿%
   - 待處理：

### 低優先

1. 
   - 進度：＿＿%

---

## 📅 下週計劃 (08/10 ~ 08/16)

### 預計完成項目

| 項目 | 負責人 | 預計完成日 |
|------|--------|------------|
| | | |

### 重點任務

1. 
2. 
3. 

---

## ⚠️ 問題與風險

### 阻塞問題 (Blockers)

| 問題描述 | 影響範圍 | 處理狀態 | 負責人 |
|----------|----------|----------|--------|
| | | | |

### 風險項目

| 風險描述 | 風險等級 | 緩解措施 | 負責人 |
|----------|----------|----------|--------|
| | 高/中/低 | | |

---

## 📊 指標追蹤

### 開發進度

| 模組 | 完成度 | 本週變化 |
|------|--------|----------|
| Learning Journey | ＿＿% | +＿＿% |
| BESTEP 整合 | ＿＿% | +＿＿% |
| 英文測驗追蹤 | ＿＿% | +＿＿% |

### 待處理 Issues

- 總數：＿＿
- 高優先：＿＿
- 本週新增：＿＿
- 本週關閉：＿＿

---

## 📝 其他備註

### 會議紀要

- 

### 技術決策

- 

---

## 👥 團隊簽核

| 角色 | 姓名 | 簽核日期 |
|------|------|----------|
| 開發人員 | | |
| 技術主管 | | |
| 專案經理 | | |

---

**下次週報預定日期**: 2026/08/16
`;

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('資料庫連線成功');

    const existing = await WeeklyReport.findOne({
      where: { year: 2026, week: 32 }
    });

    if (existing) {
      console.log('2026-W32 週報已存在，跳過建立');
      return;
    }

    const report = await WeeklyReport.create({
      year: 2026,
      week: 32,
      title: 'EEARS Weekly 第 32 期',
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      content,
      status: 'draft',
      createdBy: 'system',
      updatedBy: 'system',
    });

    console.log(`週報建立成功: ${report.year}-W${report.week} - ${report.title}`);
  } catch (error) {
    console.error('錯誤:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
