# 學生回報 Pre-PR 審查

- 日期：2026-11-12
- 審查範圍是實際 diff 與呼叫端，不是只看既有稽核文件。
- 本階段沒有改產品程式，沒有 commit、push、merge 或部署。
- 本階段沒有重跑 Jest、Vitest、隔離 MySQL 或 production build。覆蓋率結論來自閱讀測試與程式。

## Review Scope

`e066a07373228aeb3151077f58cf62cf44fbf017..HEAD`，共 24 個檔案。含後端 service、model、兩支新 migration、admin router、信件範本、管理頁、學生入口、API client、Jest、Vitest 與 `docs/issue-reporting/`。學生 router 與 `20261108150000`、`20261110160000` 已在起點，這次仍讀了它們的呼叫關係。

未追蹤且未審查內容：`.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/`。

## Git Baseline

| 項目 | 值 |
|------|----|
| 分支 | `feature/student-feedback-management` |
| HEAD | `77e76ffaa4616b2fa456567428c406be0be8c70b` |
| Base | `e066a07373228aeb3151077f58cf62cf44fbf017` |
| Commit | `6cda01f` 後端、`2b7623d` 前端、`77e76ff` 文件 |

`main` 仍停在 base。工作區沒有已修改的產品檔。

## Findings by Severity

### High

#### 切換案件時，詳情回應可能改到另一筆

- File：`reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.jsx`
- Line：303–318、438–448、676–678、698–699
- Evidence：`loadTimeline` 用 `eventsRequest` 忽略過期回應。`loadDetail` 沒有對應的請求代號。`selectRow` 會立刻改 `selectedId`，但列高亮看的是 `selectedId`，表單送出用的是 `detail.id`。先點案件 A、再點案件 B 時，A 的慢回應可以在 B 之後寫回 `detail`、承辦人與優先級。
- Impact：畫面列高亮是 B，結案、指派、優先級、公開回覆或內部備註卻送到 A。時間軸可能已經是 B。
- Suggested Fix：詳情也使用遞增的請求代號，只接受最後一次點選的 id。送出時若 `detail.id` 與 `selectedId` 不同，不要呼叫 API。這是前端修正，不改 API 語義。

### Medium

#### 列表請求沒有忽略過期回應

- File：`reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.jsx`
- Line：253–274
- Evidence：`load` 在 `finally` 直接 `setItems`。篩選、排序或換頁連續觸發時，較早的回應可以覆蓋較新的條件。
- Impact：列表短暫或持續顯示不符合目前篩選的案件。不會直接寫入錯誤案件，但操作者可能點到不該出現的列。
- Suggested Fix：比照 summary 的 `summaryRequest`，只採用最後一次列表請求。

### Low

#### 連線失敗時優先級選單不回復

- File：`reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.jsx`
- Line：457–473
- Evidence：HTTP 失敗會把選單設回 `detail.priority`。`catch` 只顯示「與伺服器連線發生錯誤」，沒有回復選單。
- Impact：選單停在尚未寫入的值，詳情文字仍是舊值。
- Suggested Fix：`catch` 使用與失敗分支相同的回復。

#### 類型按鈕列沒有換行

- File：`reservation-frontend/src/pages/admin/AdminStudentFeedbackPage.jsx`
- Line：518
- Evidence：篩選表單有 `flex-wrap`。類型群組是 `d-flex gap-2`，沒有 `flex-wrap`。表格本身是 Bootstrap `Table responsive`。
- Impact：375px 下「建議／許願」可能把這一整列撐出畫面。表單、詳情與送出按鈕仍是直向排列，不依賴這列才能送出。本次沒有重新開瀏覽器量測。
- Suggested Fix：類型群組加上 `flex-wrap`。

#### 未知狀態在列表被顯示成待處理

- File：`reservation-backend/services/studentFeedbackService.js`
- Line：72–74、372–373
- Evidence：`statusLabel` 對不在白名單的值回傳待處理。時間軸的 `statusText` 則保留原字串。Summary 把未知狀態算進 `total`，但不算進 open、inProgress 或 closed。
- Impact：異常資料會讓列表看起來像待處理，而 `total` 可能大於三個狀態的和。正常寫入路徑只接受 open、in_progress、closed。
- Suggested Fix：未知狀態的 label 顯示原值，或在 summary 單獨計數。不要把既有三態改名。

#### 搜尋留言先取出全部符合的案件編號

- File：`reservation-backend/services/studentFeedbackService.js`
- Line：459–466
- Evidence：`findMessageIds` 沒有 limit。view 會加上 `visibility: 'public'`，manage 會搜內部備註。字元 `%` 與 `_` 會先被拿掉，條件由 Sequelize 參數化。
- Impact：留言變多時，一次搜尋可能先載入大量 id。不是 SQL injection，也沒有讓 view 讀到內部備註。
- Suggested Fix：維持權限條件，必要時再限制搜尋範圍。現有資料量不是合併阻擋項。

## Backend Review

