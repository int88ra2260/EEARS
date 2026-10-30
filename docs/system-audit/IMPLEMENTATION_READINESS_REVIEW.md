# Implementation Readiness Review

日期：2026-10-29。審查對象是既有的 `CONSOLIDATION_MASTER_PLAN.md` 與 `REFACTORING_DEPENDENCY_GRAPH.md`，不是重寫計畫。本輪沒有改應用程式碼。

判定用詞：

| 用詞 | 意思 |
|------|------|
| 已確認 | 本輪對過 repository 的函式、路由或呼叫端 |
| 假設 | 合理，但 repo 無法證明（例如 repo 以外的 HTTP client） |
| 需 runtime | 要跑測試、瀏覽器或授權請求才能關閉 |

總判：五個任務可以各自還原，也沒有互相改到同一個 production 檔。T1 與 T4 最接近可開工。T2、T3、T5 要先收斂規格，否則會做成「測過但沒保護到契約」的 PR。

---

## 1. 參照是否存在

| 計畫所寫 | 結果 |
|----------|------|
| `surveyCenterService.myStatus` | 已確認。回傳 `{ filled, latest: row \|\| null }`，`row` 是完整 `SurveyModuleResponse` |
| `GET /api/surveys/my-status` | 已確認。`surveyGatewayRouter.js` 無 auth，`res.json(data)` |
| `GET /api/surveys/check/:surveyId/:studentId` | 已確認。只回 `{ filled, semester }`，且只接受兩種問卷 id |
| `SurveyPage` / `surveyPublicApi.checkSurveyFilled` | 已確認。前端打的是 `/check`，不是 `/my-status` |
| `recordLearningTrace`、`projectTraceToLearningJourney` | 已確認。`session_complete` 且 body 有學號就投影 |
| `POST /api/learning-traces` | 已確認。無 JWT、無 rate limit |
| `getAdminRouteAccess` / `getAdminRouteDeniedReason` | 已確認。無規則時 `code: 'missing_rule'` |
| `buildSemesterEventFilter` | 已確認。空字串回空 filter；非空則 join `semesters` 與 `et_semesters`，靜態區間來自 `shared/semesterConfig.js` |
| `learningJourneyRouter` 兩次 `app.use` | 已確認。`/api/admin/learning-journey` 與 `/api/v3/learning-journey` |
| `postAcademicCourseRosterDryRun` / `Apply` | 已確認。只有 `LearningJourneyV3ImportSection.jsx` 呼叫 |

Repo 內沒有 `my-status` 或 `myStatus` 的 script、前端或測試呼叫端。這是已確認。Repo 以外的監控或舊腳本仍是假設。

---

## 2. T1 會不會弄壞已知 client

不會弄壞目前 SPA，前提是只改 `myStatus`，不動 `/check`。

已確認的 client 契約：

- `SurveyPage` 經 `checkSurveyFilled` 讀 `filled`。
- `/check` 對 `english_table_feedback_114_1` 與 `english_club_feedback_114_1` 回 `{ filled, semester }`。
- 其他 survey id 回 400 `UNSUPPORTED_SURVEY_TYPE`。
- `tests/` 目前沒有這兩條路由的契約測試。

`myStatus` 縮小成 `{ filled, submittedAt }` 對 SPA 是無呼叫端變更。若 repo 外有人讀 `latest.answersJson`，會壞；那是假設，不是已確認的 client。

開工前要補的負向條件：`surveyId` 或 `studentId` 缺漏時，handler 必須在 `findOne` 之前回 400。Sequelize 對 `where` 裡的 `undefined` 會不會查出任意列，本輪沒有執行，標為需 runtime。不能靠「縮小欄位」掩蓋缺參數。

---

## 3. T2 身分來源

計畫原文是「token 必須等於 body 才投影」。這仍把 body 當比對來源，不符合「只信伺服器解出的學生 token」。

已確認的現況：

- 前端 `learningEventPayload.js` 把 `sessionStorage` 的 `eears_voluntary_student_id` 放進 body。
- `submitLearningTrace` 不送 `Authorization`。
- `studentAuthMiddleware` 只接受學生 JWT，並把學號寫進 request；staff JWT 會被拒絕。
- 投影寫入 `LjStudentEvent.sourceRecordId = trace:${id}`。

開工前要把規格改成：

1. 投影學號只來自通過 `studentAuthMiddleware` 的學生 token。
2. 不讀 body、query 或瀏覽器儲存的學號來決定投影對象。
3. body 學號與 token 不同：不投影、不把 body 學號寫入 `learning_trace_events`。建議此情況回 400，讓送錯身分的 client 看得到。
4. 沒有學生 token：仍可寫匿名 trace（漏斗用），`studentId` 為 null，且不投影。
5. Staff JWT 不得被當成學生身分。

