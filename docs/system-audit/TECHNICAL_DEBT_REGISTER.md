# EEARS 技術債登錄（TECHNICAL_DEBT_REGISTER）

- 稽核日期：2026-10-29
- 優先序：P0 安全或資料破壞且已證實；P1 跨模組正確性或授權；P2 可維護性與契約漂移；P3 清理。本次**沒有** P0。未看回應內容的項目保持 SUSPECTED，不升 P0。
- 2026-10-29 跨層校正（見 `CROSS_LAYER_FINDINGS.md`）：`AUD-SEC-03` 改為 **CONFIRMED**。`myStatus` 回傳整筆 `SurveyModuleResponse`，含 `answersJson`、`studentName`、`studentEmail`，且無認證。學生頁實際呼叫的是 `/api/surveys/check/:surveyId/:studentId`，該路徑只回 `{ filled, semester }`。`AUD-SEC-02` 降為 **P2**：`getStudentParticipation` 只回班級名稱、系所與人數，學號有查詢但沒有放進 JSON。
- 工作量：S 數日內可局部改、M 需補測試與一個模組、L 跨模組遷移。

## 索引

| ID | 優先 | 信心 | 標題 |
|----|------|------|------|
| AUD-DA-01 | P1 | CONFIRMED | 學生主檔分裂 |
| AUD-DA-02 | P1 | CONFIRMED | 學號欄位長度不一致 |
| AUD-DA-04 | P1 | CONFIRMED | 成績三線並存 |
| AUD-SEC-02 | P1 | CONFIRMED | 教師參與名單缺權限鍵 |
| AUD-SEC-03 | P1 | SUSPECTED | 問卷 my-status 只收學號 |
| AUD-SEC-04 | P1 | CONFIRMED | 個人資料三種認證 |
| AUD-FE-01 | P1 | CONFIRMED | 管理端路由三清單 |
| AUD-FE-02 | P1 | CONFIRMED | 護照不用學生 session |
| AUD-BE-01 | P1 | CONFIRMED | HTTP 錯誤形狀分裂 |
| AUD-BE-02 | P1 | CONFIRMED | 核心業務在巨型 route |
| AUD-BE-03 | P1 | CONFIRMED | 預約整合測試為占位 |
| AUD-DA-03 | P2 | CONFIRMED | 學期三種鍵 |
| AUD-DA-05 | P2 | CONFIRMED | 問卷雙寫 |
| AUD-DA-06 | P2 | CONFIRMED | 黑名單與預約身分鍵不同 |
| AUD-DA-07 | P2 | CONFIRMED | 多處無 FK 的字串參照 |
| AUD-DA-12 | P2 | CONFIRMED | 權限 JSON 與資料表雙寫 |
| AUD-BE-04 | P2 | CONFIRMED | 未掛載路由與相鄰註解 |
| AUD-BE-05 | P2 | CONFIRMED | 排程綁 API 進程 |
| AUD-BE-07 | P2 | SUSPECTED | errorHandler 可能吃掉 err.code |
| AUD-BE-09 | P2 | CONFIRMED | 取消預約無 transaction |
| AUD-FE-03 | P2 | CONFIRMED | 三種呼叫 HTTP 的方式 |
| AUD-FE-04 | P2 | CONFIRMED | 兩套分析產品並存 |
| AUD-FE-07 | P2 | CONFIRMED | 權限鏡像不在一致性腳本 |
| AUD-SEC-01 | P2 | CONFIRMED | admin 前綴沒有統一認證 |
| AUD-SEC-05 | P2 | CONFIRMED | 401 與 403 混用 |
| AUD-SEC-06 | P2 | CONFIRMED | 權限文件過期 |
| AUD-SEC-07 | P2 | SUSPECTED | `/uploads` 靜態可直連 |
| AUD-SEC-08 | P2 | SUSPECTED | 口說與 learning-traces 無 JWT |
| AUD-DA-08 | P3 | CONFIRMED | 多套匯入歷史表 |
| AUD-DA-09 | P2 | CONFIRMED | 多套稽核表 |
| AUD-DA-10 | P3 | CONFIRMED | 問卷答案 FK 關閉 |
| AUD-DA-11 | P3 | CONFIRMED | migration 命名混雜 |
| AUD-DA-13 | P3 | SUSPECTED | SystemSettings 缺建表 migration |
| AUD-BE-06 | P3 | CONFIRMED | zod 未使用 |
| AUD-BE-08 | P3 | CONFIRMED | 分頁參數名不一致 |
| AUD-BE-10 | P3 | CONFIRMED | bcrypt 套件未使用 |
| AUD-FE-05 | P3 | CONFIRMED | 空狀態與 downloadBlob 分叉 |
| AUD-FE-06 | P3 | CONFIRMED | 培力／英檢用詞並存 |
| AUD-FE-08 | P3 | CONFIRMED | axios 客戶端無引用 |
| AUD-FE-09 | P3 | CONFIRMED | 未被路由掛載的頁面檔 |