| 檢查 | 結果 |
|------|------|
| Summary | 一次 `GROUP BY status`。空表回 0。不套用列表篩選。 |
| 排序與篩選 | 欄位與方向是白名單。優先級排序的 NULL 條件是固定 SQL，使用者字串沒有拼進去。非法 category、priority、sort 回 400。 |
| Priority NULL | 未傳入的新案不寫 priority。`unset` 是 `IS NULL`。空字串與 `unset` 在更新時寫回 null。相同值不寫事件。 |
| Transaction | `withTransaction` 先 commit，失敗則 rollback。狀態、承辦、優先級與事件在同一筆 transaction。 |
| `FOR UPDATE` | `loadCaseLocked` 只鎖案件列，沒有同時 lock outer join。 |
| 事件失敗 | `bulkCreate` 丟出錯誤時，案件更新一起 rollback。 |
| 內部備註 | view 的詳情與搜尋在 SQL 限定 `visibility = 'public'`。 |
| 學生改 priority | 學生 router 不讀 `priority`。`create` 的欄位清單沒有它。 |
| N+1 | 列表用一次 assignee join。詳情另查留言，事件另查事件表。沒有逐列查詢。 |
| 錯誤型別 | 業務錯誤帶 status 與 code。資料庫例外交給全域 handler，正式回應是「資料庫查詢失敗」，不含 SQL。`NODE_ENV=development` 時既有 handler 會附加 `originalError`。 |

## Frontend Review

KPI 是全表統計，列表才吃篩選。兩邊數字只在沒有篩選時會一樣。這是目前契約，不是計數錯誤。

時間軸以 id 去重，並依時間與 id 排序。第一頁是最舊的 50 筆；更新成功後會依序補後面的頁，上限 20 頁。過期的時間軸回應會被丟棄。

優先級在 API 回錯誤時會回復。連線例外不會，見 Low。

`canManage` 為 false 時不渲染優先級、指派、結案、回覆與備註。前端另外濾掉 `visibility === 'internal'`，真正的隔離仍在 API。

`StudentAccountPage.jsx` 的 diff 只有「遇到問題」圓形入口，預設收合。`StudentFeedbackPanel` 仍送 kind、category、message、replyRequested，沒有 priority。分類多了學習歷程與介面顯示。

375px 這次沒有重新用瀏覽器操作。從版面看，學生表單是直向欄位與「送到中心」按鈕；管理表格在容器內橫向捲動；篩選列會換行。類型按鈕列是上面的 Low。

## API Contract Review

| API | 結果 |
|-----|------|
| GET summary | 200，`success` 與 total、open、inProgress、closed、unresolved。要 view 權限。 |
| GET list | 200。非法篩選或排序 400。page 與 pageSize 有上限。 |
| GET detail | 200 的 `item`。找不到是 404。view 不含內部備註。 |
| GET events | 200。舊到新。view 只查 `visibility = 'staff'`。事件值只留狀態、承辦或優先級。 |
| PATCH | manage。狀態不能改回 open。結案缺公開回覆時 409。priority 可為 null。 |
| POST reply / note | manage，201 或 200。備註正文不進事件。 |
| 學生建立與紀錄 | 學生 session。建立 201。不接受別人的學號或 priority。 |
| 未知分類 | 篩選與新建回 400。已存的未知值讀取時顯示原字串。 |
| 舊資料 | 沒有 priority 的列仍可列出，label 為未設定。 |

## Migration Review

順序是 `teachers`、`20261108150000`、`20261110160000`、`20261112161000`、`20261112173000`。`teachers.id` 與回報外鍵都是 signed `INTEGER`。

新的兩支 migration 沒有 `IF NOT EXISTS`。表或欄位已經存在時，重跑會失敗；Sequelize 不會把失敗的檔名寫進 `SequelizeMeta`。MySQL 的 DDL 可能在失敗前已經生效。這是部署時要停下來處理的情況，不是可以靠 `down` 當一般回滾。

`20261112173000` 沒有 UPDATE。`20261110160000` 的 `status` 與 `replyRequested` 有資料庫預設值，既有列會得到 open 與要求回覆。事件表的 `down` 會刪事件。案件 migration 的 `down` 會刪留言與狀態欄。不要在正式庫執行 `down`。

程式會查 `status`、`priority` 與事件表。程式比 migration 早上線時，後台列表會查詢失敗。部署 workflow 在 `main` 的 CI 成功後會跑正式機部署，腳本不會自動 migrate。

同一時分還有既有的 `20261110160000-drop-cancellation-code-from-email-overrides.js`。Sequelize 以完整檔名記錄，兩支都會跑，而且都早於這次新增的事件與優先級 migration。不是這次 diff 造成的衝突。

## Security Review

未登入呼叫管理 API 會在 `authMiddleware` 被拒絕。view 不能 PATCH、回覆或寫備註。view 的詳情與關鍵字搜尋不讀內部備註。學生查詢帶 session 學號，別人的案件回 404。學生建立不寫 priority。

新案信只有案件編號與後台列表網址。回覆信寄給學生本人，含該生姓名與學號，不含回覆正文。時間軸畫面把學生操作者顯示為「學生」，不顯示學號；API 的事件物件仍有 `actorStudentId` 與 `requestId`，view 本來就能在案件上看到學號。