這會改變自願學號功能：匿名練習不再把 sessionStorage 學號送進歷程。那是資料完整性修正，不是無行為變更。既有 `LjStudentEvent` 列不刪。

---

## 4. Rollback 會不會把漏洞加回來

| 任務 | 計畫中的 rollback | 判定 |
|------|-------------------|------|
| T1 | 還原 `myStatus` | Git revert 會恢復完整列外洩。可以當緊急還原，不可以留在生產環境。沒有 migration，還原本身乾淨 |
| T2 | `TRACE_PROJECT_CLIENT_STUDENT_ID=true` | 不合格。這個開關在不 revert 程式的情況下，就會恢復 XL-02。應從計畫拿掉 |
| T3–T5 | 刪測試 | 不改變 runtime，不會重開漏洞 |

T2 的安全 rollback 只有 revert 該 commit。不要做「預設關閉、可再打開」的相容旗標。

---

## 5. T3 有沒有同時測「有規則」和「規則有效」

計畫只要求 pathname 對得到 pattern，或該路由是 redirect。這只覆蓋存在性。

已確認的有效性機制在 `adminRouteAccess.js`：

- `getAdminRouteAccess` 用分數挑最具體的規則，不是檔案裡的第一條。
- `canAccessAdminRoute` 才判斷權限、角色、staff level。
- `getAdminRouteDeniedReason` 回 `missing_rule`、`unauthenticated`、`forbidden` 或 `null`。
- 權限字串必須是 `permissions.js` 的 `P` 成員，否則規則存在但永遠無法授權。
- `adminNavigation.test.js` 已測部分導覽可見性，沒有測「每個 `App.js` admin route 都有有效規則」。

T3 在補上下列之前，不算就緒：

- 對真實 `getAdminRouteAccess(pathname)` 斷言，而不是只做字串包含。
- 規則裡的 permission 鍵都屬於 `P`。
- 負向：不存在的 pathname 得到 `missing_rule`。
- 負向：沒有該權限的 profile 得到 `forbidden`，不是 `null`。
- 一條巢狀路徑必須命中較具體的規則，而不是被父路徑吃掉。
- Redirect route 可以沒有授權規則，但必須在測試裡明示清單，避免漏網頁面被當成 redirect。

不要求在這個任務裡窮舉每種角色。那會和權限矩陣重複，也容易過度擬合文案。

---

## 6. T4 是否在測行為而不是 SQL 排版

`reservation-backend/tests/semesterEventFilter.test.js` 已經存在，而且測的是行為片段：

- `''` → join/where 空、replacements 空物件。
- `'114-2'` → replacements 含學年與 `2026-02-01`～`2026-07-31`，join 含 `et_semesters`，where 含 code 與日期條件。
- `isEventDateInSemester` 對區間內外各一筆。

`114-1` 也在 `shared/semesterConfig.js`（2025-08-01～2026-01-31）。計畫寫「114-1」沒有錯，但現有測試用的是 `114-2`。不要為了對齊計畫再複製一份快照測試。

缺口：不在 `SEMESTER_RANGES` 的代碼仍會 join 兩張學期表，但不應出現 `semesterStart`。現有測試沒蓋到。

過度擬合：現有測試把日期寫死。日期若改在 `semesterConfig.js`，測試會紅，這是設定耦合，不是 SQL 空白耦合。建議斷言改為讀取 `SEMESTER_RANGES['114-2']`，並只檢查 join/where 包含資料表與具名 placeholder。不要 `toBe` 整段 SQL。

T4 因此改為「補一筆未知學期代碼」，不是新開一套 SQL characterization。

---

## 7. T5 有沒有保護真正的 consumer 與掛載點

計畫要檢查 import 名稱，以及 `server.js` 仍 `app.use` 該 router。這兩個條件都太弱。

已確認的實際契約：

- Client：`BASE_URL = '/api/admin/learning-journey'`，再接 `/admin/academic-course-roster/dry-run` 與 `/apply`。
- Router：同一組 path 定義在 `learningJourneyRouter.js`。
- 掛載後的 URL 是 `/api/admin/learning-journey/admin/academic-course-roster/...`（`admin` 出現兩次，client 與 server 一致）。
- 第二個掛載 `/api/v3/learning-journey` 不是這個畫面在用的。
- `App.js` 沒有掛 `LearningJourneyHubPage` 或 `LearningJourneyStudentPage`。它們仍 import `learningJourneyApi`，但是未進入路由的 consumer。
- `postLearningJourneyCourseImportDryRun` / `Apply` 沒有 import 端。

