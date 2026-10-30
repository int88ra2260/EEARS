# EEARS 跨模組一致性稽核（CONSISTENCY_AUDIT）

- 稽核日期：2026-10-29
- 發現的完整欄位（影響、工作量、回歸風險）在 `TECHNICAL_DEBT_REGISTER.md`。
- 本文件回答六個維度，以及「相似功能要不要抽共用」。

信心：`CONFIRMED` 表示已讀到檔案或符號；`SUSPECTED` 表示盤點指出路徑但本次未重讀函式本體或未看回應內容；`UNVERIFIED` 表示沒有檢查。

## A. 前端／UX

已檢：`App.js` 路由、管理端導覽與存取矩陣、API client、空狀態與匯出的抽樣、權限儲存。未檢：逐頁間距、色彩、斷點、鍵盤操作、實際雙語對照。

### 已看到的共用件

- 設計變數：`src/styles/design-system.css`（主色 `#2a5d9f`）
- Toast：`components/ui/ToastProvider.jsx`
- 確認框：`components/ui/ConfirmDialog.jsx`、`hooks/useConfirmModal.js`
- 路由 loading：`components/ui/RouteLoading.jsx`
- 空狀態：`components/ui/EmptyState.js`，但學習歷程 hub 另有自己的 `EmptyState`（`components/learningJourneyV3/hub/HubUi.jsx`）

### 同一模式的多套實作

| 模式 | 觀察 | ID |
|------|------|----|
| 管理端資訊架構 | 路由、側欄、權限三份清單必須手改 | AUD-FE-01 |
| 表格 | 班級、活動預約、公告、英檢各自實作，沒有單一 DataTable | 保持各模組（見第 3 節） |
| 篩選／學期 | 成效分析、班級、BESTEP、活動後台各自組 `<select>` | AUD-FE-04 相關 |
| 分頁 | react-bootstrap `Pagination`、班級表、學習有伴、LJ hub offset 並存 | AUD-BE-08 |
| 匯出下載 | `downloadBlob` 參數順序在英檢 API、LJ helper、成效分析頁不一致 | AUD-FE-05 |
| HTTP | `fetchClient` 為主；`axiosClient` 無引用；違規管理等仍直接 `fetch` | AUD-FE-03 |
| 空／錯／載入 | 新頁多用共用件；舊 `.js` 後台頁內嵌 Spinner 或 `window.confirm` | AUD-FE-05 |
| 用語 | 公開文案同時出現「培力英檢」與「英檢報名」；後台區塊叫「英檢與培力」 | AUD-FE-06 |
| 分析入口 | `/admin/learning-analytics/*` 與 `/admin/analytics/overview`、`/admin/reports` 並存 | AUD-FE-04 |

無障礙與響應式：規則要求 FullCalendar 手機仍保留月曆、modal 呈現活動。本次**沒有**用瀏覽器驗證，標 UNVERIFIED。

學生路由守衛不一致：我的預約、進度、口說紀錄、課堂加分、培力報名有 `RequireStudentAuth`；英語學習護照頁沒有（AUD-FE-02）。這是產品入口差異，視覺層未審。

未掛在 `App.js`、容易改錯檔的頁面模組：`pages/admin/SurveyManagementPage.js`、`SurveySettingsPage.js`、`ClassBestepOverviewPage.js`、`ForceResetPasswordPage.js`、`LearningAnalyticsInsightsPage.jsx`。`ForceResetPassword` **元件**仍有路由，與 `ForceResetPasswordPage.js` 不是同一個檔。不要依「沒被 import」就刪。

## B. 後端架構

已檢：`server.js` 掛載、錯誤處理器、抽樣巨型路由、交易與驗證工具、排程。未檢：每個 mutating 端點是否有 transaction。

| 主題 | 判定 | ID |
|------|------|----|
| 分層 | 新模組（成效分析、LJ v3、匯入紀錄、BESTEP）較接近 controller／service；預約建立、活動、培力報名、黑名單仍大量在 route | AUD-BE-02 |
| 驗證 | `utils/validators.js` 與 handler 手動檢查。沒有 joi／express-validator。`zod` 在依賴裡但沒有 `require('zod')` | AUD-BE-06 |
| 錯誤契約 | 至少六種 JSON 形狀並存 | AUD-BE-01 |
| 交易 | 建立預約的 transaction 在 route；`reservationService` 取消是單次 `destroy()` | AUD-BE-09 |
| 分頁參數 | `limit` 與 `pageSize` 並存 | AUD-BE-08 |
| 日誌 | `utils/logger.js` 為 console 等級，不是 winston。另有 system／audit／survey／ELP／email 五類紀錄 | AUD-DA-09 |
| 背景工作 | 全部在 API 進程；PM2 單 instance。若將來 `instances > 1`，排程會重複 | AUD-BE-05 |
| 未掛載路由 | 四個 router 檔在磁碟上但 `server.js` 未引用 | AUD-BE-04 |
| 測試 | `reservationFlow.test.js` 只斷言常數物件，沒有 supertest | AUD-BE-03 |
| `errorHandler` 是否透傳 `err.code` | 部分 service 把 `status`／`code` 掛在 Error 上；全域 handler 多數改寫成通用 error key | AUD-BE-07，**SUSPECTED**（未對每個 `next(err)` 路徑回放） |

