# 學生回報整合檢查

- 日期：2026-11-12
- 分支：`main`
- HEAD：`e066a07373228aeb3151077f58cf62cf44fbf017`
- 範圍：盤點、回歸測試與文件。沒有改產品程式，沒有 commit、push、merge 或部署。
- Production Migration Status：UNKNOWN
- `git diff --check` 沒有輸出。

## Git Change Inventory

### A. Student Feedback 功能程式

已修改：

- `reservation-backend/config/email.js`
- `reservation-backend/models/StudentFeedback.js`
- `reservation-backend/models/index.js`
- `reservation-backend/routes/adminStudentFeedbackRouter.js`
- `reservation-backend/services/studentFeedbackService.js`
- `reservation-frontend/src/components/student/StudentFeedbackPanel.jsx`
- `reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.jsx`
- `reservation-frontend/src/services/studentFeedbackApi.js`
- `reservation-frontend/src/pages/student/StudentAccountPage.jsx`

未追蹤：

- `reservation-backend/models/StudentFeedbackEvent.js`

`StudentAccountPage.jsx` 目前的 diff 只有 22 行，全部是「遇到問題」圓形入口：預設收合，點開才顯示既有 `StudentFeedbackPanel`。檔案裡沒有混進其他業務修改。它不是 Phase 2B 的優先級功能，而是更早的學生入口調整。

### B. Student Feedback Migration

工作區新增、尚未進 HEAD：

- `reservation-backend/migrations/20261112161000-student-feedback-events.js`
- `reservation-backend/migrations/20261112173000-student-feedback-priority.js`

已在 HEAD、這次 diff 沒有再改：

- `reservation-backend/migrations/20261108150000-create-student-feedback.js`
- `reservation-backend/migrations/20261108150100-grant-student-feedback-permission.js`
- `reservation-backend/migrations/20261110160000-student-feedback-cases.js`
- `reservation-backend/migrations/20261110160100-grant-student-feedback-manage-permission.js`

兩支 grant 只補已有 `role_permissions` 的角色，不建立工單資料表。

### C. Student Feedback 測試

- `reservation-backend/tests/studentFeedbackService.test.js`
- `reservation-backend/tests/security/studentFeedbackAuth.test.js`
- `reservation-backend/tests/studentFeedbackMysql.integration.test.js`
- `reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.test.jsx`

學生端頁面沒有對應的 Vitest 檔。

### D. Student Feedback 文件

`docs/issue-reporting/` 全部未追蹤：

- `ISSUE_REPORTING_AUDIT.md`
- `ISSUE_REPORTING_ARCHITECTURE.md`
- `ISSUE_REPORTING_IMPLEMENTATION_PLAN.md`
- `ISSUE_REPORTING_TEST_PLAN.md`
- `ISSUE_REPORTING_SECURITY_BACKLOG.md`
- `ISSUE_REPORTING_SCHEMA_READINESS.md`
- `ISSUE_REPORTING_RELEASE_CHECKLIST.md`
- `ISSUE_REPORTING_CONSOLIDATION_REPORT.md`

### E. 既有無關變更

不要納入學生回報 commit：

- `.mysql-data/`
- `eears_2026-09-18_18-29.sql.gz`
- `presentation-build/`

### F. 無法確定歸屬的變更

沒有。`StudentAccountPage.jsx` 的現有 diff 已歸在 A，並註明它不是優先級功能。

## Architecture Consistency

仍是同一套 `student_feedback`，沒有第二套工單表。案件、留言、事件、優先級都掛在既有 service 與 admin router。

`kind` 仍是問題回報或建議／許願。`category` 沿用預約、問卷、帳號、培力、其他，並多了學習歷程與介面顯示。舊的 category 字串沒有被改寫。不在白名單的已存值，讀取時會顯示原字串；拿它當篩選條件會得到 400。

優先級可空，不回填成 P2。它表示處理順序，不是嚴重程度。

## API Contract Audit

