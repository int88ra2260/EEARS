# EEARS 領域規則矩陣（DOMAIN_RULES_MATRIX）

- 稽核日期：2026-10-29
- 「應維持」來自 `.cursor/rules/eears-business-rules.mdc` 與對應 skill。它們是專案護欄，不是獨立的產品規格書。
- 若程式與護欄不同，標成不一致，不自動判定哪一邊才是業務真相。

圖例：一致／不一致／部分一致／未驗證。

## 1. 學生身分

| 規則 | 應維持 | 程式實際 | 判定 | 證據 |
|------|--------|----------|------|------|
| 學生個人功能須登入，且操作者是 session 學號 | 預約、我的預約、我的紀錄、口說紀錄、課堂加分、培力報名不可改送他人學號 | 上述路由使用 `studentAuthMiddleware` + `bindStudentIdentity`（預約建立、我的預約、取消公開流、進度、課堂加分） | 部分一致 | `routes/reservationRouter.js`、`middlewares/studentAuth.js`、`App.js` 的 `RequireStudentAuth` |
| 學生主鍵仍是學號 | 不改成只認 email 或只認密碼 | 業務關聯仍以學號字串為主；LJS 另有 `students.id`（`studentPk`） | 部分一致 | `models/Student.js`、`models/ExamAttempt.js`、`models/User.js` |
| 帳號與後台 teachers 分開 | 兩套登入 | `POST /api/login` 與 `POST /api/student-auth/login`；JWT `typ` 互斥 | 一致 | `loginRouter.js`、`studentAuthService.js`、`auth.js` 拒絕 student token |
| 登入不能跳過黑名單、問卷、名額、截止 | Gate 與黑名單仍在預約路徑 | `POST /reservations` 仍經 `checkSurvey`；黑名單檢查仍在預約流程（服務層，本次未逐行重讀每一個 if） | 部分一致 | `reservationRouter.js` 掛 `checkSurvey`；`blacklistEnforcementService.js` 存在且有測試檔 |
| 取消驗證碼在學生登入全面取代前不可移除 | 公開取消仍驗證碼 | `Reservation.cancellationCode` 仍在；取消路由仍有驗證 | 一致 | `models/Reservation.js`、`reservationRouter.js` |
| 英語學習護照也屬個人紀錄 | 護欄寫「其他只屬於該生的紀錄」須登入 | 學生頁**沒有** `RequireStudentAuth`；API 用 email 驗證碼、captcha、rate limit，不使用 student JWT | 不一致 | `App.js` 護照路由；`englishLearningPassportRouter.js` |
| 學習有伴組隊報名 | 護欄未單獨寫死必須學生 JWT | 公開組隊與 token 同意流；管理端另有 `learningPartnerAdminAuth` | 未驗證是否應改為學生 JWT | `learningPartnerRouter.js`、`App.js` `/register/english-test/group` |
| 學生學習歷程 dashboard | 個人資料應綁 session | `GET /api/student-learning-journey/dashboard` 用學號＋姓名＋email 對 `Reservation` 比對，**不是** student JWT | 不一致 | `learningTraceRouter.js`、`studentLearningJourneyService.verifyStudentIdentity`（安全盤點所引；本次未重讀函式本體，信心：**SUSPECTED** 待對照該函式） |
| 問卷 my-status | 個人填答狀態不應只靠學號 | `GET /api/surveys/my-status` 無 JWT，查詢帶 `studentId` | 未驗證回應是否含答案內文 | `surveyGatewayRouter.js`、`surveyCenterService.js` |

### 學號欄位寬度（同一語意、不同 schema）

| 模型 | 長度 | 與 `students` 的 FK |
|------|------|---------------------|
| `Student.studentId` | STRING(20) | 自身 |
| `StudentAccount.studentId` | STRING(20) | 無 |
| `User.studentId` | STRING(50) | 無 |
| `EtStudentMaster.studentId` | STRING(50) | 無 |
| `EnglishTestRegistration.studentId` | STRING(50) | 無 |
| `ClassMembership.studentId` | STRING(50) | 無（只有 `classId`） |
| `EtExamAttempt.studentId` | STRING(50) | 無 |
| `EnglishLearningPassport.studentId` | STRING(50) | 無 |
| `SurveyModuleResponse.studentId` | STRING(80)，可空 | 無 |
| `Reservation.studentId` | STRING，未指定長度 | 無 |
| `ExamAttempt` | STRING(20) **加上** `studentPk` | 有，指向 `students.id` |

學號超過 20 字元時，canonical `students` 與預約／報名表無法用同一個字串約束。這是資料完整性風險，不是單純命名風格。

## 2. 學期

