---
name: eears-reservation
description: EEARS 預約/取消流程與 2hr 截止（含時間窗、blacklist、問卷 Gate）。線上候補已停用。
license: MIT
---

# eears-reservation（預約核心流程）

## When to Use This Skill
- 你要改任何學生端預約、取消（含 UI 提示或 API 錯誤碼）
- 你要改「活動開始前 2 小時截止」或 `eventType` 的開放起算
- 你要改預約前檢查的組合（blacklist、問卷 gate、名額/重複/格式）

## API/Endpoint 對照（以實際路由為準）

- 預約建立（公開）：`reservation-backend/routes/reservationRouter.js` 中
  - `router.post('/reservations', checkSurvey, ...)`
- 公開取消：`/reservations/:id/cancel-public`（deprecated 混合取消需避免）
- 管理端取消：`/admin/reservations/:id`
- 候補已停用：`POST /events/:eventId/waitlist` 回 `410` / `WAITLIST_DISABLED`
  - 不要加回學生端加入候補或取消後自動轉正

## Core Business Rules（硬約束）

1. 2hr 截止：活動開始前 2 小時
   - 後端：`reservation-backend/utils/reservationTime.js`
   - 前端：`reservation-frontend/src/utils/reservationTime.js`
   - 取消與預約使用同一「2hr」政策語意

2. 預約開放窗依 eventType（不要把 7 天當成統一限制）
   - `English Table`／自訂類型：前一天 **12:00** 開始
   - `Job Talk`：7 天前 weekday 12:00 開始
   - `English Club`：上週三 12:00
   - `International Forum`：上週五 12:00

3. 預約前檢查的順序與語意
   - 若問卷 Gate 適用（ET/EC product mode + rule required），未完成必須擋下
   - 若 blacklist 適用，blacklisted 期間必須擋下
   - 額滿即無法再預約（不開放候補）

## Hard Checklist（改動前逐項確認）

- [ ] 這次改動是否觸及 `reservationTime.js`（後端/前端雙份一致性）？
- [ ] 若涉及取消：有沒有保留驗證碼（cancellationCode）的要求與 2hr 截止？
- [ ] 不要重新啟用 waitlist 加入或 `promoteNextWaitlistedStudent`
- [ ] 若涉及 error codes：
  - 問卷 Gate 仍回 `409` 並附 `redirectUrl: /survey/{surveyKey}`
  - 截止/blacklist 的回應仍可被既有前端提示解讀

## Common Pitfalls（避免）

- 把 `7 day` 誤解為「距離活動 7 天內不能預約」
- 只改前端時間計算，忘了同步後端；導致學生看得懂但 API 擋下
- 移除/改錯誤碼：導致前端流程（尤其 409 + redirectUrl）失效
- 把 English Table 開放時間寫回 00:00（現行是前一天 12:00）

## Suggested Workflow Prompt

> 請先列出我這個需求會影響哪些規則（2hr/開放窗/blacklist/問卷 Gate/額滿/duplicate），並告訴我你會優先讀取哪些檔案；確認後再提出具體改動建議與需補的測試項目。
