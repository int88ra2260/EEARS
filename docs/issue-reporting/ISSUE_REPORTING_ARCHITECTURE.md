# 學生回報架構建議

- 日期：2026-11-12
- 狀態：建議，尚未實作。依據 `ISSUE_REPORTING_AUDIT.md`。
- 原則：擴充現有 `student_feedback`，不要新增平行的 Issue／Ticket 系統。

## 沿用

| 既有 | 繼續負責 |
|------|----------|
| `studentFeedbackService.js` | 驗證、狀態、權限前置條件 |
| `studentFeedbackRouter.js` | 學生 session、只碰自己的案件 |
| `adminStudentFeedbackRouter.js` | `authMiddleware` + `requirePermission` |
| `StudentFeedback`、`StudentFeedbackMessage` | 案件與留言 |
| `can_view_student_feedback`、`can_manage_student_feedback` | 查看與處理。新能力先掛在這兩鍵，必要時再拆鍵 |
| `teachers.id` 當承辦 | 指派對象仍用 `isAssignable` 的中心人員條件 |
| Bootstrap 5 + `design-system.css` 的 `#2a5d9f` | 後台頁不另做配色 |
| `sendEmailWithLog` | 通知。寄信失敗不回滾案件 |

不修改預約、Survey Gate、BESTEP、Learning Journey、成效分析公式、JWT 簽章規則。

## 資料，只增不毀

既有列的 `status` 保持 `open`／`in_progress`／`closed`。新狀態用新的字串值，經 migration `addColumn` 或放寬檢查，不重建資料表、不把舊值改名。

建議後續新增、且都可空或有預設，以免舊列失敗：

| 欄位 | 用途 | 預設 |
|------|------|------|
| `priority` | P0–P3 | `P2` 或 NULL。正式預設要等業務確認，程式先允許 NULL |
| `severity` | Critical／Major／Minor／Cosmetic | NULL |
| `title` | 列表標題。舊列可用內容前若干字在讀取時產生，不強制回填 | NULL |
| `moduleKey` | 學生選的發生位置。與現有 `category` 分開 | NULL |
| `occurredAt`、`pageUrl` | 學生選填 | NULL |
| `duplicateOfId` | 指向同一表的 `id`，可空 | NULL |

技術資訊（browser、os、deviceType、frontendVersion、requestId、errorCode）若要存，單獨可空欄位，且拒絕寫入密碼、JWT、Cookie、Authorization。

附件不要塞進 `message`。新表 `student_feedback_files`：案件 id、儲存檔名（伺服器產生）、原始檔名、mime、大小、上傳者、時間。下載走已登入 API，不放進公開 `/uploads`。

歷程新表 `student_feedback_events`：案件 id、事件類型、操作者 teacher id 或學生學號、時間、JSON 前後值。狀態與承辦更新和事件插入放在同一個 transaction。留言可繼續留在 `student_feedback_messages`，時間軸讀兩張表合併，不必把舊留言搬進事件表。

## API 形狀

### Phase 1 已存在

`GET /api/admin/student-feedback/summary` 必須註冊在 `GET /:id` 之前。權限與列表相同：先 `authMiddleware`，再 `requirePermission(can_view_student_feedback)`。未登入 401，沒有權限 403 `INSUFFICIENT_PERMISSIONS`。

成功回應沿用 `{ success: true, ... }`：

```json
{ "success": true, "total": 0, "open": 0, "inProgress": 0, "closed": 0, "unresolved": 0 }
```

數字來自 `StudentFeedback.findAll` 的 `GROUP BY status`，沒有列表的 `where`、`limit` 或 `offset`。`unresolved` 是 `open + in_progress`。空表為 0。資料裡若出現這三態以外的 `status`，會計入 `total`，不計入三態或 `unresolved`。查詢失敗走既有 `errorHandler`，Sequelize 資料庫錯誤為 500，訊息是「資料庫查詢失敗 (Database query failed)」，回應不含學生個資。

列表 `GET /api/admin/student-feedback` 新增可選 query：

| 參數 | 允許值 | 預設 |
|------|--------|------|
| `sortBy` | `createdAt`、`updatedAt`、`id` | `createdAt` |
| `sortOrder` | `asc`、`desc` | `desc` |

省略或空字串用預設。其他值回 400，`code` 為 `STUDENT_FEEDBACK_INVALID`，不會進 SQL。排序是 Sequelize 欄位陣列。`sortBy` 不是 `id` 時，次要鍵固定 `id DESC`，讓相同時間的分頁穩定。預設因此仍是 `createdAt DESC, id DESC`。

列表與詳情的 staff 物件多了既有欄位 `updatedAt`。案件編號用既有數字 `id`，沒有新增 `ticket_number`。

### Phase 1.5 權限與稽核

詳情 `GET /:id` 與列表關鍵字會依 `can_manage_student_feedback` 決定是否包含 `visibility=internal`。只有 view 時，查詢條件就是公開留言，不是前端隱藏。回覆、備註、PATCH 仍要 manage。學生 API 維持只看自己的公開留言。

`GET /api/admin/student-feedback/:id/events` 需要 view。案件不存在回 404。排序是 `createdAt ASC, id ASC`，每頁沿用 1 到 50。view 只讀 `visibility=staff`。回應只留狀態或承辦人的原值與新值，不帶回留言正文。沒有事件的舊案件回空陣列，詳情仍可讀。

