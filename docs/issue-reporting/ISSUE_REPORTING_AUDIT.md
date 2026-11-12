# 學生回報／問題回報現況盤點

- 日期：2026-11-12
- 範圍：Phase 0。只盤點，不代表 Phase 1–3 已實作。
- 基準：Git `main`，HEAD `e066a07373228aeb3151077f58cf62cf44fbf017`。
- 工作區另有未提交變更，見文末。盤點以 HEAD 的已提交程式為準，並單獨註記工作區差異。
- 正式資料庫是否已套用相關 migration：**Unknown**。本次沒有連線正式資料庫，也沒有讀 `SequelizeMeta`。

搜尋 `Issue`、`BugReport`、`ProblemReport`、`SupportTicket`、`ReportIssue`、`問題回報`、`意見回饋` 後，唯一對應的產品功能是「學生回報」（student feedback）。沒有第二套工單模型。

## 1. 現有架構

學生登入後從「我的帳號」送出問題或建議。後端把學號、姓名、信箱綁在 session，寫入 `student_feedback`，並寄信通知中心。中心人員在 `/admin/student-feedback` 查看、指派、公開回覆、寫內部備註、結案。學生在同一頁查看自己的案件與公開回覆，並可補充說明。

| 層 | 路徑 | 角色 |
|----|------|------|
| 掛載 | `reservation-backend/server.js` | `POST/GET /api/student/feedback`、`/api/admin/student-feedback` |
| 學生路由 | `reservation-backend/routes/studentFeedbackRouter.js` | 學生 JWT + 已驗證信箱 |
| 後台路由 | `reservation-backend/routes/adminStudentFeedbackRouter.js` | `authMiddleware` + `requirePermission` |
| 業務 | `reservation-backend/services/studentFeedbackService.js` | 驗證、列表、回覆、結案、指派 |
| 資料表 | `student_feedback`、`student_feedback_messages` | Sequelize model，不是 `sequelize.sync()` |
| 學生 UI | `StudentFeedbackPanel`、`StudentFeedbackHistory`、`StudentAccountPage` | 帳號頁內嵌，沒有獨立公開路由 |
| 後台 UI | `AdminStudentFeedbackPage` | 單頁列表 + 點列展開詳情 |
| 權限 | `can_view_student_feedback`、`can_manage_student_feedback` | 前後端常數同名 |

沒有 controller 層。路由直接呼叫 service。沒有附件上傳路由，也沒有呼叫 `auditLogService`。

## 2. 前端盤點

| 項目 | 狀態 | 證據 |
|------|------|------|
| 學生入口 | 已有，在帳號頁，不是獨立公開表單 | HEAD：`StudentAccountPage` 直接渲染 `StudentFeedbackPanel`。路由只有 `/student/account`（`App.js`），沒有 `/student/feedback` |
| 回報表單 | 已有 | `StudentFeedbackPanel.jsx`：類型 `problem`／`wish`、項目五選一、內容、是否希望回覆 |
| 學生自己的列表與補充 | 已有 | `StudentFeedbackHistory.jsx` 呼叫 `fetchMyStudentFeedback`、詳情與 `postMyStudentFeedbackMessage` |
| 後台列表 | 已有 | `AdminStudentFeedbackPage.jsx`，路由 `/admin/student-feedback` |
| 後台詳情 | 部分 | 同一頁點列載入 `GET /:id`，不是獨立詳情路由 |
| 狀態更新 | 部分 | 僅「結案」與「改回處理中」 |
| 優先級 | 無 | 前後端都沒有 priority 欄位或控制項 |
| 管理員公開回覆 | 已有 | 詳情區「回覆學生」→ `POST /:id/replies` |
| 內部備註 | 已有 | 「內部備註」→ `POST /:id/notes` |
| 附件 | 無 | 表單與 API 都沒有檔案欄位。migration 註解寫「附件待防毒掃描後再加」 |
| 處理歷程 | 部分 | 畫面上是留言串，不是狀態／指派／優先級的事件時間軸 |
| 搜尋與篩選 | 部分 | 類型、狀態、項目、承辦、關鍵字、日期。沒有優先級、模組、排序控制、清除全部 |
| 統計 Dashboard | 無 | 頁面沒有 KPI。列表的 `total` 是目前篩選的筆數，不是各狀態總數 |
| 匯出 | 無 | `studentFeedbackApi.js` 沒有匯出函式 |