`backend-api.mdc` 寫「route handler 不要超過約 30 行」。`englishTestRegistrationRouter.js` 3624 行、`eventRouter.js` 1728 行。規範與現況不符，但是現行行為的承載處，不能先拆再補測試。

## C. 領域規則

細節與表格式對照在 `DOMAIN_RULES_MATRIX.md`。這裡只列跨模組衝突。

1. **學號有多個主檔**（`Users`、`students`、`student_accounts`、`et_student_master`、報名、班級），沒有共同 FK（AUD-DA-01、AUD-DA-02）。
2. **學期有三種鍵**（INT、`et_semesters` 字串主鍵、各表字串）（AUD-DA-03）。
3. **成績有三條線**：`bestep_exam_scores`、`exam_attempts`、`et_exam_attempts`（AUD-DA-04）。
4. **問卷作答雙寫**，新表失敗不回滾舊表（AUD-DA-05）。
5. **黑名單走 `Users.id`，預約走學號字串**（AUD-DA-06）。
6. **個人資料的認證方式有三種**：student JWT、email 驗證碼（護照）、學號或學號＋姓名＋email（問卷 my-status、學習歷程 dashboard）（AUD-SEC-04、AUD-FE-02）。
7. **預約 Gate／截止／取消驗證碼**這三條底線在主路徑上仍看得到，本次沒有發現被刪除的證據。

CEFR 與 GSE 並用是定義分工，不列入缺陷。

## D. 資料架構

已檢：`models/index.js` 的關聯群、上表模型欄位、抽樣雙寫服務。未檢：實際 MySQL 的 FK 與索引是否與模型一致；164 支以上 migration 的逐檔 diff。

| 主題 | 判定 | ID |
|------|------|----|
| Sequelize `paranoid` | 僅 `Announcement` 使用 `deletedAt`。LJ operation run 用 `archivedAt` | 不是全域軟刪 |
| 問卷答案 FK | `SurveyResponseAnswer` 對 `SurveyModuleResponse` 設 `constraints: false`（註解為 signed／unsigned 相容） | AUD-DA-10 |
| `Event.semesterId`、`Event.eventType` | 有欄位，index 無 belongsTo | AUD-DA-07 |
| `Reservation.passportSubmissionId` | 註解指向護照提交，無 association | AUD-DA-07 |
| 權限 | Teacher JSON 與 `role_permissions`／override 雙寫 | AUD-DA-12 |
| `SystemSettings` 模型 vs migration | migrations 目錄字串搜尋未見建表；有清理舊 `systemsettings` 的腳本 | AUD-DA-13，**SUSPECTED** |
| Migration 命名 | 多數有時間戳；另有少量無時間戳 `.js` 與獨立 `.sql` | AUD-DA-11 |
| 匯入歷史 | 多表並存，用途不同 | AUD-DA-08，先不要合成一張表 |

`SurveyResponse` 是 `SurveyModuleResponse` 的別名，表名 `survey_responses`。讀 code 時兩個名字都要認得。

## E. 認證與授權

已檢：`auth.js`、`studentAuth.js`、`permissions.js`、`server.js` 沒有全域 auth、權限文件與程式鍵的抽樣落差、預約與護照的認證方式。未檢：每個 admin 路由是否都有 `requirePermission` 的完整矩陣；未做入侵測試。

