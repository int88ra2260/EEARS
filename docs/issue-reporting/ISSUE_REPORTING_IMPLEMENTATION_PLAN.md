# 學生回報分階段實作計畫

- 日期：2026-11-12
- 狀態：Phase 1 到 Phase 2B 的程式或文件在工作區。尚未 commit、尚未上線。附件、SLA 與 Phase 3 尚未開始。Production Migration Status 維持 UNKNOWN。
- 依據：`ISSUE_REPORTING_AUDIT.md`、`ISSUE_REPORTING_ARCHITECTURE.md`。

工作區現有未提交的 `StudentAccountPage.jsx` 不要在後續階段被覆蓋或順便提交。

## Phase 1（P0）基礎管理

### 驗收前阻塞

正式庫必須已套用 `20261108150000` 與 `20261110160000`。未套用時後台列表會查詢失敗。這次盤點沒有連線正式庫，所以這一步是上線檢查，不是已完成項。

### 改動範圍（預計）

| 類型 | 檔案 |
|------|------|
| 修改 | `studentFeedbackService.js`、`adminStudentFeedbackRouter.js`、`AdminStudentFeedbackPage.jsx`、`studentFeedbackApi.js` |
| 新增 migration | 只在確定要優先級／標題時才加可空欄位。Phase 1 若只做計數與列表欄位，可以不改 schema |
| 測試 | 擴充 `studentFeedbackService.test.js` 與 `studentFeedbackAuth.test.js` |
| 不改 | 預約、問卷 Gate、BESTEP、Learning Journey、成效分析、`auth.js` 的 JWT 驗證本體 |

### 工作

1. `GET /summary`：回傳 `open`、`in_progress`、`closed` 與總數。未結案 = `open + in_progress`。不要發明「待確認」「已解決」計數，除非該狀態已經寫進資料。
2. 列表顯示 `id`、內容摘要、`kind`、學生、`category`、狀態、承辦、`createdAt`、`updatedAt`。`updatedAt` 已存在，不必 migration。
3. 維持現有篩選。補「清除篩選」只重置 query，不改 API。
4. 排序白名單。預設維持 `createdAt DESC, id DESC`。
5. 詳情補編號與更新時間。技術資訊與附件標成尚無資料，不要做假欄位。
6. 狀態仍只用現有三態與現有結案規則。若產品要六態，另開 migration，並寫不合法轉換測試後才改 UI。

### 驗收

- 計數來自 summary API，改分頁不會改變 KPI。
- 無 view 權限的帳號呼叫 summary 與列表得到 401 或 403。
- 舊的三態資料仍能列表、結案、改回處理中。
- 預約建立與問卷 409 的既有測試仍通過。

### 回滾

未改 schema 時還原上述檔案即可。若已加可空欄位，`down` 只刪新欄位，不刪 `student_feedback`。

### Phase 1 實際完成（2026-11-12）

已完成使用者授權的項目：全庫 summary、後台 KPI、列表案件編號與 `updatedAt`、排序白名單、對應測試與本目錄文件。沒有新增 migration。

本計畫原先多寫的「清除篩選」按鈕，以及詳情區另顯示編號與更新時間，不在這次授權範圍，沒有做。詳情 API 因 `presentStaff` 已帶 `updatedAt`，但詳情標題沒有另外畫出編號。

Phase 2 的附件、時間軸畫面、重複工單，以及 Phase 3 的 SLA、匯出、新狀態，都還沒有實作。

### Phase 1.5 實際完成（2026-11-12）

已完成：view 不能讀內部備註、manage 可以讀寫、狀態與承辦變更寫入 `student_feedback_events` 並與工單更新同一筆 transaction、`GET /:id/events`。沒有做時間軸畫面、附件、新狀態、SLA 或匯出。

新 migration：`20261112161000-student-feedback-events.js`。`down` 只刪這張事件表。它依賴既有 `student_feedback` 與 `teachers`。正式庫是否已有 `20261110160000` 仍是 Unknown，所以這支也不能視為已可在正式環境執行。

## Phase 2（P1）生命週期

依賴 Phase 1 的列表與詳情已上線。

1. 指派歷史寫入 `student_feedback_events`。
2. 公開回覆與內部備註維持 `visibility`。決定 view 是否仍讀得到 `internal`；若否，改 `getStudentFeedback` 與任何匯出。
3. 時間軸合併事件與留言。
4. 學生補充已存在，只把「結案後補充回到處理中」顯示在時間軸。
5. `duplicateOfId` 可空自參照。不刪除重複案件。

驗收：學生 token 呼叫自己的詳情與他人的詳情；他人 404。學生回應不含 `internal`。無 manage 不能 POST replies／notes。指派非中心人員仍 400。

回滾：新表可 `down`；既有留言不刪。

## Phase 3（P2）統計、SLA、匯出、通知

依賴案件有穩定的 `createdAt`、`closedAt`、狀態。優先級統計在 `priority` 欄位存在之後才做。

1. 指標定義寫進文件再寫查詢：每週新增用 `createdAt`；每週結案用 `closedAt`；重開率要等事件表有「自 closed 到 in_progress」才算，不能用現況猜測。
2. SLA 時數放設定表或既有 settings，預設空。空表示不告警。不把 P0=24 小時寫死成政策。
3. 匯出用目前篩選、權限與 manage 或獨立鍵。CSV 儲存格避免以 `=`、`+`、`-`、`@` 開頭。不含內部備註，除非匯出者有內部備註讀取權。
4. 指派與逾期信失敗只記日誌。

驗收：匯出筆數等於同一篩選的 `total`，不是目前頁的 20 筆。無內部權限的匯出檔沒有備註正文。

## 權限對照（實作時）

| 動作 | 現有鍵 |
|------|--------|
| 學生建立、列表、詳情、補充 | 學生 middleware，不使用 staff 鍵 |
| 後台列表、詳情、summary | view |
| 回覆、備註、狀態、指派、優先級 | manage |
| 匯出 | 未定。預設不要讓 view 匯出全部個資，除非產品明確要求 |

## UI

`AdminStudentFeedbackPage` 由上而下：KPI、現有篩選列、表格、現有詳情區、時間軸。繼續用 Bootstrap 與現有按鈕。桌面 1440、平板 768、手機 375 時表格留在 `Table responsive` 內。

## Phase 2A（處理歷程）

只加詳情區的時間軸。使用既有 events API，不改 schema、狀態語義或權限。正式庫仍是 UNKNOWN，Database Ready 與 Production Ready 維持否。設計與限制見 `ISSUE_REPORTING_ARCHITECTURE.md` 的 Phase 2A 節。

## Phase 2B（分類與優先級）

沿用 `category`，不改舊值。新增可空 `priority`，不回填。PATCH 與 `PRIORITY_CHANGED` 同一筆 transaction。正式庫仍是 UNKNOWN，Database Ready 與 Production Ready 維持否。回滾這支 migration 只刪優先級欄位與索引；已部署的新程式不能在欄位被刪之後繼續查它。