| 規則 | 實際 | 判定 |
|------|------|------|
| 黑名單違規次數以**當學期** `BlackListRecord` 計算，跨學期歸零 | `User.violationCount` 註解寫明依當學期重算；黑名單主鍵是 `Users.id` 不是學號 | 部分一致。語意在服務層，schema 不強制學期邊界 |
| 預約開放窗讀 `event_types.openRule`，不是全域 7 天 | `eventTypeService` 與前後端 `reservationTime.js` 仍在 | 一致（本次未重跑計算案例） |
| LJ canonical 從設定學期起禁止 legacy 寫入 | `canonicalSemesterPolicyService.buildCanonicalPolicy` | 一致於該服務；其他模組（班級、培力報名）仍各自存字串學期 |
| 全系統只有一個學期主檔 | `semesters`（INT）、`et_semesters`（STRING PK）、各表字串並存 | 不一致 |

跨模組篩選「同一學期」時，呼叫端必須知道該 API 要 `semesterId` 數字還是 `114-1` 字串。分頁參數也不統一：`page`+`limit`、`page`+`pageSize` 並存（見一致性稽核）。

## 3. 活動類型與生命週期

| 規則 | 實際 | 判定 |
|------|------|------|
| 類型含 `cutoffHours`、`openRule`、`surveyGateEnabled` | `models/EventType.js`、`eventTypeService.refreshCatalogCache` 於啟動暖機 | 一致（欄位層級；本次未對每個類型 seed 重跑） |
| 預約與公開取消共用同一 `cutoffHours` | 前後端 `reservationTime.js` | 一致（以既有護欄所指程式為準；本次未做案例測試） |
| 活動結束有自動檢查 | `startEventAutoCheckScheduler` | 存在。與手動收斂是否雙重寫狀態，**未驗證** |
| `Event.eventType` 應參照 `event_types` | 模型存 code 字串；`models/index.js` 無 `Event.belongsTo(EventType)` | 參照完整性靠應用層 |

線上候補：專案 skill 寫明已停用。`EventWaitlistEntry` 模型仍在。是否還有寫入路徑，**未全庫追完**（UNVERIFIED）。

## 4. 預約與取消

| 步驟 | 位置 | 備註 |
|------|------|------|
| 建立 | `reservationRouter` `POST /reservations` | 學生 JWT、`bindStudentIdentity`、`checkSurvey`、transaction 在 route 內 |
| 學生取消 | 同 router 公開取消路徑 | 學生 JWT，仍檢查 `cancellationCode` |
| 管理端取消 | `reservationService` | `destroy()`，**沒有**包 transaction |
| 舊 `DELETE /reservations/:id` | 同 router | 直接回應停用（權限舊文件仍可能描述舊行為） |

建立與取消不在同一個服務邊界。取消若還要連動通知、候補或護照計次，失敗窗口在 route 與 service 之間。候補連動的現行範圍本次標 **UNVERIFIED**。

## 5. 問卷 Gate

| 條件 | 實際 |
|------|------|
| 類型旗標 | `event_types.surveyGateEnabled` |
| 規則 | `survey_rules.isEnabled` 且 `isRequired`，再加 `ruleTimeAllows` |
| 失敗 | `checkSurvey` 回 409，帶 `code` 與 `redirectUrl: /survey/{surveyKey}` |
| 後端 fail-close | middleware 仍掛在預約建立 |

判定：**Gate 契約仍在**（與 `docs` 中 `SURVEY_GATE_FLOW.md` 的方向一致；本次未重跑 `surveyFailClose` 測試）。

額外事實：公開提交 `surveyModuleService.submitPublicResponse` 先寫 `EnglishTableSurveyResponse` 或 `EnglishClubSurveyResponse`，再 best-effort 寫 `SurveyModuleResponse`。後者失敗只 `console.error`，不讓整筆提交失敗。Gate 若讀新表、名單若讀舊表，可能短期不一致。`surveySettingsSyncService.js` 另有 `survey_settings` → `survey_rules` 的過渡同步。

## 6. 出席、違規、黑名單

| 概念 | 鍵 | 備註 |
|------|----|------|
| 預約列 | `reservations.studentId` 字串，另存姓名與 email | 不 FK 到 `Users` 或 `students`（`userId` 可選） |
| 簽到狀態 | `Reservation.checkinStatus`：未簽到／已簽到／已登記違規 | 中文 enum |
| 違規 | `EventViolation.userId` → `Users` | **不是**學號欄 |
| 黑名單紀錄 | `BlackListRecord.userId` → `Users` | 關聯寫在模型檔內 |
| 黑名單狀態 | `User.isBlacklisted`、`blacklistUntil`、`violationCount` | 快取欄位加上紀錄表 |

判定：封鎖語意集中在 `Users`，預約列不持有黑名單狀態。服務必須用學號找到 `User`。學號對不上或一人多列時，預約與黑名單會分裂。這是跨模組一致性問題，不是「黑名單功能不存在」。