後台列表欄位（`AdminStudentFeedbackPage` 表格）：時間、狀態、類型、項目、學生（姓名、學號、信箱）、內容、承辦、信件狀態。沒有問題編號欄、標題欄、優先級、最後更新時間、發生模組。

學生端在未驗證信箱時，`StudentFeedbackPanel` 不顯示表單，只提示先完成驗證。路由層 `requireStudentEmailVerified` 仍會擋 API。

### 工作區未提交的 UI 差異

`reservation-frontend/src/pages/student/StudentAccountPage.jsx` 相對 HEAD 有未提交修改：把「遇到問題」收成與「通知信箱」相同的圓形入口，預設不展開。HEAD 仍是進入帳號頁就展開表單。這份差異還沒進 `main`，正式站是否已有這個入口：**Unknown**。

## 3. 後端盤點

### API

學生（都要學生 session，且信箱已驗證）：

| 方法 | 路徑 | service |
|------|------|---------|
| GET | `/api/student/feedback` | `listMyStudentFeedback` |
| POST | `/api/student/feedback` | `submitStudentFeedback` |
| GET | `/api/student/feedback/:id` | `getMyStudentFeedback` |
| POST | `/api/student/feedback/:id/messages` | `addStudentFollowUp` |

後台：

| 方法 | 路徑 | 權限 |
|------|------|------|
| GET | `/api/admin/student-feedback/assignees` | `can_view_student_feedback` |
| GET | `/api/admin/student-feedback` | 同上 |
| GET | `/api/admin/student-feedback/:id` | 同上 |
| POST | `/:id/replies` | 另加 `can_manage_student_feedback` |
| POST | `/:id/notes` | 同上 |
| PATCH | `/:id` | 同上。body 只接受 `status`、`assignedTeacherId` |

沒有 summary、export、attachment、priority、severity、duplicate、timeline 端點。

### 驗證

`studentFeedbackService.js`：

- `kind`：`problem`、`wish`
- `category`：`reservation`、`survey`、`account`、`english_test`、`other`
- 內容 8–2000 字；回覆與備註 1–2000 字
- `status`：`open`、`in_progress`、`closed`。PATCH 不接受把狀態設回 `open`
- 分頁：`page` 1–10000，`pageSize` 1–50，預設 20
- 日期：`YYYY-MM-DD`，時區寫死 `+08:00`
- 關鍵字最長 80 字，去掉 `%` 與 `_` 後做 `LIKE`
- 排序寫死 `createdAt DESC, id DESC`，沒有客戶端排序參數
- 同一學號一小時內新案加學生補充合計最多 5 次

### 狀態語意（已存在，不可直接改名）

| 值 | 畫面 | 怎麼進入 |
|----|------|----------|
| `open` | 待處理 | 建立時。沒有 API 把案件改回 `open` |
| `in_progress` | 處理中 | 指派且原為待處理、公開回覆、待處理時寫備註、結案後學生補充、或 PATCH `in_progress` |
| `closed` | 已結案 | PATCH `closed`。若 `replyRequested !== false`，必須已有一則 `authorType=staff` 且 `visibility=public` 的留言，否則 409 `STUDENT_FEEDBACK_REPLY_REQUIRED` |

沒有 Waiting for User、Pending Verification、Resolved、Reopened 狀態。重新開啟是把 `closed` 改成 `in_progress`，不是獨立狀態。沒有「變更原因」欄位。

### 授權

