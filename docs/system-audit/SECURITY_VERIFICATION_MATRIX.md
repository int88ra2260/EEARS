# 安全驗證矩陣（SECURITY_VERIFICATION_MATRIX）

- 日期：2026-10-29
- 方法：讀路由、服務與模型。沒有對正式環境發請求，沒有讀取學生列。
- 「已核對」表示看過處理器回傳哪些欄位。「未核對」表示只知道有沒有 middleware，不知道 body。
- 這不是完整的 `/api` 清單。`server.js` 沒有全域 auth，其餘管理端點仍可能漏掛，見覆蓋缺口。

圖例：認證欄的「無」表示該處理器沒有 staff／student JWT。它仍可能有 rate limit、captcha 或另一種 token。

## 個人與問卷

| 端點 | 認證 | 權限／範圍 | 回應裡的敏感內容 | 判定 | 驗證 |
|------|------|------------|------------------|------|------|
| `POST /api/reservations` | 學生 JWT | `bindStudentIdentity` 覆寫學號；另有 Gate | 建立結果 | 與 INV-01 一致 | 已讀路由掛載 |
| `GET /api/reservations/public` | 學生 JWT | 綁定後的學號 | 自己的預約 | 已核對有 middleware | 未重讀每一個回傳欄 |
| `POST /api/reservations/:id/cancel-public` | 學生 JWT | 另有驗證碼、captcha、rate limit | 取消結果 | 與 INV-08 一致 | 已讀路由 |
| `DELETE /api/reservations/:id` | 無 | 不執行刪除 | 410 與替代路徑文字 | 已停用 | 已讀處理器，狀態碼 410 |
| `GET /api/student-progress` | 學生 JWT | 覆寫學號 | 個人進度 | 已核對有 middleware | 未重讀欄位 |
| `GET /api/class-credit-allocation` | 學生 JWT | 覆寫學號 | 加分配置 | 已核對有 middleware | 未重讀欄位 |
| `GET /api/surveys/my-status` | **無** | query 的 `surveyId`、`studentId` | **整筆模型，含 `answersJson`、姓名、email** | **XL-01 確認** | 已讀 `myStatus` 與模型。未打正式庫 |
| `GET /api/surveys/check/:surveyId/:studentId` | 無 | 僅兩個 legacy 問卷鍵；當學期 | 只有 `{ filled, semester }` | 可接受的布林。不要與 XL-01 混為一談 | 已讀到 `res.json` |
| `POST /api/surveys/submit/:surveyKey` | 無 | 公開填寫 | 提交結果 | 既有公開問卷。雙寫見資料邊界 | 未重讀全部 body 驗證 |
| `GET /api/student-learning-journey/dashboard` | 無 JWT | 學號＋姓名＋email 必須對上預約；rate limit | 推薦、未到次數、最近軌跡、遊戲化 | **XL-03 確認**。404 時不回預約列 | 已讀 `verifyStudentIdentity` 與回傳組裝 |
| `POST /api/student-learning-journey/feedback` | 無 JWT | 同樣要求三要素 middleware，但處理器把 `req.body.context` 傳進回饋生成 | 回饋文字 | **部分核對**。三要素沒有傳進 `generateRegulatoryFocusFeedback` 的第一個參數 | 已讀路由。未讀回饋函式是否另查個資 |
| `POST /api/learning-traces` | 無 | body 可帶學號 | 只回 id／是否建立。副作用是寫入並可能投影 | **XL-02 確認** | 已讀投影條件 |
| `GET /api/admin/learning-traces/*` | Staff JWT | `CAN_VIEW_LEARNING_ANALYTICS` | 聚合 | 管理端有守 | 已讀三條 GET |

## 帳號與班級

| 端點 | 認證 | 權限／範圍 | 回應 | 判定 |
|------|------|------------|------|------|
| `POST /api/login` | 公開 | 帳號密碼、冷卻 | staff JWT | 已存在，未重讀鎖定細節 |
| `POST /api/student-auth/login` | 公開 | 學生帳號 | `typ: student` | 與 staff 互斥，已讀 middleware |
| `GET /api/teachers/students/participation` | Staff JWT | **沒有** `requirePermission`。`teacherName === req.user.name` | 班級 id、名稱、系所、人數。**沒有學號** | XL-04。前端無呼叫 |
| `GET /api/students/:studentId/profile` | Staff JWT | `assertCanAccessStudent`（先前盤點） | 學生剖面 | 範圍守衛存在。本次未重讀守衛本體，標部分核對 |
| 護照學生端 | 無 staff／student JWT | email 驗證碼、captcha、rate limit | 護照資料在驗證之後 | 刻意分離。未逐條列每個 POST 的欄位 |
| 護照管理端 | `router.use(authMiddleware)` | 護照權限鍵 | 管理資料 | 已讀掛載方式 |

## 口說與檔案

| 端點 | 認證 | 回應／副作用 | 判定 |
|------|------|----------------|------|
| `POST /api/speaking-host/login` | 公開登入 | 主持 JWT，`typ: speaking-host`，12 小時 | 第三種 token。已讀 `signHostToken` |
| 主持題組的讀寫、評分、音檔路由 | `readHostToken` | 音檔經授權路由讀出 | 路由層有守 |
| `POST /api/speaking-check/join` 與場次 | 加入碼／參與者 id（本次未逐欄重讀） | 學生作答 | 未完整核對。不把「無 staff JWT」寫成漏洞 |
| `express.static('/uploads')` | 無 | 知道路徑就能讀 | 與音檔目錄重疊是 XL-09。未列出檔案，故不確認裡面有證件 |

## 公開但低敏感（已看過存在，不升成漏洞）

| 端點 | 內容 |
|------|------|
| `GET /api/health` | 依賴是否可用 |
| `GET /api/events` | 場次與剩餘名額 |
| `GET /api/stats/views` | 瀏覽計數 |
| 公告、週報、網站內容 GET | 公開文案 |

## 授權漂移

| 檢查 | 結果 |
|------|------|
| 學生 token 進 staff middleware | 拒絕，401。已讀 `auth.js` 的類型檢查 |
| 只有 `requirePermission`、沒有先驗證 | 沒有 `req.user` 時是 **403** `INSUFFICIENT_PERMISSIONS`，不是 401。已在先前盤點讀過 `auth.js` |
| 前端三份權限 | 鍵名在 `permissions.js` 與前端常數對齊（先前抽樣）。角色映射在 `accessControl.js` 另有一份。`access:check-consistency` **不**掃前端 |
| 側欄與路由抽樣 | operations、learning-analytics explore、speaking-diagnostic、teachers dashboard、account reset 三邊都有。不是全量證明 |

## 覆蓋缺口

未逐一打開的管理端寫入：培力報名 3624 行路由、活動路由、ET 分組、匯入刪除、ops scripts。這些檔案裡已有權限呼叫的事實，不等於每一個方法都有範圍檢查。

未執行的驗證（下一輪才做，且要用測試替身）：

1. `my-status` 的 JSON 鍵集合。
2. 軌跡投影在未驗證學號時不寫 `lj_student_events`。
3. dashboard 三要素不符時 body 沒有 `feedback`。
4. 參與端點的 JSON 沒有 `studentId`。

## 不在此矩陣宣告的事

- 不宣告正式環境已經有人讀到問卷答案。程式允許這件事，是否發生過沒有日誌比對。
- 不宣告 `/uploads` 含有身分證件。
- 不宣告教師參與端點是名冊外洩。
