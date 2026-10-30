# 跨層發現（CROSS_LAYER_FINDINGS）

- 日期：2026-10-29
- 這份文件整合既有盤點，並用程式再核對跨層關係。舊登錄裡兩個項目的嚴重度已改，見文末校正。
- 未改應用程式、未連資料庫、未讀取真實學生列。

## 共同根因

| ID | 根因 | 它造成的表面症狀 |
|----|------|------------------|
| RC-1 | 學號字串被每個模組各自存一份，沒有單一擁有者 | 多表、長度 20／50／80、黑名單走 `Users.id`、預約走字串 |
| RC-2 | 學期先是業務代碼，後來又加整數表與 `et_semesters` 字串主鍵 | 篩選要在 SQL 裡同時接三種表示 |
| RC-3 | 新的讀模型疊在舊寫入之上，舊寫入沒有先清掉呼叫端 | BESTEP、`exam_attempts`、`et_exam_attempts`、`lj_student_events` 並存 |
| RC-4 | 公開與管理端共用 `/api` 前綴，認證掛在各路由而不是前綴 | 新路由可能漏 `authMiddleware`；個人查詢出現三種證明方式 |
| RC-5 | 管理端路由、側欄、權限矩陣是三份手寫清單 | 新頁面容易只改到其中一份 |

不是根因、不要當成缺陷合併的項目列在 `ARCHITECTURAL_INVARIANTS.md`。

## XL-01 問卷 my-status 回傳整筆作答

- 先前編號：AUD-SEC-03（當時是 SUSPECTED）
- 信心：**CONFIRMED**（回應形狀來自程式，不是來自一筆真實資料）
- 風險：知道 `surveyId` 與 `studentId` 的呼叫端可以讀到姓名、信箱與 `answersJson`
- 層次：`surveyGatewayRouter` → `surveyCenterService.myStatus` → `survey_responses`
- 證據：
  - `GET /api/surveys/my-status` 沒有 `authMiddleware`（`routes/surveyGatewayRouter.js`）
  - `myStatus` 用 `findOne` 且沒有 `attributes`，回傳 `{ filled, latest: row }`（`services/surveyCenterService.js`）
  - 模型欄位包含 `studentName`、`studentEmail`、`answersJson`（`models/SurveyModuleResponse.js`）
  - Sequelize 預設會選出所有欄位
- 前端實際填寫檢查**不是**這條。`surveyPublicApi.checkSurveyFilled` 打 `/api/surveys/check/:surveyId/:studentId`，而該處理器只回 `{ filled, semester }`，且只接受兩個 legacy 問卷鍵（`routes/surveyRouter.js`）。全前端沒有呼叫 `my-status`。
- 受影響元件：問卷 gateway、任何仍握有舊客戶端的人。現行 `SurveyPage.js` 不依賴 `latest`。
- 必要測試：未認證呼叫時 JSON 不得含 `answersJson`、`studentName`、`studentEmail`。`/check/...` 仍只回布林與學期。
- 驗證步驟：用測試替身建立一筆 `SurveyModuleResponse`，打 gateway，斷言鍵集合。不要對正式庫發請求。
- 優先：P1。修補小，且不依賴學生登入覆蓋率。

## XL-02 微學習軌跡可把客戶端學號寫進分析投影

- 信心：**CONFIRMED**
- 風險：資料完整性。匿名練習可以繼續；帶學號的完成事件會變成 `lj_student_events`。
- 層次：遊戲元件 → `submitLearningTrace` → `POST /api/learning-traces` → `recordLearningTrace` → `projectTraceToLearningJourney`
- 證據：
  - 路由沒有 JWT（`routes/learningTraceRouter.js`）
  - `session_complete` 且 body 有 `studentId` 時會 `LjStudentEvent.create`（`services/learningTrace/learningTraceProjectionService.js`）
  - 前端用 `getVoluntaryStudentId()`，存在 `sessionStorage` 鍵 `eears_voluntary_student_id`（`utils/learningStudentLink.js`、`utils/learningEventPayload.js`）
  - 管理端讀取 `/api/admin/learning-traces/*` 有 `CAN_VIEW_LEARNING_ANALYTICS`