---

### AUD-DA-01 學生主檔分裂

- 類別：資料架構
- 模組：預約、黑名單、學生登入、LJS、legacy ET、培力報名、班級
- 符號：`User`、`Student`、`StudentAccount`、`EtStudentMaster`、`EnglishTestRegistration`、`ClassMembership`
- 觀察：同一學號可在多張表各有一列，彼此沒有外鍵。LJS 的 `ExamAttempt` 同時有 `studentId` 與 `studentPk`。
- 應維持：業務關聯以學號為準，且各模組看到的是同一個學生。
- 證據：`models/User.js`、`models/Student.js`、`models/EtStudentMaster.js`、`models/index.js`（ET 與 `students` 無互聯）
- 信心：CONFIRMED
- 嚴重度：P1
- 使用者影響：改名、轉系、休學若只更新其中一表，名單與歷程會分歧
- 維護影響：每個新功能都要再決定「這次讀哪張表」
- 安全／完整性：高。沒有資料庫層級的單一身份
- 工作量：L
- 相依：AUD-DA-02、AUD-DA-04、AUD-DA-06
- 回歸：合併表會打斷預約、黑名單、匯入去重
- 建議：先做讀取用的解析層與對帳報告，不合併表

### AUD-DA-02 學號欄位長度不一致

- 類別：資料架構
- 模組：同上
- 觀察：`students`／`student_accounts`／canonical attempt 為 STRING(20)；`Users`、ET、報名、班級、護照為 STRING(50)；問卷模組回應為 STRING(80)；`Reservation.studentId` 未限制長度
- 應維持：同一學號在所有表可存放且可比較
- 證據：各模型 `studentId` 定義（見領域矩陣）
- 信心：CONFIRMED
- 嚴重度：P1
- 使用者影響：超長學號在同步進 canonical 時會失敗或被截斷（截斷行為 **UNVERIFIED**，需看寫入服務）
- 維護影響：匯入驗證規則必須每表各寫
- 安全／完整性：高
- 工作量：M（先加對帳與寫入前驗證；改欄位寬度是 L，且要 migration）
- 相依：AUD-DA-01
- 回歸：加寬 `students.student_id` 可能碰到既有唯一索引與匯入假設
- 建議：先統計實際最大長度（需連 DB，本次未做），再決定是否加寬 canonical 欄位

### AUD-DA-04 成績三線並存

- 類別：領域／資料
- 模組：BESTEP、LJ v3、legacy ET、成效分析
- 符號：`syncBestepScoresToExamAttempts`、`learningJourneyFeatureFlags.isLearningJourneyV3ReadModelEnabled`、`canonicalSemesterPolicyService`、`learningJourneyFallbackLogger`
- 觀察：BESTEP 原表同步到 `exam_attempts`；`et_exam_attempts` 仍可被讀取與歷史寫入；分析投影是衍生表
- 應維持：同一場考試在報表只出現一次，且學期政策之後不再寫 legacy
- 證據：`services/learningJourney/` 上述檔案；`eventProjectorService.js` 有避免 BESTEP 雙寫的註解
- 信心：CONFIRMED（雙寫路徑存在）。是否已在正式資料造成重複列：**UNVERIFIED**（未查 DB）
- 嚴重度：P1
- 使用者影響：達標人數或成長曲線可能重複計算
- 維護影響：讀模型 fallback 讓「修一個查詢」不足以改結果
- 安全／完整性：高（分析正確性）
- 工作量：L
- 相依：AUD-DA-01、AUD-DA-03、既有 `lj:reconcile-semester` 腳本
- 回歸：關掉 fallback 或停寫 `et_*` 會讓歷史學期空白
- 建議：先做學期別的列數對帳，再收緊寫入；讀取 fallback 保留到對帳通過