| 功能 | 契約 | 結果 |
|------|------|------|
| 學生建立 | `POST /api/student/feedback` 只收 kind、category、message、replyRequested | 一致。body 裡的 priority 不會進 create |
| 學生列表與詳情 | session 學號，不含內部備註與 priority | 一致 |
| 學生補充 | 只改自己的案件；結案後補充會寫狀態事件 | 一致。這次沒有改這段語義 |
| 管理列表 | kind、status、category、priority、關鍵字、承辦、日期、排序白名單 | 前端有送這些參數。priority `unset` 對應 SQL `IS NULL` |
| 詳情 | view 可讀；內部備註只在 manage | 一致。前端再濾一次 public，不是唯一防線 |
| Summary | 只有筆數 | 一致，不含個資 |
| 狀態與指派 | 既有 PATCH，manage | 一致。三態語義沒改 |
| 優先級 | 同一支 PATCH 的 `priority` | 一致。空值可寫回未設定 |
| 分類篩選 | 白名單，含兩個新項目 | 學生表單與後台選項相同 |
| 優先級排序 | 白名單欄位 `priority`，未設定排在後面，再以 id 穩定排序 | 一致。使用者字串不會直接進 SQL |
| 時間軸 | `GET /:id/events`，每頁最多 50，舊到新 | 切換案件會忽略過期回應。載入更多以 id 去重。狀態、指派、優先級成功後會重讀 |
| 公開回覆與內部備註 | manage。備註不進新案信，也不進事件正文 | 一致 |

舊案件 `priority` 為 NULL 時，列表與詳情顯示未設定，篩選「未設定」仍查得到。

## Migration Dependency

正式環境順序：

1. `20241201000006-create-teachers.js`。`teachers.id` 是 signed `INTEGER`。
2. `20261108150000-create-student-feedback.js`
3. `20261110160000-student-feedback-cases.js`。依賴 `student_feedback` 與 `teachers`。
4. `20261112161000-student-feedback-events.js`。依賴 `student_feedback` 與 `teachers`。
5. `20261112173000-student-feedback-priority.js`。SQL 只依賴 `student_feedback` 已存在。執行中的程式還需要前面的欄位與事件表。

Model、留言關聯、事件關聯與 `priority` 索引和這些 migration 一致。優先級 migration 沒有 UPDATE，不會把舊列改成 P2。`20261110160000` 新增 `status` 與 `replyRequested` 時有資料庫預設值，既有列會得到 `open` 與要求回覆；那是該支既有 migration 的行為，不是這次回填優先級。

這些 migration 不依賴學生回報以外的未提交功能。

隔離空庫已依序執行四支學生回報 migration 的 `up`。沒有對 `.mysql-data/`、備份檔或正式庫執行，也沒有執行 `down`。

回滾風險：

- `20261112173000` 的 `down` 只刪優先級索引與欄位。`PRIORITY_CHANGED` 事件列會留著。新程式還在查這個欄位時不能先 `down`。
- `20261112161000` 的 `down` 只刪事件表，不刪案件。
- `20261110160000` 的 `down` 會刪留言表與狀態、承辦、結案欄位。有對話時不能執行。
- `20261108150000` 的 `down` 會刪整張案件表。

## Authorization Review

| 檢查 | 結果 |
|------|------|
| 學生只讀自己的案件 | 沿用 session 學號。既有測試仍通過 |
| 學生不能指定 priority | 建立參數沒有這個欄位。測試確認 create 不含 priority |
| View-only 不能修改 | PATCH、回覆、備註為 403 |
| View-only 不能取得內部備註 | 列表搜尋與詳情在 SQL 限定公開留言 |
| Manage 可處理 | 狀態、指派、優先級、回覆、備註 |
| Summary | 只有筆數 |
| Events | 只回狀態、承辦或優先級的原值與新值。view 只讀 `visibility=staff` |
| 新案信 | 主旨與本文只有案件編號與後台列表連結 |
| 搜尋 | 沒有 manage 時不搜內部備註正文 |
| 交易 | 工單更新與事件同一筆 transaction，並使用 `FOR UPDATE` |

View-only 仍可看全部案件的學號、姓名、信箱與問題內容。這次沒有改角色政策，維持待決策。

## Test Matrix

數字分開計算，不互相累加。