正式環境的資料庫錯誤回應不回 SQL。前端沒有測試用的登入繞過。

View-only 仍可看全部案件的姓名、學號、信箱與內容。預設角色是 view 與 manage 一起給。這項維持待決策，這次沒有改政策。風險是：一旦有人只被授予 view，就能讀全部學生回報個資。

## Test Coverage Gaps

| 缺口 | 現況 |
|------|------|
| HTTP 與 service 分開 | 授權測試用 supertest，但 service 被 mock。真實 SQL 在另一支隔離測試，沒有走 HTTP。 |
| 學生端 UI | 沒有 Vitest。 |
| 真實 MySQL 的列表與排序 | mock 有檢查 whitelist。隔離測試沒有跑列表排序。 |
| 舊資料相容 | 隔離庫是空庫後 `up`。沒有先放入舊列再跑 `20261110160000` 的測試。 |
| 特殊字元 | 有短內容與非法分類。沒有搜尋 `%`、引號或控制字元的案例。 |
| 角色組合 | 有匿名、一般教師、view-only 與 manage。沒有把每種 staff level 都打到真實資料。 |
| 詳情與列表競態 | Phase 2B.4 已用可控制完成順序的 Promise 補上。見下方修正紀錄。 |

本次審查當時沒有把先前的 60、22、5 當成那次執行結果。Phase 2B.4 的測試數字見修正紀錄，不要與先前次數相加。

## Phase 2B.4 Resolution

### 原始 High Finding

切換案件時，較慢的詳情回應會覆蓋目前案件，管理操作可能送到上一筆。

### 根本原因

`loadDetail` 沒有請求代號。列高亮用 `selectedId`，表單送出用回應寫入的 `detail.id`。列表 `load` 也沒有請求代號。

### 修正方式

詳情、列表與進行中的管理操作各自使用遞增請求代號。過期的成功或失敗回應都不寫入目前畫面。切換案件時會清掉上一筆詳情，並讓進行中的操作不再更新新案件的詳情、表單或通知。

`fetchClient` 可以把 `signal` 傳給 `fetch`，但學生回報 API 函式沒有接上。這次沒有改共用 client。取消請求只是輔助；過期回應即使正常 resolve，也會被請求代號丟棄。

### 安全不變條件

只有 `detail.id` 與 `selectedId` 相同、詳情已載入、沒有進行中的操作，而且具有 manage 權限時，才發送狀態、結案、指派、優先級、公開回覆或內部備註。不符合時不呼叫變更 API，也不顯示成功通知。

### 其他修正

- HTTP 錯誤與網路錯誤都會把優先級選單回復到該案件最後確認的值。切換案件後，上一筆的失敗不會改新案件的選單。
- 列表與詳情改以狀態代碼顯示：`open` 待處理、`in_progress` 處理中、`closed` 已結案，其他顯示原值。沒有把未知狀態當成 open，也沒有改後端三態流程。API 的 `statusLabel` 仍可能把未知值標成待處理，畫面不再使用那個欄位。
- 類型按鈕列加上 `flex-wrap`，沿用既有 Bootstrap 間距，沒有新增配色。

### 測試證據

- `AdminStudentFeedbackPage.test.jsx`：29 tests 通過。含詳情競態、載入中不送出、送出後改選、列表競態、過期錯誤、優先級回復與未知狀態。
- 後端 `studentFeedbackService`、`studentFeedbackAuth`、`teacherRoleAccess`：3 suites、60 tests 通過。這次沒有改後端產品程式。
- `npm run build`：exit 0。
- 這不是正式環境驗證。

### 是否仍可重現

上述前端競態在測試裡不能再覆蓋目前案件。已送出的請求仍會在伺服器完成，只是畫面不會把結果套到新選取的案件。

### Remaining Risks

- 正式 migration 仍是 UNKNOWN。合併到 `main` 仍會在 CI 成功後部署。
- 搜尋留言沒有筆數上限。
- API `statusLabel` 對未知狀態仍回待處理。
- View-only 個資政策仍待決策。
- 進行中的讀取請求沒有 abort，只是忽略結果。

## PR Readiness

詳情競態已在前端修正，可以開 PR。修正 commit 是 `2ada344`。PR 說明仍要寫明 Production Migration Status 為 UNKNOWN。開 PR 不會部署。Production Ready 仍為否。

## Merge Blockers

詳情競態不再是合併阻擋項。合併到 `main` 仍會在 CI 成功後部署正式機。正式庫四支學生回報 migration 未驗證前，不應合併。

## Deployment Blockers

- Production Migration Status：UNKNOWN。
- Database Ready：否。
- Production Ready：否。
- 部署腳本不會執行 `sequelize-cli db:migrate`。
- 不得把 `down` 當成回滾。回程式時可留下新欄位與事件表。

## Recommended Fixes

1. 正式機先做唯讀 schema 核對，再決定 migration 與部署順序。
2. 確認這次前端修正後再 commit。建議訊息見階段回報。