### AUD-SEC-02 教師參與名單缺權限鍵

- 類別：授權
- 模組：教師、班級
- 符號：`teacherRoutes.js` `GET /teachers/students/participation`；`teacherController.getStudentParticipation`
- 觀察：有 `authMiddleware`，沒有 `requirePermission`。範圍靠 `req.user.name` 對班級，不是 scope 表
- 應維持：學生名單要有權限鍵與 scope，不能只靠顯示名稱
- 證據：安全盤點所引路由。本次未重讀 controller 回傳欄位，**回傳是否含 email／成績標 SUSPECTED**
- 信心：CONFIRMED 缺權限鍵；資料範圍 SUSPECTED
- 嚴重度：P1
- 使用者影響：任何有效 staff token 都可呼叫；姓名碰巧相同時可能看到別班
- 維護影響：此路由與其他班級 API 的授權風格不同
- 安全／完整性：中高（學生名單）
- 工作量：S
- 相依：`CAN_VIEW_CLASSES` 或既有教師 scope
- 回歸：現在靠此端點的教師畫面若權限鍵未發給該角色，會變 403
- 建議：補權限與「教師 id」範圍，並加 401／403 測試。上線前核對現有角色是否已有該鍵

### AUD-SEC-03 問卷 my-status 只收學號

- 類別：授權
- 模組：問卷
- 符號：`surveyGatewayRouter`、`surveyCenterService.myStatus`
- 觀察：無 JWT。查詢識別是 `studentId`
- 應維持：個人填答狀態應綁 session，或回應不含他人可濫用的內容
- 證據：路由無 `studentAuthMiddleware`（安全盤點）。回應 JSON 欄位本次**未讀**
- 信心：SUSPECTED
- 嚴重度：P1（若 `latest` 含答案或 email）；若只回「已填／未填」則可降為 P2
- 使用者影響：知道學號或可枚舉學號時，可能讀到他人狀態
- 維護影響：與預約已改 session 的方向相反
- 安全／完整性：視回應內容
- 工作量：S 到 M
- 相依：學生登入是否已涵蓋填問卷的人
- 回歸：未登入填答流程、Gate 導向後的狀態查詢
- 建議：先讀 `myStatus` 回傳形狀再決定。不要在未確認前改成強制 JWT

### AUD-SEC-04 個人資料三種認證

- 類別：授權／領域
- 模組：預約、護照、問卷、學生學習歷程、學習有伴
- 觀察：student JWT；護照 email OTP；部分查詢用學號或學號＋姓名＋email 對預約紀錄
- 應維持：護欄要求個人功能綁 session。護照與組隊目前是另一套
- 證據：`App.js`、`englishLearningPassportRouter.js`、`reservationRouter.js`、`learningPartnerRouter.js`
- 信心：CONFIRMED 三套並存。學習歷程 dashboard 的比對函式本體標 SUSPECTED（見領域矩陣）
- 嚴重度：P1
- 使用者影響：學生以為登入後才看得到的資料，有的頁不用登入
- 維護影響：新功能無從判斷該抄哪一套
- 安全／完整性：中。OTP 與三要素不是「沒有控管」，但是與護欄文字不同
- 工作量：L（若全部改 session）
- 相依：學生帳號覆蓋率（未登入學生仍要填護照時不能先拆 OTP）
- 回歸：護照驗證信、學習有伴同意連結、公開問卷
- 建議：寫成決策表：哪些端點必須 JWT、哪些維持 OTP。未決策前不改護照

### AUD-FE-01 管理端路由三清單

