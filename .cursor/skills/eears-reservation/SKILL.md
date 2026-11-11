---
name: eears-reservation
description: EEARS 預約/取消流程與可設定截止時數（含時間窗、blacklist、問卷 Gate）。線上候補已停用。
license: MIT
---

# eears-reservation（預約核心流程）

## When to Use This Skill
- 你要改任何學生端預約、取消（含 UI 提示或 API 錯誤碼）
- 你要改活動類型 `cutoffHours` 截止或 `eventType` 的開放起算（`openRule`）
- 你要改預約前檢查的組合（blacklist、問卷 gate、名額/重複/格式）

## API/Endpoint 對照（以實際路由為準）

- 預約建立：`reservationRouter.js` 的 `POST /reservations` 依序為 `studentAuthMiddleware`、`bindStudentIdentity()`、`checkSurvey`
- 學生取消：`POST /reservations/:id/cancel-public`，先綁 session，再由 `cancelReservationPublic` 比對 session 學號與 `cutoffHours`。不再核對 `cancellationCode`
- 管理端刪除：`DELETE /admin/reservations/:id`，不使用取消驗證碼
- 舊 `DELETE /reservations/:id` 維持 410
- 候補加入：`POST /events/:eventId/waitlist` 回 410，`errorCode` 為 `WAITLIST_DISABLED`。不要加回加入候補或 `promoteNextWaitlistedStudent`

## 任務步驟

契約條文見 `.cursor/rules/core.mdc`。改預約流程時照這個順序：

1. 前後端一起看時間計算：`reservation-backend/utils/reservationTime.js`、`services/eventTypeService.js`、`reservation-frontend/src/utils/reservationTime.js`。改一邊就要同步另一邊並補後端測試。
2. `events.eventType` 存 code（如 `english_table`），顯示名在類型目錄。開放窗讀該類型的 `openRule`，不要把某一類型的天數當成全站限制。
3. 預約前檢查維持既有順序：黑名單、問卷 Gate、名額與重複預約。額滿不能改成開放候補。
4. 學生取消只認 session 學號與同一 `cutoffHours`。不要把 `cancellationCode` 核對加回去。

## Hard Checklist（改動前逐項確認）

- [ ] 這次改動是否觸及 `reservationTime.js`（後端/前端雙份一致性）？
- [ ] 若涉及取消：是否仍只允許 session 學號取消自己的預約，並沿用同一 `cutoffHours` 截止？
- [ ] 不要重新啟用 waitlist 加入或 `promoteNextWaitlistedStudent`
- [ ] 若涉及 error codes：
  - 問卷 Gate 仍回 `409` 並附 `redirectUrl: /survey/{surveyKey}`
  - 截止/blacklist 的回應仍可被既有前端提示解讀

## Common Pitfalls（避免）

- 把截止寫死成「一律 2 小時」而不讀 `event_types.cutoffHours`
- 把 `7 day` 誤解為「距離活動 7 天內不能預約」
- 只改前端時間計算，忘了同步後端；導致學生看得懂但 API 擋下
- 移除/改錯誤碼：導致前端流程（尤其 409 + redirectUrl）失效
- 把 English Table 開放時間寫回 00:00（現行是前一天 12:00）

## Suggested Workflow Prompt

> 請先列出我這個需求會影響哪些規則（cutoffHours/開放窗/blacklist/問卷 Gate/額滿/duplicate），並告訴我你會優先讀取哪些檔案；確認後再提出具體改動建議與需補的測試項目。
