# Product UX 一致性稽核 — 發現紀錄

- **日期**：2026-10-29  
- **依據**：`docs/system-audit/PRODUCT_UX_AUDIT_PLAN.md`  
- **方法**：唯讀靜態程式碼審查（`reservation-frontend` 為主）；**未使用瀏覽器**，本文件凡屬視覺／互動結論均標為「未視覺驗證」或「需 runtime」。  
- **證據分級**：**已確認**（原始碼可見）、**假設**（合理推論）、**需 runtime**（須開啟應用程式操作）。

---

## 1. 路由清單（來源：`reservation-frontend/src/App.js`）

### 1.1 版面殼層（已確認）

| 殼層 | 觸發條件 | 原始碼 |
|------|----------|--------|
| 公開 Header + 頁尾 | `PublicLayout` 且 `isPublic`（非 `/login`、非 `/admin`） | `components/layout/PublicLayout.js` |
| 精簡 main（無 Header） | `/login` 或 `/admin/*` | 同上 `if (!isPublic)` |
| 後台 Sidebar + 頁首標題 | `/admin/*` 且 `localStorage.token` 存在 → `AdminLayout` | `App.js` L516–531、`AdminLayout.js` |
| 全站 Suspense 載入 | 幾乎所有 lazy 路由 | `App.js` L451、`RouteLoading.jsx` |
| 全站 Toast / Confirm / Alert | 根層 `ToastProvider` | `App.js` L700–705 |

`App.js` 另對非後台頁設定 `app-wrapper` 背景：一般公開頁為藍調漸層 + 暖色 `#fbfbfa`→`#f7f3ed`；Scroll World 相關草稿頁為 `#f7f9fc` / `#f5ede0`（L376–386）。

---

### 1.2 公開路由（Public）

**定義**：未包 `RequireStudentAuth`、路徑不在 `/admin` 下（含仍走 `PublicLayout` 但無 Header 的 `/login`）。

| Path | 元件 | 守衛 / 備註 |
|------|------|-------------|
| `/` | `HomePage` | 無 |
| `/hometest` | `HomeImmersiveTestPage` | 無 |
| `/events` | `EventsPage` | 無（預約流程在頁內，登入為流程內需求） |
| `/weekly/preview/:token` | `WeeklyPreviewPage` | **公開 token** |
| `/weekly`, `/weekly/:issueKey` | `WeeklyPage` | 無 |
| `/activities` | `ActivitiesPage` | 無 |
| `/practice/word-bridge` | `WordBridgePage` | 無（微學習） |
| `/practice/listening-ladder` | `ListeningLadderPage` | 無 |
| `/practice/vocabulary-depth` | `VocabularyDepthPage` | 無 |
| `/practice/vocabulary-size` | `VocabularySizePage` | 無 |
| `/practice/speaking-diagnostic` | `SpeakingDiagnosticPage` | 無 |
| `/practice/speaking-check` | `SpeakingCheckPage` | 無 |
| `/practice/speaking-host/login` | `SpeakingHostLoginPage` | **主持端登入**（非學生 JWT） |
| `/practice/speaking-host` | `SpeakingHostPage` | 需 runtime 確認是否依 host session 擋人 |
| `/guides/activity-phrasebook`, `…/:activityType` | `ActivityPhrasebookPage` | 無 |
| `/activities/english-table/topics` | `EnglishTableTopicsPage` | 無 |
| `/activities/:slug` | `ActivityDetailPage` | 無 |
| `/announcements`, `/announcements/:idOrSlug` | `AnnouncementsPage`, `AnnouncementDetailPage` | 無 |
| `/notifications` | `NotificationPage` | 無 |
| `/learning-resources` | `LearningResourcesPage` | 無 |
| `/regulations-forms` | `RegulationsFormsPage` | 無 |
| `/faq` | `FAQPage` | 無 |
| `/about` | `AboutPage` | 無 |
| `/campus-journey-draft` | `CampusJourneyDraftPage` | 無 |
| `/scroll-world-packs` | `ScrollWorldPacksPreviewPage` | 無 |
| `/course-guide` | `CourseGuidePage` | 無 |
| `/privacy`, `/terms` | `PrivacyPage`, `TermsPage` | 無 |
| `/403`, `/404` | `ForbiddenPage`, `NotFoundPage` | 無 |
| `/login` | `LoginPage` | **Staff JWT**（寫入 `localStorage.token`） |
| `/survey/choice` | `SurveyChoicePage` | 無 |
| `/survey/:surveyId` | `SurveyPage` | 無 |
| `/register/english-test/group` | `LearningPartnerRegistrationPage` | 無（學習有伴組隊） |
| `/register/english-test/group/status/:teamId` | `LearningPartnerStatusPage` | 無 |
| `/register/english-test/group/approve` | `LearningPartnerApprovePage` | **URL query `token`** |
| `/student/login` | `StudentLoginPage` | 無（入口） |
| `/student/forgot-password` | `StudentForgotPasswordPage` | 無 |
| `/student/register` | `StudentRegisterPage` | 無 |
| `/student/english-learning-passport` | `EnglishLearningPassportPage` | **Email OTP**（非 `RequireStudentAuth`） |
| `/student/english-learning-passport/submissions/:id` | `EnglishLearningPassportSubmissionPage` | **假設**：延續 ELP session／OTP 狀態 |
| `/student/english-learning-passport/certification` | `EnglishLearningPassportCertificationPage` | 同上 |