- 類別：前端架構
- 模組：全部後台
- 符號：`App.js`、`adminNavigation.js`、`adminRouteAccess.js`、`getAdminRouteDeniedReason`
- 觀察：缺 access 規則時 UI 會 `missing_rule`。三邊沒有產生式對照
- 應維持：看得到的選單、進得去的路由、後端權限一致
- 證據：三個檔案的職責與 `AdminLayout` 用法
- 信心：CONFIRMED（漂移風險）。目前是否已有具體路徑三邊不一致：**UNVERIFIED**（未跑完整 diff）
- 嚴重度：P1（流程風險；尚未點名一條已壞的路徑）
- 使用者影響：有權限卻被擋，或選單沒有但網址進得去（後端仍可能 403）
- 維護影響：每個新頁面三處修改
- 安全／完整性：前端漏擋不是授權漏洞；後端漏鍵才是
- 工作量：M
- 相依：AUD-FE-07、AUD-SEC-01
- 回歸：過嚴的自動檢查會擋住合法的 legacy redirect
- 建議：加測試，枚舉 `App.js` 的 `/admin` 路由都必須在 access 矩陣有規則。先不要改生成器

### AUD-FE-02 護照不用學生 session

- 類別：UX／授權
- 模組：英語學習護照
- 符號：`App.js` 護照路由、`EnglishLearningPassportPage.jsx` 的 `emailVerificationToken`、`englishLearningPassportRouter.js`
- 觀察：頁面不包 `RequireStudentAuth`。後端寄送驗證碼前有 rate limit 與 captcha
- 應維持：見 AUD-SEC-04
- 信心：CONFIRMED
- 嚴重度：P1
- 其餘欄位與 AUD-SEC-04 相同。單獨列出是因為前端守衛與後端 OTP 要一起看，不能只補一個 `RequireStudentAuth` 而讓未建學生帳號的人無法送件

### AUD-BE-01 HTTP 錯誤形狀分裂

- 類別：API 契約
- 模組：全域、預約、問卷 Gate、權限
- 符號：`errorHandler`、`createAPIError`、`requirePermission`、`checkSurvey`、`reservationRouter` 建立失敗
- 觀察：`error`／`message`／`code`／`errorCode`／`success`／`redirectUrl` 組合不固定
- 應維持：失敗能讓前端分辨 Gate、權限、驗證、伺服器錯誤
- 證據：`middlewares/errorHandler.js`、`middlewares/auth.js`、`middlewares/checkSurvey.js`
- 信心：CONFIRMED
- 嚴重度：P1
- 使用者影響：某些畫面只讀 `message`，Gate 的 `redirectUrl` 若被包進另一種形狀就不會導向
- 維護影響：每個新端點複製一種局部風格
- 安全／完整性：中。`errorHandler` 在開發環境可能附 `stack`（檔案內有 dev 分支）
- 工作量：L
- 相依：前端所有錯誤解析
- 回歸：改 409 形狀會壞問卷導向；改 401 形狀會壞 `ACCESS_PROFILE_STALE`
- 建議：寫一份「現況契約」測試快照，新端點遵守 `{ success, code, message, requestId }`，舊端點只加欄位不刪舊欄位

### AUD-BE-02 核心業務在巨型 route

- 類別：後端架構
- 模組：培力報名、活動、預約、學習有伴、ET 分組
- 行數（總行）：`englishTestRegistrationRouter.js` 3624、`eventRouter.js` 1728、`learningPartnerRouter.js` 1215、`reservationRouter.js` 1034、`etGroupingRouter.js` 906
- 觀察：建立預約的 transaction 與大量規則在 route。`reservationService` 主要是取消
- 應維持：規則可單測，route 只做 HTTP
- 信心：CONFIRMED
- 嚴重度：P1（可維護性已影響正確性風險，但不是已證實的功能故障）
- 使用者影響：改一處容易碰到無關分支
- 維護影響：極高
- 安全／完整性：中。邏輯分散時容易漏檢查
- 工作量：L
- 相依：AUD-BE-03 必須先有測試
- 回歸：搬移時改變狀態碼或交易範圍
- 建議：一次只抽一個用況（先「建立預約」），行為以特徵測試鎖住

### AUD-BE-03 預約整合測試為占位

