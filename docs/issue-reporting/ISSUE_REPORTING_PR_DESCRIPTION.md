# 學生回報 PR 說明

審查基準是收尾文件 commit 建立前的 HEAD `49a6006f59c9de6615714621f239503e4b7bb8b2`。這份說明與審查文件的空白修正會再進入一個文件 commit，該 commit 的 hash 在建立前不寫在這裡。建立後 HEAD 會前進，產品程式仍停在 `2ada344`。

PR Ready：YES（本機準備完成）。這不是可直接部署。

Merge Ready：NO。

Production Ready：NO。

Production Migration Status：UNKNOWN。

## 可貼上的 PR 描述

### Summary

Student Feedback 後台管理強化。

### Features

- Dashboard KPI：全表統計、案件編號、更新時間與排序白名單。
- 問題分類：沿用既有分類，並加上學習歷程與介面顯示。
- 優先級：可空，表示處理順序，不回填舊案件。
- 案件時間軸：狀態、承辦與優先級變更可在後台查看。
- 操作稽核：狀態、承辦與優先級寫入同一筆交易的事件。
- 內部備註權限隔離：view 不能修改，查詢也不讀內部備註。學生只能看自己的案件，不能設定優先級。
- 個資最小化通知：新案信只有案件編號與後台列表連結。
- 管理頁競態修正：忽略過期的列表與詳情回應。只有詳情與目前選取案件一致時才發送管理操作。

### Tests

以下是先前已回報的本機與隔離 MySQL 證據。本階段只改 Markdown，沒有重跑這些測試，也不是正式環境驗證。

- Backend Jest：60 Passed。
- Frontend Vitest：29 Passed。
- Isolated MySQL：5 Passed。
- Frontend Production Build：Passed。

### Database

- 新增 `student_feedback_events`。
- `student_feedback` 新增可空的 `priority` 與索引 `idx_student_feedback_priority`。沒有把舊案件改成 P2。

Production Migration Status：UNKNOWN。

程式相依順序如下。這不是可直接執行的正式 migration 命令，正式庫仍以實際 schema 與 `SequelizeMeta` 為準：

1. `20261108150000-create-student-feedback.js`
2. `20261110160000-student-feedback-cases.js`
3. `20261112161000-student-feedback-events.js`
4. `20261112173000-student-feedback-priority.js`

這些依賴既有的 `teachers`。同一時分還有其他已在 base 的 migration。不要在正式庫執行 `down`。

### Risks

- 正式資料庫尚未驗證。程式若比欄位先上，後台列表會查詢失敗。
- View-only 個資政策未決定。目前 view 仍可看全部案件的姓名、學號、信箱與內容。
- 正式 SMTP 未驗證。
- 正式部署尚未進行。
- 已送出的管理請求在切換案件後仍會在伺服器完成，畫面不會把結果套到新案件。

### Release Restrictions

不得在正式 Schema 驗證前 Merge 或 Deploy。合併到 `main` 且 CI 成功後，現有 workflow 會部署正式機，部署腳本不會自動 migrate。

## Git Base / Head

| 項目 | 值 |
|------|----|
| Branch | `feature/student-feedback-management` |
| Base | `e066a07373228aeb3151077f58cf62cf44fbf017` |
| 審查基準 Head | `49a6006f59c9de6615714621f239503e4b7bb8b2` |
| 遠端 PR | 尚未建立，也沒有 push |

## Commit List

審查基準上的五個 commit：

| Commit | 訊息 |
|--------|------|
| `6cda01f13a00dadb2f82531da2fd168b8142fcc6` | `feat(student-feedback): add management workflow and audit support` |
| `2b7623dc7a7113a8024822ec04c2a47bedaa94bc` | `feat(student-feedback): enhance admin dashboard and student entry` |
| `77e76ffaa4616b2fa456567428c406be0be8c70b` | `docs(student-feedback): document implementation and release gates` |
| `2ada344fc11885ea3c00edff53632ba055e26cfc` | `fix(student-feedback): ignore stale admin list and detail responses` |
| `49a6006f59c9de6615714621f239503e4b7bb8b2` | `docs(student-feedback): record race condition review and fixes` |

其後只再加一個文件 commit，收錄本說明與審查文件檔尾空行的移除。產品程式沒有再改。

## Files Changed

自 base 到 `49a6006`：

- 後端：`email.js`、`studentFeedbackService.js`、`adminStudentFeedbackRouter.js`、`StudentFeedback.js`、`StudentFeedbackEvent.js`、`models/index.js`、兩支新 migration，以及三支後端測試。
- 前端：管理頁、學生回報面板、帳號頁入口、`studentFeedbackApi.js` 與管理頁 Vitest。
- 文件：`docs/issue-reporting/` 既有八份文件與 `ISSUE_REPORTING_PRE_PR_REVIEW.md`。

沒有包含 `.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/`。

`49a6006` 的 `git diff --check` 曾指出審查文件檔尾多一個空行。該空行在這次文件更新移除，不以改寫舊 commit 的方式處理。

## Database Dependencies

見上方 Database。Production Migration Status 維持 UNKNOWN。

## Test Evidence

| 項目 | 結果 | 說明 |
|------|------|------|
| Backend Jest | 60 Passed | 先前已回報。本階段未重跑 |
| Frontend Vitest | 29 Passed | 先前已回報。本階段未重跑 |
| Isolated MySQL | 5 Passed | 先前已回報。不是正式庫。本階段未重跑 |
| Production build | Passed | 先前已回報。本階段未重跑 |
| 正式庫 | Not Executed | 沒有連線 |
| 正式 SMTP | Not Executed | 沒有寄出 |

對應的程式 commit 是 `2ada344`。本階段沒有改產品程式。

## Risks

見上方 Risks。PR Ready 只表示本機分支與說明已齊，不表示可以上線。

## Merge Gate

Merge Ready：NO。正式 schema 未驗證前不合併。

## Deployment Gate

Production Ready：NO。Database Ready：否。Production Migration Status：UNKNOWN。不得把 migration `down` 當成一般回滾。