**Legacy redirect（公開群內）**

| Path | 目標 |
|------|------|
| `/activities/word-bridge` 等 4 條 | → `/practice/*` |
| `/scrollworldtest` | → `/` |
| `/contact` | → `/about#contact` |
| `/survey` | → `/survey/choice` |
| `/rules` | → `/faq` |

---

### 1.3 學生路由（Student）

**定義**：`/student/*` 個人資料、`/my-reservations`、培力個人報名等；守衛以 `RequireStudentAuth`（學生 JWT，`eears-student-token`）為主。

| Path | 元件 | 守衛 |
|------|------|------|
| `/my-reservations` | `MyReservationsPage` | **RequireStudentAuth** |
| `/register/english-test` | `EnglishTestRegistrationPage` | **RequireStudentAuth** |
| `/student/account` | `StudentAccountPage` | **RequireStudentAuth** |
| `/student/progress` | `StudentProgressPage` | **RequireStudentAuth** |
| `/student/speaking-portfolio` | `SpeakingPortfolioPage` | **RequireStudentAuth** |
| `/student/class-credit-allocation` | `ClassCreditAllocationPage` | **RequireStudentAuth** |

未登入時：`RequireStudentAuth` → `StudentAuthGate`（依 path 顯示不同標題／說明，導向 `/student/login?next=…`）— `components/student/RequireStudentAuth.jsx`、`StudentAuthGate.jsx`。

** intentionally 不列入「學生 JWT 群」**（計畫允許不同登入型態）：

- 英語學習護照全路徑：Email OTP + `ElpEmailVerificationPanel`（`components/englishLearningPassport/ElpEmailVerificationPanel.jsx`）。
- 微學習 `/practice/*`：匿名可玩；學號等身分為自願（`studentIdentityStorage.js` 用 `localStorage` 鍵 `eears-reservation-identity:v1`；`RegulationsFormsPage.js` 讀 `sessionStorage` 鍵 `eears-student-id` — **已確認** 儲存機制不一致，UX 影響需 runtime）。

---

### 1.4 管理路由（Admin）

**父路由**：`/admin` — 無 token 則 `<Navigate to="/login" />`（**Staff JWT gate**）。子路由在 `AdminLayout` 內；頁面級權限由 `getAdminRouteDeniedReason` → `AdminAccessDenied`（`AdminLayout.js` L89–92、L252–258）。

