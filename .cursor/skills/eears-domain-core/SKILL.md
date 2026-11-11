---
name: eears-domain-core
description: EEARS 核心業務底線檢查（cutoffHours、學生登入綁學號、黑名單、問卷 Gate）
license: MIT
---

# eears-domain-core（不可違背底線護欄）

## When to Use This Skill

- 你要改任何與學生端預約/取消相關的 UI 或 API 呼叫
- 你要改問卷 Gate（ET/EC）或 blacklist/違規/簽到/自動檢查
- 你要改時間規則（例如 `cutoffHours`、eventType 預約開放窗）
- 你要改任何會改錯誤碼/redirectUrl 的邏輯

## Background You Need

不變條件的權威正文在 `.cursor/rules/core.mdc`。這份 skill 只列動手前要核對的檔案與順序，不重寫那些條文。

目前 HEAD 要一併核對的操作事實：

- 學生個人功能已使用 `studentAuthMiddleware` 與 `bindStudentIdentity`。
- `cancelReservationPublic` 只比對 session 學號，並套用該活動類型的 `cutoffHours`。不再寄送或核對 `cancellationCode`。未登入不能取消。
- 管理端刪除不使用驗證碼。舊 `DELETE /reservations/:id` 維持 410。

## Hard Constraints（修改前必須逐項檢查）

1. 時間規則一致性
   - 後端：`reservation-backend/utils/reservationTime.js`、`services/eventTypeService.js`
   - 前端：`reservation-frontend/src/utils/reservationTime.js`
   - 若你改任一處，另一處也要同步更新且補測（至少後端）

2. `cutoffHours` 截止（預約與公開取消同一值）
   - 讀活動類型設定，勿硬編 `2` 或改成「一律 24 小時」
   - 不要把取消政策改成與預約不同的截止語意

3. 「7 day」的語意
   - `7 day` 是不同 `eventType` 的「預約開放起算」邏輯，不是統一禁止規則
   - 不要把 `7 day` 改成「距活動 7 天內不可預約」

4. 問卷 Gate 契約
   - 後端 middleware：`reservation-backend/middlewares/checkSurvey.js`
   - service：`reservation-backend/services/surveyGateService.js`
   - 未完成時：
     - 回 `409`
     - 回 `redirectUrl: /survey/{surveyKey}`
     - 依 eventType 回對應錯誤碼（ET/EC 的 `*_SURVEY_REQUIRED`）

5. 黑名單/違規
   - booking 前檢查 blacklist status（以程式實作為準）
   - 黑名單期間不可預約
   - 解封邏輯與取消期間行為不可隨意變更

## Do / Don’t（具體指令）

### Do

- 改動前先列出「會碰到哪些底線」並對照規則檔
- 保留既有錯誤碼/redirectUrl（若要變更需先確認前端是否會解讀）
- 若你改了 service/util，優先補後端測試

### Don’t

- 不要移除 check middleware 或把 fail-close 改成 next() 讓學生可直接預約
- 不要把前端提示文字改掉後就假裝規則也改了（規則需在後端）
- 不要把黑名單天數/解封日邏輯改成另一套（例如改成「下週同日」而非週日）

## Suggested Workflow Prompt（給 AI 用）

> 請先只讀取與我需求相關的檔案，列出可能碰到的底線規則（cutoffHours、7 day 語意、問卷 Gate 契約、blacklist 封鎖、學生登入綁學號），並在開始提出修改建議前，先確認你理解這些語意是否正確。若要改錯誤碼/redirectUrl/時間邏輯，請明確列出前端依賴點與建議測試項目。