- 這是刻意的「自願連結」，不是學生登入。問題在伺服器相信 body 裡的學號，而不是在遊戲要不要匿名。
- 受影響元件：Word Bridge、Listening Ladder、Vocabulary Depth／Size、`lj_student_events`
- 必要測試：沒有通過驗證的 `studentId` 不得新增 `lj_student_events`。沒有學號的 `session_complete` 仍可寫 `learning_trace_events`。
- 驗證步驟：mock `LjStudentEvent.create`，送一筆帶他人學號的完成事件，斷言沒有 create。
- 優先：P1。不要改成「所有遊戲都要學生 JWT」，否則未登入練習會壞。

## XL-03 學生學習歷程 dashboard 用預約三要素，不是 session

- 信心：**CONFIRMED**
- 風險：功能與隱私。門檻是「學號 + 姓名 + email 對得上某一筆預約」，不是密碼。對得上之後回傳遊戲化、推薦、未到次數與最近軌跡。
- 層次：`learningTraceApi.fetchStudentLearningJourneyDashboard` → `GET /api/student-learning-journey/dashboard` → `verifyStudentIdentity`
- 證據：`requireStudentContext` 只檢查三欄都有值。`verifyStudentIdentity` 用 `Reservation` 的 `studentName` 與 `studentEmail` 比對（`studentLearningJourneyService.js`）。有 rate limit。找不到回 404，不回預約內容。
- 與預約個人 API 的差異是架構選擇未收斂，不是同一套登入漏掛。預約建立已用 `studentAuthMiddleware` + `bindStudentIdentity`。
- 受影響元件：學生學習歷程 dashboard、預約表上的姓名與信箱
- 必要測試：三要素不符回 404 且 body 不含推薦。相符時仍回傳目前欄位（鎖住現況，改綁定前不要先改形狀）。
- 驗證步驟：mock 兩筆預約，只讓其中一組三要素通過。
- 優先：P1（個資門檻弱於帳號）。改成強制學生 JWT 前要確認這個頁面的使用者是否都已有學生帳號。在那之前不要拆三要素。

## XL-04 教師參與端點沒有權限鍵，但沒有回傳名冊

- 先前編號：AUD-SEC-02（當時把資料外洩寫得過重）
- 信心：**CONFIRMED**
- 風險：低到中。任何有效 staff JWT 都能呼叫。範圍是 `Teacher.name` 對 `Class.teacherName`。回應只有 `classId`、`className`、`department`、`studentCount`。學號有查出來但沒有放進 JSON（`teacherController.getStudentParticipation`）。
- 前端 `src` 沒有呼叫 `/teachers/students/participation`。
- 必要測試：若保留端點，無 token 為 401；回應鍵不得出現 `studentId`。權限鍵要等確認沒有外部呼叫端再加。
- 優先：P2。不要為了「補權限」先把學號加回回應。

## XL-05 學期三種表示靠一個 SQL 轉接點硬接

- 信心：**CONFIRMED**
- 風險：功能。同一學期代碼若在 `semesters`、`et_semesters`、`semesterConstants` 的日期不一致，活動篩選會多算或少算。
- 層次：呼叫端傳入 `114-1` 這類字串 → `buildSemesterEventFilter` 同時 JOIN `semesters.id`、`semesters.code`、`et_semesters.id`，並可加上靜態日期（`services/learningJourney/utils/semesterEventFilter.js`）
- 其他邊界：問卷 `SurveyRule.semesterId` 是整數；培力報名與班級成員存字串；`Event.semesterId` 是可空整數且 `models/index.js` 沒有 `belongsTo(Semester)`。
- 必要測試：給定一個代碼，SQL 條件含這三個來源；空代碼不加 JOIN。日期衝突時的預期要先寫成規格，現在不要改 SQL。
- 優先：P1（正確性），但第一個動作是特徵測試，不是改資料。

## XL-06 成績三線仍有活的消費者