| Path（相對 `/admin`） | 元件 | 備註 |
|------------------------|------|------|
| `index` | `AdminRoleIndex` | 角色導向首屏 |
| `dashboard` | `AdminDashboardProduct` | |
| `operations` | `AdminHome` | 活動與預約 |
| `operations/:eventId` | `AdminEventDetailPage` | |
| `operations/:eventId/checkin-kiosk` | `AdminEventCheckinKioskPage` | kiosk 模式 |
| `operations/participation` | `AdminEventParticipationStatsPage` | |
| `classes`, `classes/:classId`, `classes/:classId/bestep` | 班級相關 | |
| `classes/credit-allocation` | `AdminClassCreditAllocationPage` | |
| `teachers/dashboard` | `TeacherDashboardPage` | |
| `violations` | `ViolationManagement` | |
| `survey-module`, `survey-module/:surveyId/responses|stats` | 問卷模組 | |
| `survey-center`, `survey-rules`, `survey-responses`, `survey-analytics`, `survey-health`, `survey-answer-mappings` | 問卷 IA | |
| `surveys` | `LegacyArchiveNotice` | 封存說明，非正式維運 |
| `announcements`, `announcements/new`, `announcements/:id/edit` | 公告 | |
| `weekly-reports`, `weekly-reports/:id/edit` | 週報 | |
| `student-content` | `StudentContentHubPage` | |
| `page-content` | `PageContentLegacyRedirect` | → `student-content?area=` |
| `logs` | `AdminAuditLogsPage` | |
| `settings/system`, `settings/event-types`, `settings/email-templates` | 設定 | |
| `diagnostics`, `ops-scripts`, `trip-counts`, `trip-counts/:tripId` | 維運 | |
| `english-test` | `EnglishTestManagement` | |
| `english-test/import` | `EnglishTestImportHubPage` | |
| `import-center`, `import-center/runs` | `ImportCenterPage`, `ImportRunHistoryPage` | 導覽非統一 API |
| `learning-journey`, `learning-journey/import`, `learning-journey/ewl-sync`, `learning-journey/operations`, `learning-journey/students/:studentId` | LJ v3 | |
| `speaking-diagnostic` | `SpeakingDiagnosticAdminPage` | |
| `learning-analytics/*` | `LearningAnalyticsLayout` 巢狀 | overview, kpi-report, cohorts, offerings, resources, skills, b1-plus, explore, tracking-cohorts, students, raw-data, settings 等 |
| `english-learning-passports`, `english-learning-passports/:id` | 護照後台 | |
| `analytics/overview`, `analytics/risk`, `reports` | 舊分析入口 | |
| `account`, `account/reset` | 帳號、強制重設密碼 | |
| `et-grouping/*` | 培力分組／帶班 | |

**Legacy redirect（管理群內，節選）**：`events`→`operations`；`english-tests*`、`english-test-v2*`、`learning-journey-center*`→`learning-journey`；`analytics/students`→`learning-journey`；`site-content`→`student-content`；等多條 — 皆 `AdminLegacyRedirect` 或 `Navigate`，並可 toast「網址已更新」（`AdminLayout.js` L79–87）。

**App 外層 legacy（仍掛路由）**

| Path | 行為 |
|------|------|
| `/admin/classes/:classId/detail` | `LegacyClassDetailRedirect`：**Staff token** + `getAdminRouteDeniedReason` → 導向 `/admin/classes/:classId` |

---

### 1.5 原始碼在、正式路由不在（已確認）

| 檔案 | 說明 |
|------|------|
| `pages/admin/LearningJourneyHubPage.jsx` | 未在 `App.js` import／掛載 |
| `pages/admin/SiteContentManagementPage.jsx` | 未在 `App.js` 掛載（內容維護走 `student-content`） |
| `pages/admin/PageContentManagementPage.jsx` | 僅被其他 admin 頁引用，非獨立 Route |

---

## 2. Design tokens 與硬編碼色（靜態）

### 2.1 設計系統（已確認）

- **主檔**：`reservation-frontend/src/styles/design-system.css`  
  - `--color-primary: #2a5d9f`、語意色 success/warning/danger、間距 `--spacing-*`、字級 `--font-size-*`、陰影、z-index 等（L5–96）。  
  - 註解明指：學生端主色；**後台**使用 `.admin-layout-root` 自有配色（L6）。

- **公開品牌對齊**：`styles/emi-brand.css` 將 `.public-site` 變數對齊 `#2a5d9f`（L1–40）。

- **後台暖色 sidebar**：`components/admin/adminLayout.css` — `--admin-rail: #e4ddd2`、`--admin-canvas: #fbfbfa`（L33–36、L241）— **已確認** 與 design-system 冷藍畫布並存（計畫：Bootstrap + 自建 CSS 並存本身非缺陷）。

### 2.2 重複硬編碼 `#2a5d9f`（已確認，節錄）

除 CSS 變數外，至少 **129+ 處** 字面量 `#2a5d9f`（ripgrep 統計），例如：

- `App.js` 漸層使用 `rgba(42, 93, 159, 0.05)`（等同主色）  
- `pages/AnnouncementsPage.css` L92  
- `components/english-test/registration/EnglishTestStep3FormBody.jsx` inline `style={{ color: '#2a5d9f' …}}`  
- `components/LearningPartnerApprovePage.js` inline 標題色  
- `components/learningAnalytics/learningAnalytics.css`  
- `styles/admin-operations.css`

**假設**：視覺上仍接近主色，但 inline 標題與 token 化頁面在 spacing／字重上可能不一致 — **需 runtime**。

### 2.3 暖色畫布與 design-system 文案差異（已確認）