- 學生讀寫都先 `loadOwnCase`：`studentId` 必須等於 session。請求 body 的學號不會被採用（`studentFeedbackAuth.test.js`）。
- 後台讀取用 view，寫入用 manage。前端 `hasPermission` 只決定按鈕；後端 `requirePermission` 仍會擋。
- 詳情 `getStudentFeedback` 會把 `internal` 與 `public` 留言一起回給任何具 view 的人。manage 不是讀取內部備註的門檻。
- 學生的 `presentStudent` 只留 `visibility === 'public'`。

### 錯誤處理

已知業務錯誤走 `StudentFeedbackError`（status、code、message）。其餘 Sequelize 錯誤進 `errorHandler`，對外是通用「資料庫查詢失敗」，不回 SQL。

### 郵件

`config/email.js` 的 `studentFeedbackNotice`、`studentFeedbackReply`。

- 新案寄到 `EMI_CENTER_EMAIL` 或預設 `emicenter@mail.nsysu.edu.tw`。寄信失敗仍保留案件，`emailStatus` 記 `failed`（service 測試有覆蓋）。
- 公開回覆另寄學生通知，本文不含回覆內文，只給帳號頁網址。
- 內部備註不寄信。
- `sendEmailWithLog` 的 `relatedEntityType` 是 `student_feedback`。這是郵件日誌，不是工單審計表。

### 上傳與稽核

無 multer、無附件欄、無 `auditLogService` 呼叫。狀態與指派只更新案件列，不另寫歷程列。

## 4. 資料庫盤點

Migration：

| 檔案 | 作用 |
|------|------|
| `20261108150000-create-student-feedback.js` | 建立 `student_feedback` |
| `20261108150100-grant-student-feedback-permission.js` | 對已有角色列補 `can_view_student_feedback` |
| `20261110160000-student-feedback-cases.js` | 加狀態、回覆意願、承辦、結案時間，並建立 `student_feedback_messages` |
| `20261110160100-grant-student-feedback-manage-permission.js` | 補 `can_manage_student_feedback` |

`student_feedback` 欄位（model）：`id`、`studentId`、`studentName`、`email`、`emailVerified`、`kind`、`category`、`message`、`emailStatus`、`status`、`replyRequested`、`assignedTeacherId`、`closedAt`、`createdAt`、`updatedAt`。

`student_feedback_messages`：`id`、`feedbackId`、`authorType`、`visibility`、`body`、`teacherId`、`studentId`、`emailStatus`、時間戳。`visibility` 為 `public` 或 `internal`。

外鍵：承辦與留言作者指向 `teachers.id`，刪除老師時 SET NULL；留言隨案件 CASCADE。

| 工單概念 | 現況 |
|----------|------|
| 工單編號 | 只有自動增量 `id`，畫面上未當編號顯示 |
| 標題 | 無。內容就是 `message` |
| 描述 | `message` |
| 類別 | `kind` + `category` 字串，不是 ET／EC／JT／IF 模組 |
| 狀態 | 三態，見上表 |
| 優先級、嚴重程度 | 無 |
| 回報者 | session 寫入的學號、姓名、信箱；`emailVerified` 建立時為 true |
| 負責人 | `assignedTeacherId`，可空 |
| 附件 | 無 |
| 留言 | `student_feedback_messages` |
| 狀態變更歷程 | 無獨立表。只看得到目前 `status` 與 `closedAt` |
| 建立／更新時間 | 有 |
| 解決時間 | 無。結案只用 `closedAt` |
| 發生頁面、發生時間、瀏覽器、OS、裝置、版本、request id、error code | 無 |

正式環境若只跑了建立表、還沒跑 `20261110160000`，後台列表會選到 `status` 等欄位而失敗。本機用缺這些欄位的表重現過 MySQL `Unknown column 'StudentFeedback.status'`，畫面文案會是「資料庫查詢失敗」。這不能證明正式庫的 `SequelizeMeta`。正式庫狀態仍是 **Unknown**。

部署腳本 `scripts/ops/deploy.ps1` 不會自動 `db:migrate`（`reservation-backend/docs/DEPLOYMENT_CHECKLIST.md`）。

## 5. 權限盤點