只檢查「檔案有 import 這個函式」時，函式可以繼續存在、URL 卻被改掉，測試仍綠。只檢查「檔案裡看得到 `learningJourneyRouter`」時，刪掉 `/api/admin/learning-journey` 而留下 v3 掛載，測試也可能仍綠。

T5 必須同時固定三件事：client 路徑字串、router 路徑字串、`app.use('/api/admin/learning-journey', learningJourneyRouter)`。不要把 v3 掛載或未路由頁面算進這次的通過條件。也不要因此刪除 hub / student page。

---

## 8. 缺的負向與失敗路徑

完整案例在 `T1_T5_TEST_MATRIX.md`。這裡只列會改變就緒判定的缺口。

| 任務 | 缺什麼 |
|------|--------|
| T1 | 缺參數 400；回應鍵白名單；`/check` 既有契約；已登入與否都不得回 `answersJson` |
| T2 | body 與 token 不一致；只有 sessionStorage 學號；staff JWT；匿名 funnel 仍 201；錯誤 token 不得寫入攻擊者學號；重複 trace 不重複投影 |
| T3 | 權限鍵不在 `P`；`missing_rule`；`forbidden`；較具體路徑勝出 |
| T4 | 未知學期代碼沒有靜態起迄；空白／null 與空字串相同。需 runtime 補跑一次現有測試 |
| T5 | client 路徑與 mount 前綴拆開後對不上時必須失敗 |

---

## 9. 平行 PR 會撞到的檔案

這五個任務彼此不改同一個 production 函式。前提是 T3、T5 只新增測試，T4 只改既有測試檔。

| 任務 | 會改的檔 | 與其他四個任務 |
|------|----------|----------------|
| T1 | `surveyCenterService.js`、`surveyGatewayRouter.js`（缺參數 400）、新測試 | 無重疊 |
| T2 | `learningTraceService.js` 或 projection service、`learningTraceRouter.js`、新測試 | 無重疊 |
| T3 | 新的 frontend test | 只讀 `adminRouteAccess.js`、`App.js` |
| T4 | `semesterEventFilter.test.js` | 只讀 filter 與 `semesterConfig.js` |
| T5 | 新的 frontend 或 backend 字串契約測試 | 只讀 `server.js`、`learningJourneyRouter.js`、`learningJourneyApi.js`、`LearningJourneyV3ImportSection.jsx` |

容易和別的工作撞車、但不是這五個任務互相撞車的檔案：

- `surveyCenterService.js`、`surveyGatewayRouter.js`：問卷重構會撞 T1。
- `learningTraceRouter.js`：若同時加 rate limit，會撞 T2。
- `adminRouteAccess.js`：導覽權限調整會讓 T3 變紅，但不一定是 git conflict。
- `server.js`：任何掛載變更都會讓脆弱的全文比對變紅。T5 應只比對那一行前綴。

不要把五個任務合成一個 PR。各自一個 commit 才能獨立 revert。

---

## 10. 能否獨立還原

可以，條件如下。

| 任務 | 還原方式 | 還原後的風險 |
|------|----------|----------------|
| T1 | revert service 與 router 的該 commit | 恢復 my-status 完整列。無 schema 變更 |
| T2 | revert 該 commit。不要留 env 開關 | 恢復未驗證學號投影。已寫入的列不會自動刪除 |
| T3 | 刪測試 | 無 runtime 差異 |
| T4 | revert 測試增補。保留已存在的 `semesterEventFilter.test.js` | 無 runtime 差異 |
| T5 | 刪測試 | 無 runtime 差異 |

---

## 就緒判定

| 任務 | 判定 | 開工前必須改的規格 |
|------|------|-------------------|
| T1 | 可開工 | 缺參數先 400；回應鍵白名單；加一條 `/check` 契約測試 |
| T2 | 不可照原文開工 | 身分只來自學生 token；刪除 rollback env |
| T3 | 不可照原文開工 | 測試存在性與有效性，含 `missing_rule` 與 `forbidden` |
| T4 | 可開工，範圍縮小 | 只補未知學期代碼；日期從 `SEMESTER_RANGES` 讀取；不新增第二份 SQL 快照 |
| T5 | 不可照原文開工 | 同時鎖定 client URL、router path、`/api/admin/learning-journey` 前綴 |

舊文件裡仍有「my-status 是否回傳個資尚未驗證」的句子（`CONSISTENCY_AUDIT.md`、`DOMAIN_RULES_MATRIX.md`）。以 `SECURITY_VERIFICATION_MATRIX.md` 的已確認判定為準。本輪不回頭改那些舊檔。