- `design-system.css` 註解「避免暖米色範本感」，但 `App.js` 公開預設背景含 `#f7f3ed`（L385）；`HomeImmersiveTestPage.css`、`scrollWorldPacks` 等仍用 `#f5ede0`。  
- **不判為缺陷**：多為首頁／實驗頁 art direction；是否「像同一產品」**需 runtime**。

---

## 3. 版面、表格／篩選／Modal、Loading／空／錯／成功（程式證據）

### 3.1 版面密度（已確認）

| 區域 | 觀察 |
|------|------|
| 公開 | `PublicLayout` + `container`（非 full-bleed 頁）或 full-bleed 首頁／about | `PublicLayout.js` L44–54 |
| 後台 | Sidebar 280px + `admin-page-header` 標題／breadcrumb | `AdminLayout.js`、`adminLayout.css` |
| 學生紀錄 | `StudentRecordShell` 包 `/my-reservations`、`/student/progress` 等 | `MyReservationsPage.js` L53–54 |

**假設**：後台子模組（英檢、LJ、問卷）各自 page header 文案長度不一 — **需 runtime**。

### 3.2 表格與篩選（已確認）

- **無共用 `DataTable`**：全 repo 無 `DataTable` 符號（已確認）。各頁 Bootstrap `<Table>` 或自訂 markup。
- **Import Center** 明確寫「本頁只做導覽；實際上傳仍在各功能頁」（`ImportCenterPage.jsx` L37–39、`importCenterCards.js`）。
- **篩選是否可分享 URL**：因頁而異；`LearningAnalytics*` 等可能用 query — **需逐頁 runtime**（本次未完整掃描每個 `useSearchParams`）。

### 3.3 確認對話（已确认）

- **統一元件**：`ConfirmDialog` 僅由 `ToastProvider` 掛載；`useConfirm()` 為 promise API（`ToastProvider.jsx` L42–79、L156–166）。
- **並存 `window.confirm`**：至少 **30+ 檔**仍直接呼叫（例如 `LearningAnalyticsTrackingCohortsPage.jsx` L95、`EnglishLearningPassportPage.jsx`、`EnglishTestFormBuilderTab.jsx` 等）。  
- **影響（需 runtime）**：鍵盤焦點、樣式、與 toast 流程是否一致。

### 3.4 Loading / Empty / Error / Success（已确认，對照）

| 模式 | 範例 | 檔案 |
|------|------|------|
| 路由 lazy 載入 | `RouteLoading` + Bootstrap `Spinner` | `App.js` L451、`RouteLoading.jsx` |
| 共用空狀態 | `EmptyState` | `components/ui/EmptyState.js` — `AnnouncementsPage.js`、`SurveyChoicePage.js`、`NotificationPage.js` |
| 區域 Spinner | 文字 `載入中…` / 無文案 | `AdminSurveyResponsesPage.js`、`LearningAnalyticsStudentDetailPage.jsx` |
| 預約錯誤 | 頁內 `Alert` + `setMsg`；409 問卷導向 | `useEventBooking.js` L154–219 |
| 429/503 英文括號補充 | 「Too many requests…」「System busy…」 | `useEventBooking.js` L196–209 |
| 全站 toast | `eears:toast` 事件、權限 stale | `App.js` L288–317、`ToastProvider.jsx` |
| 我的預約成功 | 頁內 `ToastMessage`（非全站 stack） | `MyReservationsPage.js` L9–16 |
| ELP 錯誤 | `Alert` + `setError` | `EnglishLearningPassportPage.jsx` |
| 學習有伴 approve | `error` state 文字 | `LearningPartnerApprovePage.js` L31–40 |

**跨模組觀察（已确认）**：同一「操作失敗」有的僅中文、有的中英並列（預約 busy 類）— 是否混淆使用者 **需 runtime**。

### 3.5 Modal（已确认片段）

- 活動預約：FullCalendar + modal 模式 — 前端規則 `ui-accessibility.mdc` 要求保留；實作分散在 events 元件（本次未逐行開 modal 元件）。
- `ConfirmDialog` / `AlertDialog` 為全站 modal 類確認。

---

## 4. 雙語／術語抽樣（grep 實際命中）