解封（週日）與「黑名單期間不可預約」的細節在 `blacklistEnforcementService.js`。本次**未**重算週日邊界案例，標為規則仍有專用服務與測試檔，案例正確性 UNVERIFIED。

## 7. 培力報名與 BESTEP 成績

| 資料 | 表 | 寫入後去向 |
|------|----|------------|
| 報名 | `english_test_registrations`，唯一鍵含 `(studentId, semester)` | 管理端巨型 router |
| BESTEP 成績 | `bestep_exam_scores` | `syncService.syncBestepScoresToExamAttempts` 再寫入 canonical `exam_attempts` |
| Legacy 英檢成績 | `et_exam_attempts` | v3 讀取路徑仍會碰到；與 `exam_attempts` 並存 |
| 班級名冊 | `class_memberships.studentId` 字串 | 不指向 `students.id` |

`eventProjectorService.js` 註解要求避免 BESTEP 再被投影雙寫。三條線（BESTEP 原表、canonical attempt、legacy ET attempt）要靠 sync 與對帳，不是資料庫外鍵。

## 8. Learning Journey 計算

| 層 | 角色 | 開關 |
|----|------|------|
| `et_*` | legacy 名冊、匯入、舊成績 | 歷史學期仍可寫 |
| `students` + `exam_attempts` + `activity_participations` | canonical | 門檻學期之後要求 |
| `lj_student_events`、`lj_analytic_*` | 分析投影 | 由 rebuild／job 產生，不是現場交易來源 |
| 讀取 | v3 為預設 | `ENABLE_LEARNING_JOURNEY_V3_READ_MODEL !== 'false'` |
| Fallback | 讀模型可退到 `et_student_master`、`et_enrollment_snapshots`、`et_exam_attempts`、`reservations` | `learningJourneyFallbackLogger.js` |

CEFR 用於達標呈現，GSE 用於比較與「接近 B2」（GSE 51–58）。這是成效分析的刻意雙尺，不是兩套互相矛盾的及格線。前端 `LearningAnalyticsB1PlusPage.jsx` 與 `LearningAnalyticsSkillsPage.jsx` 沿用此分工。

舊網址 `/admin/english-test-tracking`、`english-test-v2`、`learning-journey-center` 在 `App.js` 重導向到 `/admin/learning-journey`。後端 `englishTestTrackingRouter` 未掛載。

## 9. 匯入狀態

Import Center **不是**單一上傳端點。各匯入有自己的歷史表：

| 表 | 用途 |
|----|------|
| `learning_journey_import_histories` | 名冊、外部考試、學測基線 |
| `et_attempt_import_histories` | legacy 成績批次 |
| `migration_batch`／checkpoint／quarantine | LJS 遷移治理，不是一般 Excel UI |
| `job_runs` | 通用工作紀錄 |
| `import_rollback_manifests` | 依 `importBatchId` 的回滾清單（班級名冊、活動卡片等） |
| `learning_journey_operation_runs` | sync／rebuild；`archivedAt` 手動封存 |

「匯入成功」沒有跨模組的單一 enum。各服務自己的 status 字串。刪除匯入紀錄的權限在 `importRunHistory` 路徑，本次未逐一對照每個匯入的刪除窗口。

## 10. 權限語意（領域面）

| 維度 | 不要混用 | 實際 |
|------|----------|------|
| `role` | admin／teacher／worker／office_staff／leader | `accessProfile.js` |
| `teacherLevel`／`staffLevel`／`workerLevel` | 與 role 不同軸 | 同一教師列上的另一組欄位 |
| 權限鍵 | `can_*` | `auth/permissions.js` 與前端 `constants/permissions.js` |
| 資料範圍 | scope，不是再發明一種 role | `user_scopes`；403 的 `errorCode` 依模組而異 |

前端隱藏導覽不是授權。後端漏掛 `authMiddleware` 時，只掛 `requirePermission` 會得到 **403** 而不是 401（`middlewares/auth.js`）。

## 11. 刻意保留的差異（不要當成缺陷直接合併）

| 項目 | 為什麼先分開 |
|------|----------------|
| CEFR 達標 vs GSE 成長 | 成效分析的定義不同 |
| Import Center 與各匯入器 | 去重鍵、權限、回滾不同 |
| Staff JWT 與 Student JWT | 帳號主體不同 |
| 取消驗證碼仍在 | 護欄要求在登入完全取代前保留 |
| `xlsx` 讀、`exceljs` 寫 | 兩邊都在用；統一函式庫是依賴決策，不是正確性 bug |
| 問卷 legacy 表 | 歷史報表與 Gate 可能仍讀舊表；停寫入前要先對帳 |