- 信心：**CONFIRMED** 寫入與掛載仍在。正式庫是否重複計數：**UNVERIFIED**（未查資料）
- 風險：分析人數與成長曲線
- 證據：
  - `syncBestepScoresToExamAttempts` 把 `bestep_exam_scores` 寫進 `exam_attempts`
  - `et_exam_attempts` 仍是 legacy 表
  - 讀模型預設 v3，只有環境變數明確 `false` 才關（`learningJourneyFeatureFlags.js`）
  - 學期門檻預設 `115-1` 之後阻擋 legacy 寫入（`canonicalSemesterPolicyService.js`）
  - 前端學習歷程頁的 API 基底是 `/api/admin/learning-journey-v3`（`learningJourneyV3Api.js`）
  - **仍在用舊路由的呼叫端**：`LearningJourneyV3ImportSection.jsx` 的課程名冊 dry-run／apply 來自 `learningJourneyApi.js`，基底是 `/api/admin/learning-journey`
  - `LearningJourneyHubPage.jsx` 與 `LearningJourneyStudentPage.jsx` 使用舊 hook，但 **沒有** 出現在 `App.js`
- 優先：P1。在名冊匯入改接 v3 之前，不能卸下 `learningJourneyRouter`。

## XL-07 管理端三清單的漂移是流程風險，不是已點名的壞連結

- 信心：結構 **CONFIRMED**。目前是否已有一條選單指向不存在的路由：**未做完整自動 diff**。
- 抽樣：側欄裡的 `/admin/operations`、`/admin/learning-analytics/explore`、`/admin/speaking-diagnostic`、`/admin/teachers/dashboard`、`/admin/account/reset` 在 `App.js` 與 `adminRouteAccess.js` 都有對應。
- legacy 重導向（英檢追蹤、`student-explorer`）同時寫在 `App.js` 與 access 矩陣，這是刻意保留舊網址。
- 必要測試：從 `App.js` 抽出 `/admin` 子路徑，每條都能在 `adminRouteAccess.js` 找到 pattern，或標成 redirect。
- 優先：P1（預防）。不要為了測試變綠而刪掉舊網址。

## XL-08 個人流程的認證故意不相同

| 流程 | 證明 | 判定 |
|------|------|------|
| 預約、我的預約、進度、課堂加分、培力個人報名 | 學生 JWT，`bindStudentIdentity` | 與護欄一致 |
| 英語學習護照 | email 驗證碼、captcha、rate limit；頁面沒有 `RequireStudentAuth` | 刻意的另一套。未確認學生帳號覆蓋率前不要改成 JWT |
| 學習有伴組隊 | 公開建立與同意 token；管理端另有 auth | 刻意 |
| 口說題組主持 | 第三種 JWT，`typ === 'speaking-host'`（`speakingCheckSetService.signHostToken`） | 刻意，不是 staff 漏掛 |
| 問卷 legacy 是否已填 | 學號在路徑上，只回布林 | 與 XL-01 不同，不要一起改壞 |
| 微學習 | 匿名，學號自願 | 見 XL-02 |

## XL-09 `/uploads` 與口說音檔有兩條讀取路徑

- 信心：兩條路徑 **CONFIRMED**。檔名是否可猜、目錄裡有沒有證件：**UNVERIFIED**（沒有列出上傳目錄）
- 證據：`server.js` 對 `uploadsPath` 做 `express.static`。口說音檔另有 `GET /api/speaking-host/responses/:responseId/audio`，該路由經 `readHostToken`。檔案寫在 `uploads/speaking-check/`，檔名是時間戳加隨機片段。
- 優先：P2。先分公開圖與受限檔的目錄，不要先關掉整個 `/uploads`。

## 對舊稽核的校正

| 舊敘述 | 校正 |
|--------|------|
| my-status「可能」含答案 | 程式會回傳整筆模型，含答案 JSON。改為 CONFIRMED |
| 教師參與端點會露出學生名冊 | 不會。只回班級統計。降為 P2 |
| `learningJourneyRouter` 可能只是死掛載 | 課程名冊匯入仍呼叫它。不能卸掛載 |
| 權限一致性腳本涵蓋前端 | 腳本比對的是帳號 JSON 與資料表，不掃 `accessControl.js` |
| 護照「沒有控管」 | 有 email 驗證碼與 captcha，只是沒有學生 JWT |

## 仍未驗證

- 正式庫的學號最大長度、成績是否重複、學期日期是否互相矛盾
- 每個 `/api/admin` 處理器是否都有 `requirePermission`
- `/uploads` 實際檔案類型
- 空白 `my-status` query 在 Sequelize 6 是丟錯還是忽略 `undefined`（未執行）
- 瀏覽器上的版面與手機月曆