| 概念 | 實際用語範例 | 檔案 |
|------|----------------|------|
| 培力英檢 vs 英檢 | Header「培力英檢(考試報名)」；後台「培力英檢管理」；Import「英檢成績匯入（學習歷程）」vs「培力英檢（BESTEP）資料匯入」 | `constants/translations.js` L30–31；`adminNavigation.js` L392；`importCenterCards.js` L131–226 |
| 預約 vs 報名 | 「預約場次」「我的預約」vs「培力英檢報名」、問卷「預約前必填」 | `translations.js` L19–20、L74–83；`surveyAdminUx.js` L113–115 |
| 學習歷程 / LJ | 「學習歷程中心（舊網址）」redirect；about 文案「學習歷程」 | `App.js` redirect labels；`translations.js` L952 |
| CEFR vs GSE | LVA：「CEFR 達 B2」；B1+ 頁：「聽力前測 GSE 還不到 51」；活動分組：「GSE 能力量尺（與 LVA 一致），非官方英檢成績」 | `LearningAnalyticsOverviewPage.jsx` L264–274；`LearningAnalyticsB1PlusPage.jsx` L47；`AdminEventGroupingTab.jsx` L526 |

**故意不同（非缺陷，已确认）**：CEFR 用於達標／等級分布；GSE 用於接近 B2、分組建議與 LVA 對齊 — 與 `PRODUCT_UX_AUDIT_PLAN.md` 及 `eears-learning-analytics` 一致。

**英文出現在學生向錯誤**：`useEventBooking.js` 429/503 訊息含英文 — **已确认**。

---

## 5. 跨模組流程（程式斷點）

### 5.1 預約活動（已确认）

1. 列表／日曆 → `EventsPage` / booking hook。  
2. 後端 409 + `code` `ENGLISH_*_SURVEY_REQUIRED` / `SURVEY_REQUIRED` → 前端 `savePendingReservation` + `navigate(surveyPath)`（`useEventBooking.js` L156–194）。  
3. 黑名單／違規提示在同 hook 前段（L140–143）。  
4. **需 runtime**：登入前是否可填表單、409 的 `redirectUrl` 與後端契約是否完全一致、問卷填完是否自動回到 pending 預約。

### 5.2 取消預約（已确认）

- `/my-reservations` + `RequireStudentAuth`；`StudentAuthGate` 說明取消需「預約信驗證碼」（L8–9）。  
- `useReservationLookup` + `cancellationCode`（`MyReservationsPage.js`）。  
- **需 runtime**：未登入舊流程是否已完全移除。

### 5.3 問卷（已确认）

- 公開：`/survey/:surveyId`、`/survey/choice`。  
- Gate 規則文案：`constants/surveyAdminUx.js`（ET/EC 擋預約 vs PUBLIC 不擋）。  
- 完成度檢查 API：`services/surveyPublicApi.js` — `GET /api/surveys/check/${surveyId}/${studentId}`（**已确认** 路徑形狀）；非所有問卷是否都走同一 check — **假設** 需對照 `SurveyPage` 實作。

### 5.4 培力報名（已确认）

- 個人：`/register/english-test` + **RequireStudentAuth**；公開 layout 標題「培力英檢報名」（`RegistrationPageLayout.jsx` L40）。  
- 學習有伴：`/register/english-test/group*` 無學生 JWT；approve 用 **token** query。  
- Header 依設定顯示「考試報名」或「資料修正」（`Header.js` L46–65）。

### 5.5 英語學習護照 ELP（已确认）

- 路由無 `RequireStudentAuth`；`ElpEmailVerificationPanel` 送驗證碼／驗證（OTP）。  
- 與「我的紀錄」`/student/progress`（學生 JWT）為不同身分模型 — **符合計畫「不列為不一致」**。

### 5.6 微學習（已确认）

- `/practice/*` 公開；身分 `studentIdentityStorage`（localStorage）與 regulations 頁 `sessionStorage` 鍵名不同（見 §1.3）。  
- **需 runtime**：UI 是否說明練習分數不進正式歷程。

### 5.7 後台匯入（已确认）

- `ImportCenterPage` 卡片說明區分「學期人口」「英檢報名在學名單」「培力 BESTEP」「英檢成績 LJ」— `importCenterCards.js`。  
- **UX 風險（假設）**：使用者以為在 Import Center 上傳一次即全站生效 — 文案已試圖緩解；是否足夠 **需 runtime 使用者測試**。

### 5.8 導覽 vs 路由權限（已确认）

- 選單：`constants/adminNavigation.js`（可見性 `isNavItemVisible`）。  
- 進頁：`getAdminRouteDeniedReason`（`adminRouteAccess.js`）。  
- **已确认**：兩者可能不一致（計畫 L51–52）；**需 runtime** 驗證「看得到但進不去」時的提示是否清楚（`AdminAccessDenied.jsx`）。

