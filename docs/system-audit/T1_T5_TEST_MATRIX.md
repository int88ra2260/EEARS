# T1–T5 Test Matrix

日期：2026-10-29。這是實作時要寫的測試，不是本輪已執行的結果。案例分三類：正向、負向、失敗路徑。

「需 runtime」表示必須真的跑 Jest / Vitest，不能只做靜態閱讀。

---

## T1 — 縮小 `GET /api/surveys/my-status`

保護對象：`surveyCenterService.myStatus`、`surveyGatewayRouter`。回歸對象：`GET /api/surveys/check/:surveyId/:studentId`。

| ID | 類型 | 案例 | 期望 | 證據等級 |
|----|------|------|------|----------|
| T1-P1 | 正向 | 指定問卷與學號已有一筆 `SurveyModuleResponse` | `filled === true`，`submittedAt` 等於該列，HTTP 200 | 需 runtime |
| T1-P2 | 正向 | 無列 | `filled === false`，`submittedAt === null` | 需 runtime |
| T1-N1 | 負向 | 回應物件的鍵 | 只允許 `filled`、`submittedAt`。不得有 `latest`、`answersJson`、`studentName`、`studentEmail`、`metadataJson` | 需 runtime。模型欄位已確認 |
| T1-N2 | 負向 | 未帶 token | 與帶了無關 token 一樣，仍是縮小後的形狀。不得因「像管理員」回完整列 | 需 runtime |
| T1-F1 | 失敗 | 缺 `surveyId` 或 `studentId` | 400，且不呼叫 `findOne` | 規格補丁。Sequelize `undefined` where 的實際行為本輪未執行 |
| T1-F2 | 失敗 | `/check` 使用兩種已知問卷 id | 仍是 `{ filled, semester }`，不含答案 | 需 runtime。目前 `tests/` 沒有這條 |
| T1-F3 | 失敗 | `/check` 使用其他 survey id | 400 `UNSUPPORTED_SURVEY_TYPE` | 已確認 handler 有此分支；測試尚缺 |

不測：前端 `SurveyPage` 畫面。它不呼叫 my-status。

還原：revert T1 commit。沒有 migration。

---

## T2 — 微學習投影只信學生 token

保護對象：`POST /api/learning-traces`、`recordLearningTrace`、`projectTraceToLearningJourney`。

規格前提（與原文不同，見 readiness review）：投影學號只來自 `studentAuthMiddleware`。沒有學生 token 時可寫匿名 trace，不投影。

| ID | 類型 | 案例 | 期望 |
|----|------|------|------|
| T2-P1 | 正向 | `session_complete` + 有效學生 JWT，body 不帶學號 | 201。trace 與 `LjStudentEvent` 的學號都是 token 內的學號。`sourceRecordId` 為 `trace:${id}` |
| T2-P2 | 正向 | 非 `session_complete` + 有效學生 JWT | 201。可寫 trace。不建立 `LjStudentEvent` |
| T2-P3 | 正向 | 無 JWT 的 `page_view` / funnel 事件，body 無學號 | 201。`studentId` 為 null。無投影 |
| T2-N1 | 負向 | 有效學生 JWT，body 學號是別人 | 400 或不投影。`learning_trace_events.studentId` 不得是 body 的值。無 `LjStudentEvent` 指向 body 學號 |
| T2-N2 | 負向 | 無 JWT，body 或測試替身帶 sessionStorage 學號，`session_complete` | 201 或 400 皆可，但不得投影，不得保存該學號 |
| T2-N3 | 負向 | Staff JWT | 不得當成學生。不得投影到 staff 指定的學號 |
| T2-N4 | 負向 | 同一 `traceId` 再送一次 `session_complete` | 不產生第二筆 `LjStudentEvent` |
| T2-F1 | 失敗 | 格式錯誤的 Authorization | 401。資料庫不得出現攻擊者放在 body 的學號 |
| T2-F2 | 失敗 | 學生 JWT 的 `typ` 不是 `student` | 與 staff 相同，拒絕投影 |

不測：匿名事件的聚合數字是否下降。那是產品後果，不是這次的安全斷言。既有投影列不刪，所以測試要用新的 trace id。

還原：revert T2 commit。禁止用 env 把舊行為開回來。

---

## T3 — Admin route 規則存在且有效

保護對象：`getAdminRouteAccess`、`getAdminRouteDeniedReason`、`canAccessAdminRoute`，以及 `App.js` 的 `/admin` 路由。

測試應呼叫這三個函式，不要只對原始碼做 `includes`。