沒有使用 `audit_logs`。該服務寫入失敗只記 log，而且先緩衝再寫，不能與工單更新同一筆 transaction。因此新增 `student_feedback_events`。狀態或承辦人有實際變化時，工單 `UPDATE` 與事件 `INSERT` 使用同一個 Sequelize transaction，並以 `SELECT ... FOR UPDATE` 讀取目前列。數值沒變不寫事件。任一步失敗就 rollback。寄信留在 transaction 之外，失敗仍不取消已寫入的公開回覆。

這不是真實 MySQL 的並行整合測試。鎖定與同一個 transaction 物件有 mock 驗證。正式庫尚未執行這支 migration。

### 尚未存在（Phase 2、Phase 3）

- 排序白名單沒有 `priority` 或 `status`。這兩個欄位排序尚未做。
- `PATCH /:id` 沒有 `priority`、`severity`、`duplicateOfId`。
- 學生 `GET /:id` 維持去掉 `visibility=internal`。後台詳情仍把內部備註交給所有 view。若政策改為僅 manage 可讀，後台 `GET /:id` 也要依權限過濾，不能只藏按鈕。見 `ISSUE_REPORTING_SECURITY_BACKLOG.md`。

## 狀態遷移（建議）

在現有三態上追加，而不是替換：

- `open` → `in_progress`｜`closed`（後者仍受「需要公開回覆」約束）
- `in_progress` → `closed`，以及未來的 `waiting_for_user`、`pending_verification`
- `closed` → `in_progress`（現有「改回處理中」與學生補充）
- 禁止 PATCH 成 `open`
- 每一次允許的變更寫事件：原狀態、新狀態、操作者、時間、原因

`waiting_for_user`、`pending_verification`、`resolved` 尚未存在。實作前要先定中文標籤，以及它們和「已結案」哪一個會寫 `closedAt`。

## 權限

Phase 1 的 summary 使用既有 `can_view_student_feedback`，沒有新權限鍵。匯出若在 Phase 3 才做，再考慮是否新鍵。在那之前不要讓 view 呼叫匯出。

KPI 定義：全部問題 = `total`，待處理 = `open`，處理中 = `inProgress`，已結案 = `closed`，未結案 = `unresolved`。五個數字同一母體，不受列表篩選或分頁影響。

內部備註：學生 API 與只有 view 的後台讀取都已過濾。Phase 2A 沒有改這條規則。

## Phase 2A 處理歷程

後台詳情區的「處理歷程」只讀既有 `GET /api/admin/student-feedback/:id/events`。沒有新資料表、新事件類型或新權限鍵。

- 需要 `can_view_student_feedback`。manage 沿用同一支 API，由後端決定 `includeInternal`。
- 畫面只呈現 `STATUS_CHANGED` 與 `ASSIGNEE_CHANGED` 的類型、操作者、原始值、新值與台北時間。狀態用待處理、處理中、已結案。
- 承辦人姓名只從已載入的承辦名單對照。對不到時顯示 `教師 #編號`，不編造姓名。學生操作者只顯示「學生」。
- 不顯示 `requestId`、留言正文，也不顯示 `visibility=internal` 的事件。後端本來就不回留言正文；前端也不把未知欄位印出來。
- 切換案件會清掉上一筆並忽略過期回應。狀態或指派成功後重新讀取，並接著把後續頁補齊，避免新事件留在最後一頁看不到。讀取失敗只顯示在歷程區，案件正文仍在。
- 第一次只取第 1 頁，每頁 50 筆。筆數還有剩時顯示「載入更多」。合併時以事件 id 去重，並依時間與 id 由舊到新排。

已知限制：正式庫的事件表仍是 UNKNOWN。教師若已不在可指派名單，歷程只顯示編號。回覆或備註本身沒有獨立事件，只會在連帶的狀態變更出現。

## Phase 2B 分類與優先級

分類沿用 `student_feedback.category`。既有值 `reservation`、`survey`、`account`、`english_test`、`other` 不改寫。另補兩個還沒有的項目：`learning_journey`（學習歷程）、`display`（介面顯示）。「功能異常」與「功能建議」仍由既有 `kind` 的問題回報、建議／許願表示，不另建一套分類。

優先級是處理順序，不是嚴重程度。`priority` 可空，值只有 `P0`、`P1`、`P2`、`P3`。空值顯示未設定，不預設成 P2。學生不能設定，學生回應也不帶這個欄位。view 可看，只有 manage 能改。變更走既有 `PATCH /api/admin/student-feedback/:id`，與 `PRIORITY_CHANGED` 事件同一筆 transaction。值沒變不寫事件。列表的分類、優先級篩選與優先級排序都在資料庫，排序欄位仍是白名單。未設定的優先級排在已設定之後。

時間軸沿用 Phase 2A，優先級事件寫成「優先級由 A 調整為 B」。正式庫是否已有這個欄位仍是 UNKNOWN。

## 通知

已有新案通知與公開回覆通知。指派、結案、逾期是後加，且失敗只記 `emailStatus` 或郵件日誌，不讓案件 transaction 失敗。

## 明確不做

- 不建立 `issues`、`support_tickets` 表。
- 不把學生回報統計併入 Learning Analytics 的 KPI 契約。
- 不在正式環境開 `ENABLE_DB_SYNC`。