| 項目 | 指令或範圍 | 結果 |
|------|------------|------|
| Service 與授權 | `tests/studentFeedbackService.test.js`、`tests/security/studentFeedbackAuth.test.js`、`tests/teacherRoleAccess.test.js` | Passed。3 suites、60 tests、0 failed |
| 管理端 UI | `AdminStudentFeedbackPage.test.jsx` | Passed。22 tests、0 failed |
| 學生端 UI | 沒有對應測試檔 | Not Executed |
| 隔離 MySQL | `studentFeedbackMysql.integration.test.js`，空庫 `eears_fb_it_phase2b1` | Passed。1 suite、5 tests、0 failed |
| Frontend build | `npm run build` | Passed。exit 0，約 24 秒 |
| 正式庫 | 沒有連線 | Not Executed |
| Migration `down` | 沒有執行 | Not Executed |
| 以 `submitStudentFeedback` 在真實 MySQL 建案並寄信 | 整合測試用 model 建列，沒有走寄信 | Not Executed |
| HTTP 層的詳情與排序 | 隔離測試打的是 service | Not Executed。mock 測試有涵蓋 |

隔離 MySQL 有涵蓋：四支 migration 的 `up`、案件列建立、狀態、指派、優先級、事件、未變更不寫事件、更新與事件失敗 rollback、`FOR UPDATE`、未設定優先級仍可查。測試結束後已關閉該 MySQL，並刪除暫存 datadir。

## Remaining Risks

- 正式庫四支 migration 的套用狀態仍是 UNKNOWN。程式先上、欄位未上時，後台列表會查詢失敗。
- View-only 個資範圍尚未決定。
- 學生入口沒有自動化 UI 測試。
- `20261110160000` 與 `20261108150000` 的 `down` 會刪資料。
- 新案信的真實 SMTP 沒有在這次寄出。

## Git Integration Plan

Phase 2B.1 的建議是檔案層級的三個 commit。`studentFeedbackService.js` 同時包含摘要、事件、信件與優先級，不拆成多個 phase commit。邊界如下：

1. 後端與 migration：A 的後端檔、B 的兩支新 migration、C 的三支後端測試。程式依賴這兩支 migration，必須同一批或先 migration 再程式。
2. 前端：API、管理頁、學生分類選項、帳號頁入口、管理頁 Vitest。可在後端 commit 之後。帳號頁入口不依賴優先級欄位，但現在的 diff 很小，不必再拆。
3. 文件：D 的全部 markdown。可最後 commit。

每一批都不要加入 E。不要把 `.mysql-data/`、SQL 備份或 `presentation-build/` 放進 commit。

推上 `main` 會碰到既有的正式部署 workflow。整合階段在取得授權前不要 push。

資料庫相容：新程式需要四支學生回報 migration 都已 `up`。回滾程式時，優先級欄位與事件表可以先留著；不要為了回程式去 `down` 案件表或留言表。

適合用獨立 feature branch 審查。分支起點是 `e066a073`。

## Phase 2B.2 Git Record

2026-11-12 已在本機建立分支，沒有 push、merge 或部署。

| 項目 | 值 |
|------|----|
| 分支 | `feature/student-feedback-management` |
| 起點 | `e066a07373228aeb3151077f58cf62cf44fbf017` |
| Commit 1 | `6cda01f` `feat(student-feedback): add management workflow and audit support` |
| Commit 2 | `2b7623d` `feat(student-feedback): enhance admin dashboard and student entry` |
| Commit 3 | 本文件所在的 `docs(student-feedback): document implementation and release gates` |

`.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/` 仍留在工作區，沒有 stage。Production Migration Status 維持 UNKNOWN。Production Ready 維持否。

## Release Gate

| 項目 | 狀態 |
|------|------|
| Engineering Ready | 本機可接受 |
| Database Ready | 否 |
| Security Ready | 部分完成。view 個資待決策 |
| Integration Ready | 只有隔離 MySQL |
| Production Ready | 否 |

## Recommended Next Step

本機三個 commit 已在 `feature/student-feedback-management`。下一步是審查這個分支。取得授權前不要 push 或 merge。正式機仍先做唯讀 schema 核對，確認前不要部署，也不要把舊案件改成 P2。