常數：`reservation-backend/auth/permissions.js` 與 `reservation-frontend/src/constants/permissions.js`。

預設角色（`accessProfile.js` 的 `buildBasePermissionSet`）：

| 角色 | view | manage |
|------|------|--------|
| `admin` | 有（全部 `P.*`） | 有 |
| `teacher` + `executive` | 有 | 有 |
| `teacher` + `regular` | 無。`teacherRoleAccess.test.js` 斷言 | 無 |
| `teacher` 的 et／if／jt manager | 程式未把這兩鍵放進那些 level | 無 |
| `office_staff` 的 event／curriculum／bestep／deputy，以及未知 staffLevel | 有 | 有 |
| `worker`（含 content_editor） | 無 | 無 |
| `leader` | 無 | 無 |

資料庫 `role_permissions` 可覆寫程式預設。兩支 grant migration 只對已有該角色列的 admin、executive、四種 office staff 插入權限；角色完全沒有列時不插入。

對照這次計畫要的能力：

| 能力 | 現況 |
|------|------|
| 學生提交、查自己的 | 學生 session，不是 staff 權限鍵 |
| 查看所有問題 | `can_view_student_feedback` |
| 更新狀態、指派、公開回覆、內部備註 | 同一鍵 `can_manage_student_feedback`，沒有再拆 |
| 查看內部備註 | 實際上 view 就看得到，沒有單獨的「只給 manage」讀取 |
| 匯出、統計 | 沒有對應權限鍵，也沒有 API |

指派名單 `listFeedbackAssignees`／`isAssignable`：啟用中、非 demo，且是 admin、office_staff，或 `teacher` + `executive`。一般老師與工讀生不能當承辦。

## 6. 已具備、部分完成、缺少

### 已具備

- 登入學生才能送；未驗證信箱 403，`redirectUrl` 為 `/student/account`
- 身分來自 session
- 中心信失敗仍留資料
- 小時頻率限制
- 後台篩選、關鍵字、日期、後端分頁
- 指派、取消指派、依承辦篩選、未指派篩選
- 公開回覆與內部備註的資料欄位分離
- 學生看不到內部備註
- 要求回覆的案件，沒有公開回覆不能結案
- 結案後學生補充會回到處理中

### 部分完成

- 列表與詳情在同一頁，詳情不是獨立路由
- 狀態只有三態，變更不寫原因、不寫操作者歷程
- 承辦只保存目前的人，沒有指派歷史
- 留言串可當部分歷程，不含狀態與優先級事件
- 篩選在後端，排序不能選
- 權限只有查看／處理兩鍵

### 缺少（相對這次計畫）

- Dashboard 與全庫狀態計數
- 標題、優先級、嚴重程度、發生模組、技術資訊
- 附件
- 狀態機（含待使用者、待確認、已解決、重開事件與原因）
- 審計時間軸
- 重複工單關聯
- SLA、統計、匯出、逾期通知
- 指派通知、解決通知（新案與公開回覆通知已有）

## 7. 安全注意

- 內部備註對所有 view 權限可見。若政策是「只有處理權限能看內部備註」，目前 API 不符合。學生端有過濾。
- 具 view 的人看得到全部學生的學號、姓名、信箱與內文，不限承辦人。
- 新案郵件本文含學號、姓名、信箱與完整內容。公開回覆通知不含回覆正文。
- 沒有附件，因此還沒有「知道 URL 就能下載」的問題。之後若加檔案，不能把私人檔放進未授權的靜態目錄。
- 案件更新沒有版本欄。兩人同時 PATCH 時後寫入者覆蓋先寫入者。
- 公開回覆先插留言再改狀態再寄信，沒有包在同一個 transaction。寄信失敗不會把留言回滾，這點與「通知失敗仍要留下回覆」一致。狀態更新若在留言之後失敗，會留下沒有對應狀態變更的留言。此失敗路徑沒有測試。
- 學生補充與新案共用每小時 5 次。這是查資料庫計數，在 PM2 單進程下可工作（`ARCHITECTURAL_INVARIANTS.md` INV-14）。

