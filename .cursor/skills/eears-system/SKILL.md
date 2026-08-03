---
name: eears-system
description: EEARS 系統導覽與變更影響面盤點（快速定位正確模組/規則）
license: MIT
---

# EEARS System

當你遇到跨模組任務、或不確定需求應落在哪個子系統時，先用這個 skill 做「定位與風險盤點」，再延伸到更專門的 skills（如 `eears-reservation`、`eears-survey-gate`、`eears-permission`）。

## When to Use This Skill

- 需求描述不清楚、涉及多個領域（預約/問卷/黑名單/匯入/LJ/英檢/BESTEP/後台 UI）
- 你需要先確認「這個改動會不會碰到學生端底線規則」
- 你需要確認專案實際存在的路徑/模組名稱，避免改錯或改到 deprecated 路徑

## Project Map（用這裡的路徑定位）

### 後端（reservation / survey / blacklist）
- 預約：`reservation-backend/routes/reservationRouter.js`、`reservation-backend/routes/eventRouter.js`
- 預約時間：`reservation-backend/utils/reservationTime.js`
- 問卷 Gate：`reservation-backend/middlewares/checkSurvey.js`、`reservation-backend/services/surveyGateService.js`
- 黑名單/違規：`reservation-backend/routes/blacklistRouter.js`、`reservation-backend/services/blacklistEnforcementService.js`

### 後端（匯入與管理維運）
- Import Runs：`reservation-backend/routes/importRunHistoryRouter.js`
- Import Center 導流（前端）：`reservation-frontend/src/pages/admin/ImportCenterPage.jsx`、`reservation-frontend/src/constants/importCenterCards.js`

### 後端（Learning Journey v3）
- 主入口：`reservation-backend/routes/learningJourneyV3Router.js`
- 讀模型開關：`reservation-backend/services/learningJourney/learningJourneyFeatureFlags.js`
- canonical gate：`reservation-backend/services/learningJourney/canonicalSemesterPolicyService.js`

### 前端（路由/頁面/後台）
- 主路由：`reservation-frontend/src/App.js`
- 後台頁面聚合：`reservation-frontend/src/pages/admin/*`
- 重要後台元件：`reservation-frontend/src/components/AdminHome.js`

## Guardrails（先做不破壞底線）

任何你要動的內容，在動手前都要對照以下底線：
- 学生端不登入、不建立帳號（除非需求明確要求，且與專案規則衝突）
- 預約/取消截止必須是活動開始前 `2` 小時
- 問卷 Gate 必須在「ET/EC + 產品規則啟用 + fail-close + redirectUrl」語意下維持
- 黑名單期間不可預約；解除邏輯不能被刪除或改成其他天數含意

這些底線的詳細版本在：`.cursor/rules/eears-business-rules.mdc`

## Output（你應該在回覆中先輸出什麼）

先輸出一段（通常 6-12 行）：
1. 這次改動影響的模組/端點（列路徑）
2. 可能觸及的底線規則（列規則名，不要只說「風險」）
3. 建議你接下來要用哪個專門 skill（例如 `eears-reservation` 或 `eears-survey-gate`）

## Suggested Follow-up Prompt

> 請先列出我這個需求會影響哪些端點/服務、以及會觸及哪些不可違背規則，然後再建議我用哪個 EEARS 專門 skill 來完成。

