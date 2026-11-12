# 學生回報上線檢查表

- 日期：2026-11-12
- 狀態：Phase 1 程式在本機工作區。沒有對應的上線，下面每一項都尚未勾選。
- 本次禁止部署。不要把本文件當成已經可以上線。Production Ready 維持否。

## Phase 1 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機程式與測試可接受 | summary、KPI、列表欄位、排序白名單已在工作區。Jest 29 通過、Vitest 8 通過、`npm run build` exit 0。尚未 commit。 |
| Data Validated | 否 | 正式庫沒有查過。`20261110160000` 是否已套用是 Unknown。本階段測試用 mock，沒有對正式或本機重要資料跑 migration。 |
| Security Review | 未結案 | summary 的 401／403 已測，且回應只有筆數。內部備註、全庫個資、新案信與稽核四項仍在 `ISSUE_REPORTING_SECURITY_BACKLOG.md`。權限語義沒有改。 |
| Production Ready | 否 | 上面 Data 與 Security 未過，也沒有部署。建置成功不能當成可上線。 |

## Phase 1.5 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機程式與 mock 測試可接受 | 內部備註改由後端依 manage 過濾。狀態與承辦事件和工單更新同一筆 transaction。Jest 37 通過、Vitest 10 通過。production build 見當次回報。 |
| Data Validated | 否 | `20261110160000` 與新建的 `20261112161000-student-feedback-events.js` 都尚未在正式庫確認。本階段沒有對正式庫或本機重要資料執行 migration。 |
| Security Review | 部分完成 | view 不再取得內部備註。全庫個資與新案信內容仍在。事件不含留言正文。沒有真實資料庫的並行測試。 |
| Production Ready | 否 | 兩支學生回報 migration 的正式套用狀態未驗證，剩餘兩項安全待辦未處理，也沒有部署。 |

## Phase 1.6 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機可接受 | 新案信改為案件編號與後台連結。Jest 權限回歸 3 suites、57 tests 通過。Vitest 10 通過。`npm run build` exit 0。 |
| Database Ready | 隔離測試庫通過，正式庫未驗證 | `20261108150000`、`20261110160000`、`20261112161000` 在 `127.0.0.1:3316` 的 `eears_fb_it_phase16` 套用成功，欄位、外鍵、索引與交易測試通過。正式庫 SequelizeMeta 沒有查，狀態是 Unknown。不能把隔離庫結果當成正式 Schema。 |
| Security Ready | 部分完成 | 新案信個資已最小化，並以 mock 測試。view 的學號、姓名、信箱與內文維持現況，等待業務決定。內部備註仍只有 manage 可讀。 |
| Integration Ready | 隔離 MySQL 通過 | 4 項真實 MySQL 測試通過，含狀態／指派事件、無變化不寫事件、更新與事件失敗 rollback、第二個 `FOR UPDATE` 看到已提交狀態。沒有對正式庫或 `.mysql-data` 執行。 |
| Production Ready | 否 | 正式 Schema 未驗證，view 個資尚未決定，也沒有部署。 |

## Phase 1.7 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 沿用 Phase 1.6 | 本階段沒有改產品程式。 |
| Database Ready | 否，正式庫 Not Verified | 2026-11-12 在 `LAPTOP-IVA4HK36` 停止查詢。沒有確認的正式庫唯讀授權，沒有讀 `.env`，沒有 `SequelizeMeta`、`INFORMATION_SCHEMA` 或 `SHOW CREATE TABLE`。三支 migration 都是 UNKNOWN。隔離庫結果不能記入本項。 |
| Security Ready | 沿用 Phase 1.6 | 沒有新的正式庫證據。view 個資仍待決定。 |
| Integration Ready | 沿用 Phase 1.6 的隔離庫 | 本階段沒有對正式庫做交易或並發測試。 |
| Production Ready | 否 | Database Ready 未通過，也沒有部署。 |

## Phase 2A Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機可接受 | 詳情區處理歷程。Vitest 18 通過。既有學生回報 Jest 37 通過。production build 見當次回報。 |
| Database Ready | 否 | Production Migration Status 維持 UNKNOWN。本階段沒有查正式庫，也沒有改 schema。 |
| Security Ready | 沿用 Phase 1.6 | 歷程只顯示狀態與承辦變更。view 的案件個資仍待決定。 |
| Integration Ready | 未在本階段重跑 | 不把 Phase 1.6 的隔離庫結果改寫成正式庫通過。 |
| Production Ready | 否 | Database Ready 未通過，也沒有部署。 |