- 類別：測試
- 符號：`tests/integration/reservationFlow.test.js`
- 觀察：斷言手寫的 `expectedResponse.status === 409`，沒有呼叫 app。註解寫明需要資料庫
- 應維持：Gate、黑名單、截止至少有一條會失敗的自動化測試
- 證據：該檔前 40 行
- 信心：CONFIRMED
- 嚴重度：P1
- 使用者影響：無直接影響；回歸要等人工
- 維護影響：重構 AUD-BE-02 沒有安全網
- 安全／完整性：間接高
- 工作量：M
- 相依：現有 `surveyFailClose.test.js` 的 middleware 測法可沿用
- 回歸：低（只加測試）
- 建議：用輕量 Express 掛 `checkSurvey` 與黑名單服務，mock DB，不要先接真 MySQL

### AUD-DA-03 學期三種鍵

- 類別：資料
- 符號：`Semester`、`EtSemester`、`EnglishTestRegistration.semester`、`Event.semesterId`
- 觀察：INT id、字串主鍵、純字串並存
- 應維持：跨頁篩選指到同一學期
- 信心：CONFIRMED
- 嚴重度：P2
- 使用者影響：匯出或分析少一個學期或混學期
- 維護影響：高
- 安全／完整性：中
- 工作量：L
- 相依：`scripts/sync-semester-config.js`、canonical 政策
- 回歸：改鍵型別會壞問卷規則與 ET 匯入
- 建議：服務層以 code 字串為對外鍵，INT 只留在 `semesters` 內部

### AUD-DA-05 問卷雙寫

- 類別：資料
- 符號：`surveyModuleService.submitPublicResponse`；`surveySettingsSyncService`
- 觀察：先寫 legacy 英桌／英社表，再寫 `survey_responses`。第二步失敗只記 log
- 應維持：Gate 與匯出看到同一筆完成狀態
- 證據：`surveyModuleService.js` 約 335–401 行
- 信心：CONFIRMED
- 嚴重度：P2
- 使用者影響：學生已填但仍被 Gate 擋，或後台統計少筆
- 維護影響：修 Gate 必須知道讀哪張表
- 安全／完整性：中
- 工作量：M
- 相依：歷史報表是否仍查 legacy 表（**UNVERIFIED**）
- 回歸：改成單寫會讓舊匯出變少
- 建議：對帳工作先列出「legacy 有、新表沒有」的筆數；未對帳前保持雙寫，但第二步失敗應進入可重試紀錄而不是只 `console.error`

### AUD-DA-06 黑名單與預約身分鍵不同

- 類別：領域
- 符號：`BlackListRecord.userId`、`EventViolation.userId`、`Reservation.studentId`、`User.isBlacklisted`
- 觀察：違規掛在 `Users`。預約列只存學號字串
- 應維持：黑名單學生不能預約；次數以當學期紀錄為準
- 信心：CONFIRMED 鍵不同。服務是否每次都對得上：**部分 UNVERIFIED**（未重讀 enforcement 的每個查詢）
- 嚴重度：P2
- 使用者影響：學號在 `Users` 沒有列時，違規與預約可能對不齊
- 維護影響：中
- 安全／完整性：中高
- 工作量：M
- 相依：AUD-DA-01
- 回歸：改 FK 會影響既有違規列
- 建議：預約前解析必須經同一函式找到 `User`；缺列時的行為寫進測試（拒絕或自動建列，需產品決定）

### AUD-DA-07 無 FK 的參照

- 類別：資料
- 觀察：`Reservation.studentId`、`ClassMembership.studentId`、`Event.eventType`、`Event.semesterId`、`Reservation.passportSubmissionId`、`EtExamAttempt.studentId`、`LjAnalyticStudent.studentId` 在 `models/index.js` 沒有對應 belongsTo
- 信心：CONFIRMED（以 Sequelize 模型為準）。資料庫是否另有 FK：**UNVERIFIED**
- 嚴重度：P2
- 使用者影響：刪除活動類型或學期後留下孤兒代碼
- 工作量：L
- 回歸：補 FK 會因既有髒資料而 migration 失敗
- 建議：先出孤兒報告，不要直接加 constraint

