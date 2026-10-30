# 收斂主計畫（CONSOLIDATION_MASTER_PLAN）

- 日期：2026-10-29
- 這份計畫取代「把每一個重複都改掉」的做法。實作順序以 `REFACTORING_DEPENDENCY_GRAPH.md` 為準。
- 不變量以 `ARCHITECTURAL_INVARIANTS.md` 為準。發現編號用 `CROSS_LAYER_FINDINGS.md` 的 XL。

## 排序原則

先排已用程式確認、而且修補範圍可以獨立驗證的項目。資料庫裡尚未量到的重複成績、學號長度，排在只讀對帳之後。視覺不一致排在更後面。

| 順位 | 項目 | 為什麼先後 |
|------|------|------------|
| 1 | XL-01 my-status 整筆作答 | 已確認的讀取面，現行畫面不依賴它 |
| 2 | XL-02 軌跡投影信任 body 學號 | 已確認的寫入面。匿名遊戲要留著 |
| 3 | XL-07 路由三清單對照測試 | 沒有行為變更，擋住下一次漏登記 |
| 4 | XL-05 學期篩選特徵測試 | 沒有行為變更，先鎖住三來源 OR |
| 5 | XL-06 舊路由消費者清單 | 沒有行為變更，阻止誤卸掛載 |
| 6 | 預約 Gate／學號綁定的非占位測試 | 為以後抽出建立預約 |
| 7 | 學期與成績的只讀對帳 | 要連測試庫或正式庫的唯讀帳號，不在這次文件裡執行 |
| 8 | 名冊匯入改接 v3 | 等第 5 項清單 |
| 9 | dashboard 與護照的認證產品決定 | 等覆蓋率，不在前五項改程式 |
| 10 | 上傳目錄分離 | 等檔案類型清點，清點時不得把檔名內容貼進票裡 |

## 前五項可獨立實作的任務

### 任務 1 — 收斂 my-status 的回應

- 對應：XL-01
- 變更：`surveyCenterService.myStatus` 只回 `{ filled, submittedAt }`。`submittedAt` 可為 null。不回傳模型、不回傳 `answersJson`、姓名、email、metadata。
- 不變更：`/api/surveys/check/:surveyId/:studentId` 的 `{ filled, semester }`。`SurveyPage.js` 繼續用這條。
- 驗收：
  - 測試替身有一筆含答案的 `SurveyModuleResponse`。
  - 未認證 GET my-status 的 JSON 鍵只有 `filled` 與 `submittedAt`。
  - `filled === true` 當列存在。
  - check 路由的測試仍只有布林與學期。
- 回滾：還原 `myStatus`。沒有 migration。
- 風險：若有未進本倉庫的客戶端讀 `latest`，會壞。倉庫內前端沒有呼叫。上線前用記錄搜尋 `my-status` 一次即可，沒有紀錄就照驗收上線。

### 任務 2 — 未驗證的學號不寫入學習歷程投影

- 對應：XL-02
- 變更：`projectTraceToLearningJourney` 只有在學號通過伺服器驗證時才 `create`。驗證的第一版用學生 JWT，且 token 的學號必須等於 body。沒有 token 時仍寫 `learning_trace_events`，但 `studentId` 欄位存 null，也不投影。
- 自願連結：`sessionStorage` 的學號不再足以投影。若產品仍要「未登入但自願綁定」，另做短時效簽章，不在這個任務。
- 不變更：遊戲仍可匿名遊玩。管理端三條聚合路由仍要 `CAN_VIEW_LEARNING_ANALYTICS`。
- 驗收：
  - `session_complete` 帶學號、無學生 JWT：有軌跡列、`studentId` 為 null、`LjStudentEvent.create` 未被呼叫。
  - 學生 JWT 學號與 body 一致：投影列的 `studentId` 等於 token。
  - JWT 與 body 不一致：不投影。
- 回滾：環境變數 `TRACE_PROJECT_CLIENT_STUDENT_ID=true` 恢復舊行為，預設 false。變數只給回滾，不寫進說明書當長期功能。
- 風險：今天已靠自願學號投影的練習會從隔天起不再進入 `lj_student_events`。既有列不刪。

