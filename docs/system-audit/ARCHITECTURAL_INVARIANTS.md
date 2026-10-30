# 必須維持的架構不變量（ARCHITECTURAL_INVARIANTS）

- 日期：2026-10-29
- 這些是跨層收斂時不能改掉的行為。有些是業務底線，有些是已經在跑的相容層。
- 「刻意分離」表示看起來重複，但合併會破壞另一個工作流程。

## 業務不變量

| ID | 不變量 | 程式錨點 | 破壞時的後果 |
|----|--------|----------|----------------|
| INV-01 | 學生個人預約的操作者是 session 學號，請求裡的學號會被覆寫 | `studentAuthMiddleware`、`bindStudentIdentity`、`POST /api/reservations` | 未登入者可以替別人預約或取消 |
| INV-02 | 登入不能跳過黑名單、問卷 Gate、名額、重複預約、截止 | 預約建立鏈上的 `checkSurvey` 與黑名單服務 | 學生繞過限制 |
| INV-03 | 預約與公開取消共用活動類型的 `cutoffHours`，不寫死 2 小時 | 前後端 `reservationTime.js`、`eventTypeService` | 某一端提前或延後截止 |
| INV-04 | 開放預約讀 `event_types.openRule`，不是全域「7 天內不可約」 | `openRule` | 把 Job Talk 的起算規則誤用到所有活動 |
| INV-05 | 黑名單次數以當學期 `BlackListRecord` 計，跨學期歸零；解封邏輯保留 | `User.violationCount` 註解、`blacklistEnforcementService` | 上學期違規繼續鎖人 |
| INV-06 | 問卷 Gate 失敗是 HTTP 409，帶 `code` 與 `redirectUrl` | `middlewares/checkSurvey.js` | 前端不再導向填寫頁 |
| INV-07 | Gate 要同時看類型旗標、規則啟用、規則必填、規則時間 | `surveyGateService`、`SurveyRule` | 只關前端仍會被後端擋，或反過來後端不再擋 |
| INV-08 | 公開取消在學生登入完全取代之前仍檢查 `cancellationCode` | `Reservation.cancellationCode`、`cancel-public` | 只靠登入狀態尚不能代表所有舊連結失效 |
| INV-09 | 學生帳號與 `teachers` 帳號分開；staff middleware 拒絕 `typ === 'student'` | `loginRouter`、`studentAuthRouter`、`auth.js` | 學生 token 進後台 |
| INV-10 | 達標用 CEFR／B2；比較與「接近 B2」用 GSE 51–58 | 成效分析頁與 `eears-learning-analytics` 護欄 | 兩套尺被收成一個錯誤門檻 |
| INV-11 | canonical 寫入從設定學期起才強制，預設 `115-1`；更早學期仍可走 legacy | `canonicalSemesterPolicyService` | 歷史學期補資料失敗 |
| INV-12 | v3 讀模型預設開啟，只有環境變數明確 `false` 才回退 | `learningJourneyFeatureFlags.js` | 未公告就改讀哪一張表 |
| INV-13 | Import Center 是導覽。上傳、去重、回滾留在各匯入器 | `importCenterCards.js` | 不同去重鍵被塞進同一支 API |
| INV-14 | 排程在 API 進程內，PM2 維持單 instance，直到有 job 鎖 | `server.js`、`ecosystem.config.cjs` | 活動收斂、EWL、備份跑兩次 |

## 刻意分離（不要收成一個實作）

| 分離 | 為什麼留著 |
|------|------------|
| Staff JWT、學生 JWT、口說主持 JWT（`typ: speaking-host`） | 三種主體。主持帳號不是教師，也不是學生 |
| 護照的 email 驗證碼 vs 預約的學生 session | 護照目前不假設對方已有學生帳號。只補 `RequireStudentAuth` 會讓未建帳號的人無法送件 |
| 學習有伴的同意 token vs 學生登入 | 隊友同意連結不一定在登入狀態下打開 |
| Legacy `/api/surveys/check` 只回 `{ filled, semester }` | 填寫頁用來擋重複填。它不是 XL-01 的整筆作答 |
| `xlsx` 讀、`exceljs` 寫 | 兩邊都有正式呼叫。換函式庫是依賴決策，不是正確性修補 |
| 成效分析與 `/admin/analytics`、`/admin/reports` | 指標定義不同。側欄應該標清楚，而不是把舊報表重導向到 LVA |
| 問卷 legacy 表與 `survey_responses` 雙寫 | 舊匯出可能仍讀 legacy。停寫之前要先有對帳 |
| 表格元件按領域分開 | 簽到、名冊、問卷修復的操作不同。不需要一個共用 DataTable |
| 取消驗證碼欄位 | INV-08 |

## 相容層（可以以後拆，但現在是不變量）

| 層 | 行為 | 拆掉的前提 |
|----|------|------------|
| `buildSemesterEventFilter` | 一個學期代碼同時對整數表、ET 字串表與靜態日期 | 三個來源的日期已對帳，且所有呼叫端都只傳 code |
| `learningJourneyRouter` 仍掛在 `/api/admin/learning-journey` 與 `/api/v3/learning-journey` | 課程名冊匯入仍打前者 | `LearningJourneyV3ImportSection` 不再 import `learningJourneyApi.js` 的 roster 函式，且沒有外部客戶端 |
| 權限程式映射加上資料表雙寫 | 讀取順序已在 access control 服務 | 舊工具不再讀 Teacher JSON，且 `access:check-consistency` 是綠的 |
| 錯誤 JSON 的舊欄位 | Gate 看 `redirectUrl`；過期權限看 `ACCESS_PROFILE_STALE` | 前端與測試都改讀新欄位之後，才能刪舊欄位 |

## 收斂時的禁止事項

- 不合併 `Users`、`students`、`et_student_master`、報名、班級成員。
- 不刪 `et_*` 表，也不在消費者清單完成前關掉 fallback。
- 不把微學習改成一律要學生 JWT。
- 不因為 `my-status` 的問題去改 `/check` 的布林契約。
- 不把 `DELETE /api/reservations/:id` 恢復成真的刪除。它現在固定 **410**，並指向 `cancel-public` 或管理端取消。
- 不以「前端隱藏選單」取代後端權限。