### AUD-DA-12 權限雙寫

- 類別：授權資料
- 符號：`services/accessControl/writeService.js` 的 `phase3_dual_write`；`auth/accessProfile.js`；資料表 `role_permissions`、`user_permission_overrides`、`user_scopes`
- 觀察：程式基礎集合、Teacher JSON、資料表同時存在
- 應維持：同一帳號每次請求得到同一組權限
- 信心：CONFIRMED 雙寫路徑存在。正式環境以哪一邊為準需看 `resolveEffectiveAccessSources` 的優先順序（本次未逐行摘錄優先序，細節標 **部分 UNVERIFIED**）
- 嚴重度：P2
- 使用者影響：權限剛改完仍看到舊選單，直到 `accessVersion` 讓 token 失效（該 401 路徑是 CONFIRMED）
- 工作量：M
- 回歸：停寫 JSON 會讓舊工具還在讀 JSON 的環境失準
- 建議：文件標明讀取順序；`access:check-consistency` 留在 CI。不要在這次稽核後直接清 JSON

### AUD-BE-04 未掛載路由與註解

- 類別：架構
- 符號：`englishTestTrackingRouter`、`featureFlagsRouter`、`surveySettingsRouter`、`englishTestsRouter` 未在 `server.js` require。第 145–149 行註解緊鄰仍掛載的 `learningJourneyRouter`
- 信心：CONFIRMED
- 嚴重度：P2
- 使用者影響：無，除非有外部客戶端仍打未掛載路徑（會落到 SPA 的 API 404）
- 維護影響：改到死檔或誤關仍在服務的 LJ 路由
- 工作量：S（加註解與呼叫搜尋）；下線是 M
- 回歸：移除 `learningJourneyRouter` 掛載前必須確認前端與腳本
- 建議：註解改寫成「未掛載的是 tracking／featureFlags／…；learningJourneyRouter 仍掛載，因為 …」。下線另案

### AUD-BE-05 排程綁 API 進程

- 類別：維運
- 符號：`server.js` 的 `setInterval`、`startEventAutoCheckScheduler`、`startEwlDailySyncScheduler`、`startBackupDailyScheduler`；`ecosystem.config.cjs` `instances: 1`
- 觀察：沒有 node-cron。多實例時每日工作會跑多次
- 信心：CONFIRMED
- 嚴重度：P2（以現況單實例而言是潛在風險，不是現行故障）
- 使用者影響：若有人把 PM2 調成 cluster，活動收斂、EWL、備份可能重複
- 工作量：M
- 回歸：把排程搬出進程會改變「重啟 API 才跑得到排程」的操作習慣
- 建議：在部署文件寫明必須單實例。要水平擴展前再把排程拆進程並加 `job_runs` 鎖

### AUD-BE-07 errorHandler 可能吃掉業務 code

- 類別：API
- 觀察：service 以 `err.status` + `err.code` 丟錯時，全域 handler 不一定把 `code` 放進 JSON
- 信心：SUSPECTED
- 嚴重度：P2
- 建議：抽一條已知 `code`（例如分組已發布）做 supertest。確認後再改 handler，舊欄位保留

### AUD-BE-09 取消預約無 transaction

- 類別：後端
- 符號：`reservationService.cancelReservationPublic`／管理端取消
- 觀察：單次 `destroy()`。連動通知或候補若在 route 另做，沒有同一交易
- 信心：CONFIRMED `destroy` 不在交易內。連動步驟的完整清單 **UNVERIFIED**
- 嚴重度：P2
- 工作量：M
- 回歸：把取消放進交易可能延長鎖，或改變「刪了但信沒寄出」的現況（現況可能是故意先刪）
- 建議：先畫出取消的副作用清單，再決定哪些必須同一交易

### AUD-FE-03 三種 HTTP 呼叫

- 類別：前端
- 符號：`fetchClient.js`、`axiosClient.js`（無 import）、`ViolationManagement.js` 等直接 `fetch`
- 信心：CONFIRMED
- 嚴重度：P2
- 使用者影響：這些頁的 401 `ACCESS_PROFILE_STALE` 可能不會走共用登出
- 工作量：S 到 M
- 回歸：改違規頁的錯誤處理會影響簽到流程
- 建議：舊頁隨改動改用 `fetchClient`。不要為了刪 axios 先做大重寫