| 主題 | 判定 | ID |
|------|------|----|
| Staff JWT | 只讀 `Authorization: Bearer`。拒絕 `typ === 'student'`。正式環境 `accessVersion` 不符回 401 `ACCESS_PROFILE_STALE` | 與設計一致 |
| Student JWT | 綁 `student_accounts.studentId`。`bindStudentIdentity` 覆寫請求裡的學號 | 與預約底線一致 |
| 前端權限 | `constants/permissions.js` 鍵集合與後端 `P` 對齊（抽樣；未跑一致性腳本） | 鍵名一致，**映射邏輯另有一份**在 `utils/accessControl.js` |
| 一致性腳本 | `access:check-consistency` 比對 DB／JSON，不掃前端 | AUD-FE-07 |
| `/api/admin` 沒有前綴級 auth | 新 router 若忘記 middleware，不會被 `server.js` 擋住 | AUD-SEC-01 |
| `GET /api/teachers/students/participation` | 只有 `authMiddleware`，沒有 `requirePermission`；資料用 `req.user.name` 對班級 | AUD-SEC-02 |
| `GET /api/surveys/my-status` | 無 JWT，參數為 `studentId` | AUD-SEC-03，**SUSPECTED**（未看回應欄位是否含答案） |
| 401／403 | 未登入通常 401；只掛 `requirePermission` 且沒有 `req.user` 時是 403 `INSUFFICIENT_PERMISSIONS` | AUD-SEC-05 |
| 權限文件 | `DEVELOPER_PERMISSION_GUIDE.md`、`PHASE_2_6_PERMISSION_MATRIX.md` 未跟上 LVA、ET 分組、ELP、學生帳號 | AUD-SEC-06 |
| `/uploads` 靜態 | `express.static`，未見逐檔授權 | AUD-SEC-07，**SUSPECTED** |
| 口說檢查／診斷、`POST /api/learning-traces` | 無 staff／student JWT，靠 session 或直接寫入 | AUD-SEC-08，**SUSPECTED**（可能是產品設計） |
| `.env` | `.gitignore` 含 `.env`。`.env.example` 只核對鍵名，未讀秘密值 | 一致 |

沒有把「前端隱藏按鈕」當成已授權。

## F. 技術債（摘要）

完整登錄見 `TECHNICAL_DEBT_REGISTER.md`。最高維護成本來自：巨型 route、三份管理端清單、多主檔學號、三線成績、錯誤 JSON 不統一、關鍵預約流程沒有真整合測試。

冗餘依賴（已確認無人 `require`）：`bcrypt`、`zod`、前端 `axios`（僅 `axiosClient.js` 自用）。`xlsx` 與 `exceljs` 不是死依賴。

## 相似功能要怎麼收

| 模式 | 建議 | 理由 |
|------|------|------|
| 錯誤 JSON | **先定介面，再逐路由改** | 現有前端依賴 `redirectUrl`、`errorCode`、`ACCESS_PROFILE_STALE`。一次改形狀會壞 Gate 與過期權限 |
| 學號查詢 | **共用解析函式，表先不要合併** | `Users`、`students`、報名的生命週期不同。先提供 `resolveStudent(studentId)` 一類的讀取，避免每個模組各寫一次 |
| 學期篩選 | **介面統一、儲存可暫留** | API 可同時接受 code 字串，內部再對到 INT。不要先把 `et_semesters.id` 改成整數 |
| Excel 讀寫 | **模組內保持，抽共用的「開檔／列錯誤」介面** | 欄位別名與去重鍵是領域差異。函式庫二選一是獨立依賴議題 |
| 匯入結果摘要 | **畫面文案可對齊，狀態機不要合成一個** | LJ quarantine、英檢唯一鍵、班級名冊回滾窗口不同 |
| 權限檢查 | **後端強制維持各路由；前端三份清單加自動對照** | 不能只靠側欄。全域 `app.use('/api/admin', authMiddleware)` 會誤傷掛在 `/api/admin` 下、目前自管認證的少數路徑，必須先列例外 |
| 稽核日誌 | **查詢面可聚合，表先留著** | 欄位（operatorId 型別、entity、前後快照）已經分叉 |
| 分頁參數 | **新端點用同一組；舊端點加別名** | `pageSize` 與 `limit` 都已有客戶端 |
| 空狀態／確認框 | **新頁面用現成元件；舊頁面隨改動替換** | 視覺債，不是資料正確性 |
| 表格元件 | **不要做大一統 DataTable** | 簽到、名冊、問卷修復的欄與操作差異大，抽象成本高於重複 |
| 分析產品 | **導覽上標清楚哪一個是現行** | 成效分析與舊 analytics／reports 的指標定義不同（見 `analytics-and-reports-metric-definitions.md`）。合併前要對指標 |
| 個人認證 | **依資料敏感度分級，不強制全部改成同一 JWT** | 護照的 email OTP、活動列表公開、預約的 student JWT 是不同威脅模型。要改的是「會回個人紀錄卻只收學號」的端點 |

## 本次未審、因此不能下結論的 UX／行為

- 各後台頁的 loading／empty／error 是否都有下一步
- 手機版 FullCalendar 與桌機 modal 是否仍同步
- 雙語 `translations.js` 是否逐鍵對齊
- 匯出檔欄位順序是否與後台表格一致
- 黑名單週日解封的時區邊界案例
- `learningJourneyRouter` 的每個端點是否仍被前端呼叫