### 任務 3 — 管理端路由必須有存取規則

- 對應：XL-07、RC-5
- 變更：只加測試。從 `App.js` 的 `/admin` 子路由取出 path，正規化參數，斷言 `adminRouteAccess.js` 有 pattern，或該元素是 `Navigate`／`AdminLegacyRedirect`。
- 不變更：不刪舊網址，不改側欄。
- 驗收：現有路由全數通過。故意拿掉一條 pattern 時測試失敗。
- 回滾：刪測試。
- 風險：參數寫法 `:eventId` 與 `*` 的比對要先用現有檔案調到全綠，不能為了綠而把缺規則改成警告。

### 任務 4 — 鎖住學期篩選的三來源

- 對應：XL-05、RC-2
- 變更：只加測試。對 `buildSemesterEventFilter`：
  - 空字串：沒有 JOIN、沒有 WHERE。
  - `114-1`：SQL 文字含 `semesters`、`et_semesters`，且 replacements 的代碼等於輸入。
  - 靜態區間存在時，replacements 含起迄日。
- 不變更：不改 OR 條件，不对帳正式日期。
- 驗收：測試描述的是目前函式的輸出，不是理想的單一學期表。
- 回滾：刪測試。
- 風險：測試若寫得太死（整段 SQL 字串），格式化會誤紅。斷言應檢查必要片段與參數。

### 任務 5 — 舊學習歷程路由的消費者護欄

- 對應：XL-06、RC-3
- 變更：只加測試或一個會在 CI 跑的靜態檢查：`LearningJourneyV3ImportSection.jsx` 仍 import `postAcademicCourseRosterDryRun` 與 `postAcademicCourseRosterApply`，且 `server.js` 仍 `app.use` `learningJourneyRouter`。測試失敗訊息寫明「名冊匯入仍依賴這條掛載」。
- 不變更：不搬移匯入、不卸掛載、不刪 `LearningJourneyHubPage.jsx`。
- 驗收：現況通過。從 `server.js` 移除掛載的程式變更會讓測試失敗。
- 回滾：刪測試。那只該發生在名冊匯入已經改接 v3 之後。
- 風險：低。這是防止誤刪，不是功能變更。

## 這五項完成後的下一刀

1. 用測試替身補上預約 409 `redirectUrl` 與學號覆寫，取代 `reservationFlow.test.js` 的占位斷言。
2. 只讀對帳：學期三來源的起迄日、BESTEP 與兩種 attempt 的筆數。對帳腳本不得寫入。
3. 把課程名冊的兩個函式改到 v3 路由，再讓任務 5 的測試反過來要求新路徑。然後才討論卸下舊掛載。
4. 產品決定 dashboard 與護照是否改學生 session。決定前維持三要素與 email 驗證碼。

## 明確延後

| 項目 | 原因 |
|------|------|
| 合併學生表 | 沒有單一擁有者的遷移計畫，且會打斷預約與黑名單 |
| 刪除 `et_*` | 消費者與歷史學期政策未完成 |
| 共用 DataTable、統一 downloadBlob | P3，不影響已確認的安全與完整性問題 |
| 移除 `zod`、`bcrypt`、`axios` | 可以做，但是獨立的依賴 PR，不插進前五項 |
| 教師參與端點補權限 | 前端沒有呼叫，回應也沒有名冊。補權限前先確認沒有外部整合 |
| 關掉 `/uploads` | 公開圖片可能依賴它 |

## 整體驗收

前五項都合併之後：

- 問卷是否已填的公開契約仍是布林。整筆答案只出現在已有權限的管理端匯出。
- 匿名微學習仍寫軌跡。`lj_student_events` 裡新的微學習列，其學號都來自己驗證的學生 token。
- CI 會在管理端路由缺規則，或有人卸下仍被名冊匯入使用的學習歷程掛載時失敗。
- 學期篩選的 SQL 仍同時認識三種來源，而且有測試擋住意外刪掉其中一個 JOIN。
- 預約 Gate、取消驗證碼、黑名單學期、CEFR／GSE 分工都沒有被這五項改到。