### AUD-FE-04 兩套分析產品

- 類別：UX／領域
- 路徑：`/admin/learning-analytics/*` 與 `/admin/analytics/overview`、`/admin/analytics/risk`、`/admin/reports`
- 信心：CONFIRMED 兩套都還在路由上
- 嚴重度：P2
- 使用者影響：同名「分析」點進不同指標
- 工作量：M（導覽文案）；合併指標是 L
- 回歸：舊報表若仍給主管，不能直接重導向到 LVA
- 建議：側欄標「現行成效分析」與「舊營運報表」。指標定義維持 `analytics-and-reports-metric-definitions.md`

### AUD-FE-07 權限鏡像不在腳本內

- 類別：授權
- 符號：`accessProfile.js`、`utils/accessControl.js`、`scripts/check-access-control-consistency.js`
- 觀察：前端基礎權限是手抄。腳本不讀前端檔
- 信心：CONFIRMED
- 嚴重度：P2
- 工作量：M
- 回歸：腳本過嚴會讓 CI 紅在註解差異
- 建議：比對鍵集合與 `buildBasePermissionSet` 的角色結果，而不是整檔文字 diff

### AUD-SEC-01 admin 前綴沒有統一認證

- 類別：授權
- 觀察：`server.js` 不對 `/api/admin` 一律套 `authMiddleware`。保護靠各檔
- 信心：CONFIRMED
- 嚴重度：P2（結構風險）。本次沒有找到一個完全無認證的 admin 寫入端點，**不能**說已經有開放的管理 API
- 工作量：M
- 回歸：全域 middleware 可能擋住公開子路徑或雙重驗證
- 建議：加測試，掃描 admin router 檔案必須出現 `authMiddleware` 或明確的 allowlist 註解

### AUD-SEC-05 401 與 403

- 類別：API
- 觀察：缺 token 多為 401；`requirePermission` 在沒有 `req.user` 時回 403。另有 `PASSWORD_RESET_REQUIRED`、多種 `*_SCOPE_DENIED`、`notificationsRouter` 的 `{ error: 'Unauthorized' }`
- 信心：CONFIRMED
- 嚴重度：P2
- 使用者影響：前端把 403 當「沒權限」而不是「請登入」
- 工作量：S
- 回歸：把 403 改 401 會讓現有「權限不足」文案跑去登出流程
- 建議：新路由規定先 `authMiddleware` 再 `requirePermission`。不批量改既有狀態碼

### AUD-SEC-06 權限文件過期

- 類別：文件
- 檔案：`docs/DEVELOPER_PERMISSION_GUIDE.md`、`docs/PHASE_2_6_PERMISSION_MATRIX.md`
- 觀察：未列 `can_view_learning_analytics`、`can_manage_et_grouping`、ELP 鍵、學生帳號。矩陣仍把 Phase 3 寫成規劃。`DELETE /api/reservations/:id` 的敘述與現況停用回應不一致
- 信心：CONFIRMED（抽樣鍵與停用路由）
- 嚴重度：P2
- 工作量：S
- 建議：在文件頂部加「不以本檔為準，以 `permissions.js` 為準」，再另案重寫。不要在程式裡為了遷就舊文件改路由

### AUD-SEC-07 `/uploads` 靜態

- 類別：安全
- 符號：`server.js` `express.static(uploadsPath)`
- 信心：SUSPECTED。未列出上傳目錄裡是否有身分證、名冊或僅有公開圖
- 嚴重度：P2
- 工作量：M
- 回歸：若課程指南圖片靠公開 URL，加上授權會壞公開頁
- 建議：清點上傳類型。公開素材與身分證件分目錄。本次不下「關閉 /uploads」的結論

### AUD-SEC-08 口說與 learning-traces 無 JWT