## 8. UI／UX

後台用 Bootstrap 5 的 `Alert`、`Button`、`Form`、`Table`、`Spinner`，主色沿用既有 `#2a5d9f`（`design-system.css` 與 `frontend.mdc`）。沒有另一套主題。

問題：

- 沒有各狀態總數，無法當工單總覽。
- 表格欄多，`Table responsive` 只讓表格自己捲動；手機是否整頁不溢出要在實機再量，本次未對正式站做版面驗收。
- 沒有 Empty 以外的 Forbidden 專頁；無權限時 API 回 403，頁面若仍被路由放行會顯示錯誤訊息。路由註冊在 `adminRouteAccess.js`，visibility 是 `perm:can_view_student_feedback`。
- 結案沒有確認對話框。
- 狀態只用文字標籤，沒有只靠顏色。
- 前後台用詞是「學生回報／遇到問題／待處理／處理中／已結案」，不是 Open／P0。之後若加優先級，畫面用語要另定，不能直接把英文字當唯一標籤。

## 9. 建議開發順序

1. 先確認正式庫 migration 已套用，否則後台列表無法作為後續功能的驗收起點。
2. Phase 1 只擴充現有表與 `AdminStudentFeedbackPage`：全庫計數 API、列表補編號與更新時間、維持現有三態。優先級與新狀態若要做，用新增可空欄位，不改既有 `open`／`in_progress`／`closed` 的意義。
3. 附件、時間軸、重複工單放 Phase 2，且內部備註的讀取權限要先決定是否從 view 拆開。
4. 統計、SLA、匯出、逾期通知放 Phase 3。SLA 時數不要寫死，設定值要等業務確認。統計不要接進 Learning Analytics 的 CEFR／GSE 契約。

## 10. 測試現況（檔案存在，本次未重跑）

| 檔案 | 覆蓋到的行為 |
|------|----------------|
| `reservation-backend/tests/studentFeedbackService.test.js` | 建立、寄信失敗仍保存、過短內容、錯誤項目、頻率、依類型列表、未驗證信箱、不要求回覆、結案前必須有公開回覆、公開回覆信不含正文、學生看不到內部備註且結案後補充會重開、不可指派非中心人員 |
| `reservation-backend/tests/security/studentFeedbackAuth.test.js` | 未登入 401、未驗證 403、body 學號被忽略、匿名與一般老師不能讀列表、行政可讀、一般老師不能回覆、行政可回覆 |
| `reservation-backend/tests/teacherRoleAccess.test.js` | regular 無此二鍵；executive 有 |

沒有：真實 MySQL 的篩選／分頁整合測試、狀態轉換矩陣、並發更新、附件、匯出、Dashboard 計數、前端元件測試。

## 11. 閱讀過的規範

存在並已對過：`AGENTS.md`、`docs/system-audit/ARCHITECTURAL_INVARIANTS.md`、`docs/system-audit/REFACTORING_DEPENDENCY_GRAPH.md`、`docs/system-audit/CONSOLIDATION_MASTER_PLAN.md`、`docs/design-system/phase-4a-architecture-and-adoption-plan.md`、`reservation-frontend/src/styles/design-system.css`、`.cursor/rules` 的後端 API、權限、migration、前端與部署說明。

這些規範沒有定義問題回報的狀態機或 SLA。不變量 INV-09（學生 token 與教師 token 分開）與這次有關：學生 API 與後台 API 必須維持兩套 middleware。

## 12. Phase 1 工作區增量（2026-11-12）

盤點當時「缺少 Dashboard」與「排序不能選」指的是 commit `e066a07`。工作區現在另有未提交的 Phase 1：全庫 summary、KPI、列表 `#id` 與 `updatedAt`、`sortBy`／`sortOrder` 白名單。沒有新資料表或新狀態。Phase 2、Phase 3 仍缺。正式庫是否已套用 `20261110160000` 仍是 Unknown。安全待辦見 `ISSUE_REPORTING_SECURITY_BACKLOG.md`。