| ID | 類型 | 案例 | 期望 |
|----|------|------|------|
| T3-P1 | 正向 | `App.js` 每個非 redirect 的 admin path | `getAdminRouteAccess(path)` 不為 null |
| T3-P2 | 正向 | 每條命中規則的 `anyPermissions`、`allPermissions` | 每個字串都是 `P` 的值 |
| T3-P3 | 正向 | 擁有規則所需權限的 profile | `getAdminRouteDeniedReason` 為 `null` |
| T3-P4 | 正向 | 較長、較具體的 path（例如帶 `:id` 的子頁） | 命中分數較高的規則，而不是父層規則 |
| T3-N1 | 負向 | `/admin/__no_such_page__` | `code === 'missing_rule'` |
| T3-N2 | 負向 | 已登入但權限集合為空 | 對需要權限的頁面回 `forbidden`，不是 `null` |
| T3-N3 | 負向 | 沒有 role 的 profile | `unauthenticated` |
| T3-F1 | 失敗 | Redirect 清單 | 只允許測試檔裡明示的 legacy redirect 沒有授權規則。新增一般頁面卻忘了規則時，T3-P1 失敗 |
| T3-F2 | 失敗 | 規則引用不存在的 permission 字串 | 測試失敗。這是有效性，不是存在性 |

不測：每個角色對每個頁面的完整矩陣；按鈕文案；`missing_rule` 的中文標題全文。

Redirect 清單要以 `App.js` 的 `Navigate` / `AdminLegacyRedirect` 產生，避免手抄漏頁。抽樣時至少保留先前看過的 `/admin/operations`、學習分析探索、口說診斷、教師 dashboard、帳號重設，其餘靠程式掃全表。

還原：刪測試檔。

---

## T4 — 學期 filter 行為

檔案：沿用 `reservation-backend/tests/semesterEventFilter.test.js`。不要新增第二份快照。

現有兩則已覆蓋空字串與 `114-2` 的三來源片段。日期寫死是設定耦合；新斷言改從 `SEMESTER_RANGES` 讀。

| ID | 類型 | 案例 | 期望 |
|----|------|------|------|
| T4-P1 | 正向 | `''` | 已有。join、where 為空字串，replacements 為 `{}` |
| T4-P2 | 正向 | `'114-2'` 或 `'114-1'` | replacements 的起迄等於 `SEMESTER_RANGES` 該鍵。join 含 `semesters` 與 `et_semesters`。where 含 `:semesterId`、`:semesterStart`、`:semesterEnd`。不要比對整段 SQL |
| T4-P3 | 正向 | `isEventDateInSemester` 區間內、區間外、邊界日 | 已有內外各一筆。邊界日若補，用 config 的 start/end |
| T4-N1 | 負向 | 不在 `SEMESTER_RANGES` 的代碼，例如 `999-9` | join 仍含兩張學期表。replacements 有 `semesterId`。沒有 `semesterStart` / `semesterEnd` |
| T4-N2 | 負向 | `null`、空白字串 | 與空 filter 相同 |
| T4-F1 | 失敗 | where 字串多一個空白或換行 | 測試仍通過。只允許 `toContain` 資料表名與 placeholder |

需 runtime：跑既有檔案，確認目前就是綠的，再加 T4-N1。本輪沒有跑 Jest。

還原：revert 測試增補。保留原檔。

---

## T5 — Legacy learning-journey 掛載契約

保護對象只有活著的匯入流程，不是整個 `learningJourneyApi.js`。

已確認的 URL：

`/api/admin/learning-journey` + `/admin/academic-course-roster/dry-run`

`/api/admin/learning-journey` + `/admin/academic-course-roster/apply`

| ID | 類型 | 案例 | 期望 |
|----|------|------|------|
| T5-P1 | 正向 | `learningJourneyApi.js` 的 roster dry-run / apply | URL 等於上面兩條 |
| T5-P2 | 正向 | `learningJourneyRouter.js` | 有相同的 router-relative path |
| T5-P3 | 正向 | `server.js` | 有 `app.use('/api/admin/learning-journey', learningJourneyRouter)`。引號風格可以正規化後再比 |
| T5-P4 | 正向 | `LearningJourneyV3ImportSection.jsx` | 仍 import 這兩個函式 |
| T5-N1 | 負向 | 只留 `/api/v3/learning-journey` 掛載 | T5-P3 失敗 |
| T5-N2 | 負向 | router path 改名但 client 未改 | T5-P1 與 T5-P2 對不上 |
| T5-N3 | 負向 | import 還在，但函式裡的 URL 改了 | T5-P1 失敗 |
| T5-F1 | 失敗 | `server.js` 其他空白或註解變動 | 不得失敗。禁止比對整個檔案 |

明確不納入通過條件：

- `/api/v3/learning-journey` 必須繼續存在。
- `LearningJourneyHubPage`、`LearningJourneyStudentPage` 必須出現在 `App.js`。它們目前不在。
- `postLearningJourneyCourseImportDryRun` / `Apply`。目前沒有呼叫端。

還原：刪測試檔。

---

## 執行命令（實作該任務時）

```bash
cd reservation-backend && npx jest tests/semesterEventFilter.test.js --runInBand
cd reservation-backend && npx jest tests/<t1-or-t2-file>.test.js --runInBand
cd reservation-frontend && npx vitest run src/<t3-or-t5-file>
```

T1 與 T2 若用 supertest，沿用後端既有的 app 測試寫法。不要為了這五個任務去連生產資料庫。