- 類別：安全
- 符號：`speakingCheckRouter`、`speakingDiagnosticRouter`、`learningTraceRouter` POST
- 信心：SUSPECTED 為問題。可能是匿名練習與匿名遙測的設計
- 嚴重度：P2
- 建議：確認是否寫入可識別學號。若會，再補 rate limit 與綁定。不要先全部套 student JWT

### AUD-DA-08 多套匯入歷史

- 嚴重度：P3
- 信心：CONFIRMED 多表
- 建議：在 Import Center 用標籤指向各自歷史，不要合成一張表

### AUD-DA-09 多套稽核表

- 類別：維運
- 表：`audit_logs`、`survey_admin_audit_logs`、`english_learning_audit_logs`、`system_logs`、`email_logs`
- 嚴重度：P2（查詢成本，不是功能故障）
- 信心：CONFIRMED
- 建議：後台日誌頁標明來源。聚合查詢可以晚做

### AUD-DA-10 問卷答案 constraints: false

- 嚴重度：P3
- 信心：CONFIRMED
- 理由：註解寫明型別相容。強行加 FK 可能讓正式環境 migration 失敗
- 建議：維持，直到欄位型別對齊有單獨變更

### AUD-DA-11 migration 命名

- 嚴重度：P3
- 觀察：約 168 個 migration 檔；多數有時間戳；另有無時間戳 `.js` 與數個 `.sql`
- 信心：CONFIRMED 命名混雜。哪些 `.sql` 沒進 `sequelizemeta`：**UNVERIFIED**
- 建議：新變更只用時間戳 js。不要為了改名去重跑歷史 migration

### AUD-DA-13 SystemSettings migration

- 信心：SUSPECTED（目錄字串未見建表）
- 嚴重度：P3
- 建議：對 `models/SystemSettings.js` 與 `settings` 表的使用處做一次引用搜尋後再決定。不要刪模型

### AUD-BE-06 zod 未使用

- 信心：CONFIRMED（全後端無 `require('zod')`）
- 嚴重度：P3
- 建議：可從依賴移除，但要另開 PR 並跑 `npm test`。不要在移除時順便引入新的驗證框架

### AUD-BE-08 分頁參數

- 嚴重度：P3
- 信心：CONFIRMED 名稱並存
- 建議：新 API 用 `page` + `pageSize`，舊 API 兩種都接受

### AUD-BE-10 bcrypt 未使用

- 信心：CONFIRMED（無 `require('bcrypt')`，密碼用 `bcryptjs`）
- 嚴重度：P3
- 建議：與 zod 一樣，單獨 PR 移除依賴。原生 bcrypt 在 Windows 建置較重，留下沒有好處，但移除仍要跑登入測試

### AUD-FE-05 空狀態與 downloadBlob

- 嚴重度：P3
- 信心：CONFIRMED
- 符號：`EmptyState.js` 與 `HubUi.jsx`；`englishTestApi` 的 `(blob, fileName)` 與 `learningJourneyOperationsHelpers` 的 `(filename, blob)`
- 建議：新程式抄同一順序。不為了統一去改已經對上的呼叫點，除非有測試

### AUD-FE-06 用詞

- 嚴重度：P3
- 證據：`constants/translations.js`、`adminNavigation.js`「英檢與培力」
- 建議：公開導覽選定一個學生看懂的詞（培力英檢報名）。不要改 API 路徑

### AUD-FE-08 axios 無引用

- 信心：CONFIRMED
- 嚴重度：P3
- 建議：確認建置沒有其他動態 import 後再移除 `axios` 與 `axiosClient.js`

### AUD-FE-09 未掛載頁面檔

- 信心：CONFIRMED 未在 `App.js` import（抽樣名單見一致性稽核）
- 嚴重度：P3
- 建議：**不要刪**。先全庫搜尋 import。`ClassBestepOverview` 元件與 `ClassBestepOverviewPage.js` 可能不是同一個入口

## 明確不登錄為缺陷的項目

- CEFR 呈現與 GSE 比較並用
- 取消驗證碼仍存在
- Import Center 不是統一上傳 API
- `xlsx` 與 `exceljs` 同時被 require
- 線上候補模型仍在而 skill 說已停用：寫入路徑 **UNVERIFIED**，先不登記成「必須刪表」