## Phase 2B Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機可接受 | 可空優先級、既有 PATCH、PRIORITY_CHANGED。Jest 40 通過。Vitest 22 通過。production build 見當次回報。 |
| Database Ready | 否 | Production Migration Status 維持 UNKNOWN。隔離庫 `eears_fb_it_phase2b` 的 5 項測試不能當成正式 Schema。 |
| Security Ready | 沿用既有權限 | 只有 manage 能改優先級。view 可看。學生不能設定，回應也不含優先級。 |
| Integration Ready | 隔離 MySQL 通過 | 優先級欄位、交易與兩筆更新的鎖定已在拋棄式 MySQL 測過。正式庫沒有測。 |
| Production Ready | 否 | 正式 Schema 未驗證，也沒有部署。 |

## Phase 2B.1 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機可接受 | 2026-11-12 整合檢查。Jest 3 suites、60 tests 通過。Vitest 22 通過。`vite build` exit 0。沒有改產品程式。 |
| Database Ready | 否 | Production Migration Status 維持 UNKNOWN。隔離庫 `eears_fb_it_phase2b1` 的 5 項測試只證明拋棄式 MySQL。 |
| Security Ready | 部分完成 | 學生不能改優先級、view 不能 PATCH、內部備註與新案信已收斂。view 仍可看學號、姓名、信箱與內文，維持待決策。 |
| Integration Ready | 隔離 MySQL 通過 | 四支學生回報 migration 在空庫依序 `up`。狀態、指派、優先級、事件、rollback 與鎖定有測。正式庫沒有測。`down` 沒有執行。 |
| Production Ready | 否 | 沒有正式 schema 證據，也沒有部署。 |

## Phase 2B.2 Release Gate

| 項目 | 狀態 | 證據 |
|------|------|------|
| Engineering Ready | 本機分支已封裝 | `feature/student-feedback-management`，起點 `e066a073`。後端 `6cda01f`，前端 `2b7623d`，文件為下一個 commit。沒有改產品行為。 |
| Database Ready | 否 | Production Migration Status 維持 UNKNOWN。本階段沒有對正式庫執行 migration。 |
| Security Ready | 部分完成 | 沿用 Phase 2B.1。view 個資仍待決策。 |
| Integration Ready | 沿用隔離 MySQL | 本機封裝不取代正式庫驗證。 |
| Production Ready | 否 | 沒有 push、merge 或部署。 |

## 上線前

- [ ] 正式庫已有 `student_feedback`。若沒有，先跑 `20261108150000-create-student-feedback.js`。
- [ ] 正式庫已有 `status`、`replyRequested`、`assignedTeacherId`、`closedAt` 與 `student_feedback_messages`。對應 `20261110160000-student-feedback-cases.js`。
- [ ] 正式庫已有 `student_feedback_events`。對應 `20261112161000-student-feedback-events.js`。它依賴 `student_feedback` 與 `teachers`。
- [ ] 正式庫已有可空的 `priority` 與 `idx_student_feedback_priority`。對應 `20261112173000-student-feedback-priority.js`。既有案件保持未設定，不要先改成 P2。
- [ ] `npx sequelize-cli db:migrate` 在正式機成功，且 `SequelizeMeta` 含上述檔名。部署腳本不會自動做這一步。
- [ ] 沒有開啟正式環境 `ENABLE_DB_SYNC`。
- [ ] 新 migration 的 `down` 只刪本次新增的欄位或表，不刪既有案件。
- [ ] `can_view_student_feedback` 與 `can_manage_student_feedback` 對應的角色與程式 `accessProfile.js` 一致。空的角色列不會被 grant migration 塞成只剩這一鍵。
- [ ] 後台列表、summary、學生列表都用已登入身分打過，而不是只看前端按鈕。
- [ ] 學生詳情回應沒有 `visibility=internal` 的正文。
- [ ] 寄到中心的信失敗時，案件仍在，畫面上信件狀態不是成功。
- [ ] 沒有把 JWT、Cookie、密碼寫進新欄位或 log。
- [ ] 若有附件：大小與類型有上限，下載要權限，檔案不在未授權靜態目錄。
- [ ] Phase 1 的 Jest 新增案例已在 CI 相同指令下跑過。未跑過的不要寫進上線說明。

## 上線後抽樣

- [ ] `/admin/student-feedback` 能列出既有案件，狀態仍是待處理／處理中／已結案。
- [ ] 結案一筆「希望回覆」且尚無公開回覆的案件，會被拒絕。
- [ ] 學生帳號只看到自己的案件。
- [ ] 一般老師帳號打不開後台列表。
- [ ] 預約與問卷 Gate 各走一筆既有路徑，確認這次沒有改到它們。

## 回滾

- [ ] 還原應用程式到上一個已知的 `main` SHA。
- [ ] 若 migration 已加上新欄位，執行該支的 `down`，或保留可空欄位並還原舊程式（舊程式忽略新欄位時可不必立刻 `down`）。
- [ ] 不刪 `student_feedback` 既有列。
- [ ] 不把郵件失敗當成必須回滾案件的條件。