---

## 6. 瀏覽器驗證待辦（本輪均未視覺驗證）

除非註明，下列皆 **NOT visually verified**。

| 優先 | Route | 建議操作 | 要驗什麼 |
|------|-------|----------|----------|
| P0 | `/events` | 選一場 ET/EC → 嘗試預約（未填問卷帳號） | 409 導向問卷、pending 恢復、截止／黑名單文案 |
| P0 | `/my-reservations` | 未登入直接開 URL → 登入 → 取消一筆 | `StudentAuthGate` 文案、驗證碼欄、toast vs alert |
| P0 | `/student/login?next=/register/english-test` | 登入後完成報名一步 | RequireStudentAuth 與表單欄位是否預填學號 |
| P0 | `/admin/operations` | staff 登入 → 開一活動 → 篩選／分頁 | 表格密度、loading、destroy confirm 用哪種 dialog |
| P1 | `/survey/choice` → 任一問卷 | 提交成功／必填漏填 | 錯誤是否在欄位旁 |
| P1 | `/register/english-test/group/approve?token=…` | 無效 token、過期 token | 錯誤空狀態 |
| P1 | `/student/english-learning-passport` | OTP 流程 | 與 `/student/progress` 登入差異是否易懂 |
| P1 | `/practice/word-bridge` | 不登入玩一局 → 再看 progress | 資料是否隔離、文案說明 |
| P1 | `/admin/import-center` | 讀卡片 → 點「下一步」到子頁 | 是否誤以為統一上傳 |
| P1 | `/admin/learning-analytics/overview` vs `b1-plus` | 並讀 CEFR 與 GSE 標籤 | 語意區分是否對一般 admin 清楚（非缺陷，驗證理解） |
| P2 | `/` @360px / 1280px | 首頁週報 banner（手機） | 與桌面 immersive 差異 |
| P2 | `/admin/operations/:id/checkin-kiosk` | kiosk | 是否隱藏 sidebar、觸控 |
| P2 | 任一路徑 | Tab 順序、Esc 關 modal、200% zoom | a11y（計畫 § 無障礙） |
| P2 | 無權限帳號 | 側欄有連結但 direct URL | `AdminAccessDenied` |

---

## 7. 高訊號發現摘要（含路徑）

1. **守衛模型刻意分裂（已确认，非缺陷）**：學生 JWT（`RequireStudentAuth`）、Staff JWT（`/admin`）、ELP Email OTP、學習有伴 URL token、週報 preview token — 入口與文案需靠 runtime 確認使用者是否理解。  
2. **確認 UI 雙軌（已确认）**：`useConfirm`/`ConfirmDialog` 與大量 `window.confirm` 並存 — 破壞性操作體驗可能不一致（`ToastProvider.jsx` vs 多個 admin/student 頁）。  
3. **無共用 DataTable（已确认）**：列表／篩選／空狀態各模組自實作 — 同類型後台頁感受可能不同。  
4. **Loading／空狀態不統一（已确认）**：`EmptyState` vs 裸 `Spinner` vs 無指示 — 見 §3.4 檔案列表。  
5. **主色 token 與硬編碼並存（已确认）**：`design-system.css` / `emi-brand.css` vs 129+ 處 `#2a5d9f` 与 `App.js` 暖色背景 — 視覺一致性 **未視覺驗證**。  
6. **預約失敗訊息中英混用（已确认）**：`useEventBooking.js` 429/503。  
7. **Import Center 為導覽（已确认）**：`ImportCenterPage.jsx`、`importCenterCards.js` — 與各模組上傳頁的 mental model **需 runtime**。  
8. **孤兒頁（已确认）**：`LearningJourneyHubPage.jsx` 等未掛 `App.js` — 避免誤當正式入口。  
9. **CEFR/GSE 並存（已确认，故意）**：LVA／分組／B1+ 文案分工明確 — 見 §4。  
10. **Header 任務導覽（已确认）**：「我的紀錄」含 `/my-reservations` 等 matchPaths，但 ELP／護照不在 Header 捷徑 — **假設** 探索路徑較深，需 runtime。

---

## 8. 本輪限制

- 未修改任何 UI、路由、樣式或應用程式原始碼（僅新增本文件）。  
- 未使用 production 學生資料。  
- 未做瀏覽器抽樣；§6 待辦為後續視覺驗證清單。  
- 未重寫 `PRODUCT_UX_AUDIT_PLAN.md`；未提出大規模 redesign。
