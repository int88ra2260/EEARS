---
name: eears-survey-gate
description: EEARS 問卷 Gate（ET/EC）fail-close、redirectUrl 與 repair/gap 維運護欄
license: MIT
---

# eears-survey-gate（問卷 Gate）

## When to Use This Skill

- 你要改任何與問卷 Gate（學生預約前檢查）相關的後端 middleware/service 或前端導向
- 你要改 `survey_rules` / `SurveyRule` 判斷（是否 required/enabled、時間範圍）
- 你要改 ET/EC 問卷的 surveyKey 對照或完成判定邏輯
- 你要改 admin 端的 gate gaps / repairs / answer mapping（需要保留維運語意）

## Key Files（以程式實作為準）

學生端 Gate：
- Middleware：`reservation-backend/middlewares/checkSurvey.js`
- Service：`reservation-backend/services/surveyGateService.js`
- 主要對照：
  - `EVENT_TYPE_TO_SURVEY_KEY`
  - `ruleTimeAllows(rule)`
  - `resolveGateContext(eventType)`
  - `hasCompletedForGate*`

Admin 維運（gaps / repairs）：
- Gate gaps：`reservation-backend/routes/adminSurveyGateGapsRouter.js`
- Repairs：`reservation-backend/routes/adminSurveyRepairsRouter.js`
- Repair 執行：`reservation-backend/services/surveyRepairExecutionService.js`

## Hard Contracts（不可違背）

1. 只針對 ET / EC 的 product 規則擋

- `checkSurvey` 會先呼叫 `resolveGateContext(event.eventType)`
- 若 `productCtx.mode !== 'product'`：必須 `next()`（legacy 相容行為）
- 只有當 `rule.isEnabled && rule.isRequired` 時才可能擋下

2. 時間窗判斷

- `ruleTimeAllows(rule)` 不 ok 時必須放行（`return next()`）

3. 未完成 → 必須擋下（fail-close）

當 `completed` 為 false 時：
- 回 `409`
- 回傳 `redirectUrl: /survey/{surveyKey}`
- 依 eventType 回對應 code：
  - English Table：`ENGLISH_TABLE_SURVEY_REQUIRED`
  - English Club：`ENGLISH_CLUB_SURVEY_REQUIRED`

4. 驗證失敗（service throw）→ 500 fail-safe

- `checkSurvey` 若在 `hasCompletedForGate` 內 throw，需要回 `500` 並 code 為 `SURVEY_CHECK_FAILED`（不可改成 200/409 以免前端誤判）

## What to Verify When You Change Anything

1. 你改了 `EVENT_TYPE_TO_SURVEY_KEY` 或 surveyKey → 必須確認前端導向頁 `/survey/{surveyKey}` 是否存在且可用
2. 你改了 `rule.isRequired` / `rule.isEnabled` 來源 → 必須確認 admin 端 toggle 行為與學生端判斷一致
3. 你改了「完成紀錄判定」→ 必須確認 retake policy（`once_ever`、`once_per_event`、`unlimited`）語意仍一致

## Common Pitfalls

- 把 legacy 行為誤改成 product mode 擋下
- 修改錯誤碼或拿掉 redirectUrl，導致前端無法導向問卷
- 把「規則時間不允許」當成擋下（目前語意應是放行）
- 在 repair/gaps 維運中改動執行語意（例如 confirmPhrase）導致管理端無法正確執行

## Suggested Workflow Prompt

> 你要我改的是 Gate 判定/導向/完成判定哪一段？請列出會影響的 contract（409 + redirectUrl、ENGLISH_TABLE/CLUB code、product mode 條件、ruleTimeAllows 行為），並告訴我你會補哪些測試或至少哪些情境要手動驗證。

