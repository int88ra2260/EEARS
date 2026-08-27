# EEARS 管理後台 UX Audit

- **測試日期**：2026-08-17
- **測試環境**：程式碼盤點為主（`reservation-frontend` 管理端 `/admin/*`）；對照學生端正式站實測方法（`docs/UX-AUDIT.md`）
- **測試方式**：以 Phase 2 側欄 IA、路由表、關鍵頁面元件為主做結構化 review；**本輪未以各角色帳號在正式站逐頁點擊**（需後續補 browser walkthrough）
- **本輪範圍**：管理後台資訊架構、導覽、角色落地、命名一致性、空狀態／回饋缺口。**未修改任何 UI 程式碼。**
- **對照文件**：學生端盤點見 [`docs/UX-AUDIT.md`](./UX-AUDIT.md)

核心判斷：

> EEARS 後台已完成 Phase 2 側欄重組，但仍是「依資料模組分類的功能目錄」，還不夠像「依角色與今日任務完成工作」。

---

## 測試方法與限制

### 做了什麼

- 盤點 `adminNavigation.js` 全側欄結構（10 個頂層區段、30+ 可見子項）與 `adminRouteAccess.js` 權限對照
- 追蹤 `App.js` 內 15+ 條 legacy redirect 與 `hiddenFromNav` 隱藏項
- 閱讀關鍵頁：營運總覽、活動列表／明細、違規、Import Center、LJ V3、學習成效分析、問卷中心、登入落地
- 分析 6 種 persona 的可見選單與 landing path
- 對照學生端 audit 的章節格式（Friction List、Journey、Quick Wins、Page-by-page）

### 刻意沒做的事

- **未在正式站以 admin／teacher／leader／worker 等帳號實際登入操作**（避免需要正式憑證、也避免誤改正式資料）
- 未逐頁跑 Playwright（學生端有 `.tmp-ux-audit/` 腳本，後台尚未建立對應腳本）
- 未覆蓋每個 admin 子頁的 loading／error 邊界（僅抽樣高流量頁）

### 建議補測（下一輪）

| Persona | 建議 Task |
|---------|-----------|
| 系統管理員 | 登入 → 看今日 KPI → 找一場活動 → 看預約／簽到 → 查一位學生 LJ |
| 活動行政 | 登入 → 新增活動 → 活動明細匯入名單 → 登記違規 |
| 一般老師 | 登入 → 班級概況 → 教學儀表板 |
| ET Leader | 登入 → 我的帶班場次 → 進活動明細勾任務 |
| 工讀生 | 登入 → 側欄看到什麼 → 簽到／違規能否完成 |
| 培力英檢行政 | Import Center → BESTEP 匯入 → 英檢待審 |

---

## Think-Aloud 摘要（依 persona 推測）

### Persona A｜第一次進後台的活動行政

「主管給我帳號，要我管這學期 English Table。」

- 登入後若為 `office_staff`，會直接到 `/admin/operations`（活動列表）——這點合理。
- 側欄「活動與預約」底下有 7–8 個子項：活動列表、簽到統計、ET 分組四頁、合規與違規。我會猶豫：**簽到是在活動列表還是活動明細？違規又要去另一頁？**
- 找不到「今天要處理什麼」的待辦清單；營運總覽在側欄最底「系統與稽核」，而且 event_lead 可能根本看不到。
- 結論：找得到活動列表，但**日常流程（建立 → 預約 → 簽到 → 違規）被拆成多個同層入口**，沒有任務導引。

### Persona B｜想查某學生英語程度的行政

「學生來問 B2，我要在系統裡查。」

- 側欄至少有三條路：**英語學習歷程中心**、**學習成效分析**（9 個子 tab）、**分析與報表 → 學生學習歷程查詢**。
- 註解寫 legacy 查詢應改用 LJ Student Table，但側欄仍保留「學生學習歷程查詢」——我會點錯、或以為是不同資料。
- 進 LJ dashboard 後看到 `Breakdown`、`Student Table` 英文標題，和側欄中文不一致。
- 結論：**同一個問題（這學生怎樣）有多個入口，且命名分裂**。

### Persona C｜ET Leader（帶班學生）

「我是 Leader，只要看我這學期的 ET 場次、勾任務。」

- 登入走 `/admin` → 被 redirect 到 `/admin/et-grouping/my-sessions`（多一跳；LoginPage 未直達）。
- 側欄理論上極精簡，只有「我的帶班場次」等少數項——若權限設定正確，體驗可接受。
- **若誤點無權限頁**，「返回後台首頁」連到 `/admin/dashboard`，Leader 無 dashboard 權限 → **再次看到拒絕頁（死路）**。
- 從 my-sessions 進活動明細可用 `?tab=taskMarks`，但 breadcrumb 只寫「活動明細」，沒有場次名稱。
- 結論：主流程可完成，但**錯誤恢復路徑會把 Leader 困住**。

### Persona D｜工讀生（現場簽到）

「我只負責簽到和登記違規。」

- 文件／註解寫 worker 側欄應「只保留營運總覽」，但 `isWorkerRestrictedMenu` **從未被 `filterVisibleNav` 呼叫**。
- 實際 worker 若 permissionSet 含 events／violations，側欄仍可能看到「活動與預約」「合規與違規」——與 onboarding 文件不一致。
- 違規頁成功訊息用 `showErrorMessage('違規登記成功！')`，視覺上像失敗。
- 結論：**角色預期與 UI 不一致**；現場操作回饋會製造焦慮。

### Persona E｜系統管理員（維運＋設定）

「我要確認系統健康、處理英檢待審、改問卷規則。」

- 營運總覽 KPI 卡片有診斷 tooltip、錯誤可連 audit logs——**維運向 UX 明顯優於其他頁**。
- 但「系統設定」在 dashboard 右上角 CTA 與側欄「系統與稽核」重複；學習／問卷／匯入分散在四個區段。
- Legacy URL（`english-test-tracking`、`learning-journey-center`）仍會 redirect，舊 SOP 書籤能進，但**使用者不知道現在正式叫什麼**。
- 結論：功能齊全，但**認知地圖太大**，新人訓練成本高。

---

## A. Executive Summary

### 現在最大的 5 個 UX 問題

1. **學習資料入口分裂。** 「英語學習歷程中心」「學習成效分析（9 tab）」「分析與報表 → 學生學習歷程查詢」都在回答「學生學得怎樣」，且 LJ 內又嵌 analytics panel，與 LA 模組重疊。
2. **側欄是模組目錄，不是任務地圖。** Phase 2 已排序（營運→英檢→匯入→分析…），但 admin 全權仍見 30+ 子項；ET 分組四頁與違規混在「活動與預約」同一群。
3. **Legacy 與 hiddenFromNav 造成隱形地圖。** `App.js` 15+ redirect；BESTEP／LJ 匯入 `hiddenFromNav: true` 仍可直接打 URL；問卷三軌（center / module / legacy 封存）並存。
4. **角色落地與錯誤恢復不一致。** Leader 無 dashboard 但 AccessDenied CTA 指向 dashboard；worker 側欄縮限函式未接線；LoginPage 未處理 leader 直達 my-sessions。
5. **頁首層級重複、回饋品質參差。** AdminLayout 已有 pageTitle + breadcrumb，LA／LJ／Import Center 再加 `<h1>`／`<h4>`；違規管理 empty 無 CTA、成功訊息誤用 error 樣式。

### 哪些最影響管理員

- **找不到或點錯學生資料入口**（問題 1）——英檢行政、老師、活動負責人都會浪費時間。
- **活動營運流程分散**（問題 2）——簽到、違規、參與統計不在同一心智路徑。
- **Leader／worker 錯誤恢復死路**（問題 4）——少數角色但現場關鍵，卡住會直接打電話問 IT。

### 哪些最值得優先處理

1. 收斂學習資料入口（移除或合併 legacy「學生學習歷程查詢」側欄項；對外說明 LJ vs LA 分工）。
2. Role-aware home + AccessDenied CTA（leader → my-sessions；teacher → classes）。
3. 實作或刪除 worker 側欄縮限（`isWorkerRestrictedMenu` 接線或更新文件）。
4. 違規管理：成功 toast、responsive table、empty CTA。
5. 統一頁首（子 layout 不再重複 h1；breadcrumb 群組可點、活動明細帶名稱）。

---

## B. UX Friction List

依嚴重程度排序。

### Critical

#### ADMIN-UX-001

- **頁面**：學習資料多入口（`/admin/learning-journey`、`/admin/learning-analytics/*`、`/admin/analytics/students`）
- **使用者目標**：查某位學生的英語程度／學習紀錄
- **原本預期**：一個「查學生」入口，輸入學號就看到 canonical 資料
- **實際發生**：側欄三區塊皆可進；legacy 查詢 redirect 到 LJ V3 profile；LJ dashboard 又有 KPI + breakdown + Student Table + 內嵌 analytics panel；LA 另有 9 個分析 tab
- **問題**：同一資料域多套 UI；註解已寫 legacy 應改用 Student Table，但 nav 未收斂
- **類型**：Information Architecture、Discoverability、Cognitive Load
- **嚴重程度**：Critical
- **影響**：訓練成本高；書籤與口耳相傳的 URL 不一致；不同角色報告不同數字時難以對帳
- **改善建議**：
  - 對外只留兩句話：**英語學習歷程中心**＝操作（查學生、學期 KPI、匯入後確認）；**學習成效分析**＝研究／報表（群體、模型、raw data）
  - 移除側欄「學生學習歷程查詢」，改在 LJ Student Table 放明顯「依學號搜尋」
  - LJ 內 `Breakdown`／`Student Table` 改中文或雙語
- **建議修改範圍**：Navigation、Copy、Information Architecture

#### ADMIN-UX-002

- **頁面**：Worker 側欄（全站）
- **使用者目標**：工讀生只看到該做的事（簽到／總覽）
- **原本預期**：註解寫「側欄只保留營運總覽」
- **實際發生**：`isWorkerRestrictedMenu` 已定義但 `filterVisibleNav` 未使用；worker 仍可能見活動、違規等（依 permissionSet）
- **問題**：文件與 UI 不一致；過度曝光功能
- **類型**：Information Architecture、Error Prevention
- **嚴重程度**：Critical（對 worker onboarding）
- **影響**：工讀生進入不該操作的頁面；資安／營運風險
- **改善建議**：在 `filterVisibleNav` 對 worker 只留 dashboard + 必要 leaf；或更新所有文件承認 worker 權限模型
- **建議修改範圍**：Navigation、Backend permission 對照（若 intentional 擴權）

#### ADMIN-UX-003

- **頁面**：Legacy 路由（`App.js` redirect 區塊）
- **使用者目標**：用舊 SOP 書籤或訓練教材進入功能
- **原本預期**：redirect 後到 equivalent 功能
- **實際發生**：`english-test-tracking*`、`learning-journey-center*`、`english-test-v2*` 等皆 → `/admin/learning-journey`；`/admin/events` → `/admin/operations`；`/admin/surveys` → 封存提示頁
- **問題**：能進，但無「你已從舊網址進來，正式入口是…」的一次性說明
- **類型**：Consistency、Discoverability
- **嚴重程度**：Critical（對維運／培訓）
- **影響**：口頭說「英檢追蹤」與 UI 上「英語學習歷程中心」對不上
- **改善建議**：redirect 加 `?migrated=1` + 一次性 toast；內部文件統一用 Phase 2 路徑
- **建議修改範圍**：Routing、Copy、Interaction

### High

#### ADMIN-UX-004

- **頁面**：登入落地（`LoginPage.js`）+ `AdminLayout.js` redirect
- **使用者目標**：登入後立刻到工作起點
- **原本預期**：依角色一鍵到對的頁
- **實際發生**：
  - `teacher`（非 executive）→ `/admin/classes` ✓
  - `office_staff` → `/admin/operations` ✓
  - `leader` → `/admin` 再 redirect `my-sessions`（多一跳）
  - `admin`／`worker` → `/admin` dashboard
  - LoginPage **未**處理 `leader` 特例
- **問題**：Leader 多一次 redirect；executive teacher 與 admin 同走 dashboard
- **類型**：Interaction、Cognitive Load
- **嚴重程度**：High
- **改善建議**：LoginPage 依 role 直達：`leader` → my-sessions；`worker` → dashboard
- **建議修改範圍**：Interaction

#### ADMIN-UX-005

- **頁面**：`AdminAccessDenied.jsx`
- **使用者目標**：無權限時回到可工作的地方
- **原本預期**：「返回首頁」到該角色有權的 home
- **實際發生**：CTA 固定 `to="/admin/dashboard"`；ET Leader 無 dashboard 權限 → 二次拒絕
- **問題**：Dead-end UX
- **類型**：Dead-end UX、Error Prevention
- **嚴重程度**：High（Leader）
- **改善建議**：依 `accessProfile.role` 導向 role-aware home（leader → my-sessions；teacher → classes；預設 dashboard）
- **建議修改範圍**：Component

#### ADMIN-UX-006

- **頁面**：全站 breadcrumb（`AdminBreadcrumbs.jsx`）
- **使用者目標**：知道自己在哪、能往上層回去
- **原本預期**：後台 → 群組 → 目前頁；群組可點
- **實際發生**：只有「後台」可點到 `/admin`；群組名（如「活動與預約」）純文字；活動明細無 event 名稱
- **問題**：深層頁位置感弱
- **類型**：Navigation、Information Architecture
- **嚴重程度**：High
- **改善建議**：群組連到該區第一個 leaf 或 hub；`/admin/operations/:id` breadcrumb 第三段帶活動名
- **建議修改範圍**：Navigation、Component

#### ADMIN-UX-007

- **頁面**：子 layout 頁首（`AdminLayout` + `LearningAnalyticsLayout` + `LearningJourneyDashboardPage` + `ImportCenterPage`）
- **使用者目標**：一眼知道這是哪一頁
- **原本預期**：一個主標題
- **實際發生**：Layout 有 `admin-page-header__title`（來自 nav meta）；子頁再加 `<h1>`／`<h4>`，文案不完全一致（nav「中心成效總覽」vs layout「英語學習成效分析」）
- **問題**：雙重標題、小螢幕垂直空間浪費
- **類型**：Visual Hierarchy、Consistency
- **嚴重程度**：High
- **改善建議**：子 layout 只保留 subtitle／說明，主標題由 AdminLayout 統一；或 LA 關閉 layout 層 h1
- **建議修改範圍**：Layout

#### ADMIN-UX-008

- **頁面**：側欄（`AdminSidebar.jsx`）
- **使用者目標**：快速找到功能
- **原本預期**：常用項可見或可搜
- **實際發生**：預設**全部收合**，只自動展開目前路由區段；「活動與預約」8 子項；無搜尋、無釘選
- **問題**：新使用者不知道系統有多大；每次要逐段展開
- **類型**：Discoverability、Cognitive Load
- **嚴重程度**：High
- **改善建議**：首次登入展開「你的角色常用區段」；或加 cmd-k／側欄搜尋；admin 可選「全部展開」
- **建議修改範圍**：Interaction、Navigation

### Medium

#### ADMIN-UX-009

- **頁面**：`/admin/violations`（`ViolationManagement.js`）
- **使用者目標**：登記／查詢違規
- **原本預期**：成功有綠色確認；空狀態教下一步
- **實際發生**：成功用 `showErrorMessage`；empty 僅「無紀錄」；`<table>` 無 responsive wrapper（對比活動列表有 `admin-operations__table-wrap`）
- **類型**：Feedback、Mobile UX、Empty state
- **嚴重程度**：Medium
- **改善建議**：成功 toast；empty 加「從活動明細登記違規」連結；表格包 responsive
- **建議修改範圍**：Component、Copy

#### ADMIN-UX-010

- **頁面**：`/admin/import-center`
- **使用者目標**：找到正確匯入入口
- **原本預期**：上傳就在這頁
- **實際發生**：頁面明說「原頁操作」——卡片只導向各功能頁；多角色 denied Import Center；hidden nav 的 BESTEP／LJ 匯入仍可能從舊 URL 進
- **類型**：Cognitive Load、Information Architecture
- **嚴重程度**：Medium
- **改善建議**：卡片文案寫清「下一步會去哪一頁上傳」；denied 角色不要顯示空 hub（整段隱藏）
- **建議修改範圍**：Copy、Navigation

#### ADMIN-UX-011

- **頁面**：問卷（`/admin/survey-center`、`/admin/survey-rules`、`/admin/surveys` legacy）
- **使用者目標**：建立問卷、設定 ET/EC gate
- **原本預期**：一條問卷工作流
- **實際發生**：center + rules + health + mappings 四項；`survey-module` hidden；`/admin/surveys` 封存卡；`SurveyManagement.js` 仍存在但路由已換
- **類型**：Information Architecture、Consistency
- **嚴重程度**：Medium
- **改善建議**：側欄加一句群組說明「建立 → 啟用規則 → 維運」；legacy 封存頁連到 center 的文案已 OK，可維持
- **建議修改範圍**：Copy、Navigation

#### ADMIN-UX-012

- **頁面**：命名（多處）
- **使用者目標**：讀懂中英文混雜標籤
- **原本預期**：全中文或一致雙語
- **實際發生**：LJ 頁內 `Breakdown`、`Student Table`；route access label「Survey Data Health」「Audit Logs」；角色 badge「ET Leader」
- **類型**：Content / Copywriting、Consistency
- **嚴重程度**：Medium
- **改善建議**：對外中文優先；必要縮寫加 tooltip（ET、B2、LJ V3）
- **建議修改範圍**：Copy

#### ADMIN-UX-013

- **頁面**：`/admin/et-grouping/my-sessions`
- **使用者目標**：Leader 看指派場次
- **原本預期**：無場次時知道找誰
- **實際發生**：有 Alert「尚無被指派…」；無「聯絡 ET 負責人」類 CTA
- **類型**：Empty state、Dead-end UX
- **嚴重程度**：Medium
- **改善建議**：empty 加說明「場次由 ET 負責人指派 Leader」+ 聯絡方式或連結（若可公開）
- **建議修改範圍**：Copy、Component

### Low

#### ADMIN-UX-014

- **頁面**：`/login`
- **使用者目標**：管理員登入（學生誤入）
- **原本預期**：學生端 audit 已建議加「學生無需登入」
- **實際發生**：僅「後台登入」標題，無品牌、無學生導流
- **類型**：Error Prevention、Content
- **嚴重程度**：Low（與學生端 UX-014 相同）
- **改善建議**：加連結回首頁／預約場次
- **建議修改範圍**：Copy、Layout

#### ADMIN-UX-015

- **頁面**：營運總覽 quick links（`AdminDashboardProduct.jsx`）
- **使用者目標**：從 dashboard 去常用功能
- **原本預期**：連到 Phase 2 正式入口
- **實際發生**：部分 legacy 連結仍存在於舊 `AdminDashboard.jsx`（未掛路由）；Product 版 quick links 較新，但「問卷管理」若指 `/admin/surveys` 會到封存頁
- **類型**：Consistency
- **嚴重程度**：Low–Medium
- **改善建議**：quick links 只指 survey-center、operations 等正式路徑
- **建議修改範圍**：Navigation

#### ADMIN-UX-016

- **頁面**：LA 子 nav（9 tabs）
- **使用者目標**：手機上切換分析視圖
- **原本預期**：可橫向捲動或收合
- **實際發生**：`la-subnav` 多 tab；需實機確認 overflow（程式有獨立 CSS，未實測）
- **類型**：Mobile UX
- **嚴重程度**：Low（待 browser 確認）
- **改善建議**：小螢幕改 dropdown 或「更多」
- **建議修改範圍**：Layout

---

## C. User Journey（管理員）

```
Login
    ↓  friction: 無品牌；leader 多一跳；mustResetPassword 強制改密（合理但擋工作）
Role landing
    ↓  friction: worker 側欄可能過寬；event_lead 無 dashboard
Understand today's work
    ↓  friction: dashboard KPI 偏維運，非「待簽到場次／待審英檢／待處理違規」待辦
Find module (sidebar)
    ↓  friction: 預設全收合；30+ 子項；學習資料多入口
Do task (events / check-in / violation / import / survey)
    ↓  friction: 簽到在活動明細、違規在獨立頁、參與統計又在第三頁
Look up student
    ↓  friction: LJ vs LA vs legacy 查詢；英文區塊標題
Export / report
    ↓  friction: 報表下載 vs LA raw data vs ET 報表 分散
Settings / audit
    ↓  friction: 系統與稽核在側欄最底
Error / no permission
    ↓  friction: Leader AccessDenied → dashboard 死路
```

### Dead-end UX 清單（「然後呢？」）

| 位置 | 使用者心理 | 建議 Next Action |
|------|------------|------------------|
| AccessDenied（Leader） | 我壞了嗎？ | 回「我的帶班場次」 |
| 違規列表空 | 要怎麼登記？ | 連活動列表／活動明細說明 |
| Leader 無指派場次 | 誰幫我派？ | 聯絡 ET 負責人說明 |
| Import Center 全灰 | 我不能匯入？ | 說明缺哪個權限、找誰開 |
| Legacy `/admin/surveys` | 問卷壞了？ | 已有封存卡 → survey-center ✓ |
| LJ 無該學期資料 | 匯入了嗎？ | 連 Import Center／匯入紀錄 |
| 問卷 health 異常 | 要修哪？ | 連 answer mappings／rules |

---

## D. Quick Wins（低工程成本 + 高 UX）

1. **AccessDenied role-aware CTA**（XS）：Leader／teacher 回各自 home。
2. **ViolationManagement 成功訊息改 success toast**（XS）。
3. **LJ 頁內 `Breakdown`／`Student Table` 中文化**（XS）。
4. **LoginPage leader 直達 my-sessions**（XS）。
5. **移除或隱藏側欄「學生學習歷程查詢」**（S）：保留 redirect 即可。
6. **違規 empty state + 連活動列表**（S）。
7. **Dashboard quick links 對齊 Phase 2 路徑**（XS）。
8. **Redirect 一次性 toast「此網址已更新為…」**（S）。
9. **Worker：`filterVisibleNav` 接 `isWorkerRestrictedMenu`**（S）或更新文件。
10. **登入頁學生導流一句話**（XS，與學生端 UX-014 同步）。

---

## E. Structural Improvements

### Information Architecture（現況）

```
EEARS 後台（Phase 2 側欄）
├─ 活動與預約
│   ├─ 活動列表 (/operations)
│   ├─ 簽到參與統計
│   ├─ ET 分組（設定／模板／報表／學生趨勢）
│   ├─ 我的帶班場次（Leader）
│   └─ 合規與違規
├─ 班級與參與
├─ 英檢與培力（護照／培力英檢／LJ 中心 + hidden 匯入）
├─ 問卷與回饋（center／rules／health／mappings + hidden legacy）
├─ 資料匯入中心（hub，多角色 denied）
├─ 學習成效分析（9 子 tab）
├─ 分析與報表（legacy 學生查詢／行政總覽／風險／趨勢／報表／教學儀表板）
├─ 公告／週報／學生端內容
├─ 帳號與權限
└─ 系統與稽核（營運總覽在子項最底）
```

### 建議（依角色任務）

```
Recommended Admin IA（概念）
├─ 今日工作（role-based home）
│   ├─ 待簽到場次 / 待審項目 / 我的班級（動態）
│   └─ 快捷：新增活動、登記違規
├─ 活動營運
│   ├─ 活動列表 → 明細（預約／簽到／違規 tab 合一心智）
│   └─ 參與統計
├─ 學生資料（單一入口）
│   ├─ 查學生（LJ V3 canonical）
│   └─ 進階分析（LA，次要）
├─ 英檢與培力（報名／護照／BESTEP）
├─ 問卷（建立 → 規則 → 維運）
├─ 匯入與紀錄
├─ 內容與公告
└─ 系統（設定／稽核／診斷）
```

原則：UI 跟後端 router 模組不必 1:1；**同一學生資料只對外一個 canonical 查詢入口**。

### Navigation

- 營運總覽對 admin 應更靠近頂部或作為 `/admin` 預設，而非埋在「系統與稽核」最底。
- ET 分組四頁可收為「ET 分組」子 hub，避免與「活動列表」同層平鋪 8 項。
- Import Center：無任何可用卡片時整段隱藏，不要空 hub。

### Dashboard

`AdminDashboardProduct` KPI 設計偏維運（含 API 診斷）——適合 admin。建議加 **role-based 待辦 strip**：例如今日場次、待審英檢、草稿公告（資料已有，缺聚合呈現）。

---

## F. Page-by-page Audit（摘要）

### 營運總覽 `/admin/dashboard`

- **User Goal**：一眼看系統是否正常、今天多少預約
- **What Works**：KPI 有 loading／empty／error；tooltip 診斷、錯誤可連 logs；`kpiAllEmpty` 有 CTA
- **Friction**：非 admin 可能看不到；quick links 需對齊 Phase 2；標題在 layout 與內容重複
- **Severity**：Medium
- **Recommendation**：加 role 待辦；event_lead 可給精簡版「今日活動」widget

### 活動列表 `/admin/operations`

- **User Goal**：找場次、新增、進明細
- **What Works**：filter、responsive table wrap、與 `/admin/events` redirect 一致
- **Friction**：與簽到統計、違規分頁；新使用者不知簽�在明細
- **Severity**：Medium
- **Recommendation**：列表加欄「預約數／已簽到」或行內 CTA「管理場次」

### 活動明細 `/admin/operations/:eventId`

- **User Goal**：管預約、簽到、匯入、違規、ET 分組
- **What Works**：tab 聚合多操作；deep link `?tab=` 支援 Leader 任務
- **Friction**：breadcrumb 無活動名；tab 多時認知負荷高
- **Severity**：Medium
- **Recommendation**：breadcrumb 第三段帶名稱；常用 tab 依 role 排序

### 合規與違規 `/admin/violations`

- **User Goal**：登記／查詢違規、黑名單
- **Friction**：ADMIN-UX-009
- **Severity**：Medium
- **Recommendation**：見 friction list

### 英語學習歷程中心 `/admin/learning-journey`

- **User Goal**：學期 KPI、查學生、breakdown
- **What Works**：V3 API、Student Table 篩選、學期 selector、teacher view 分支
- **Friction**：英文 card 標題；與 LA 功能重疊；內嵌 analytics panel
- **Severity**：High（入口分裂）
- **Recommendation**：中文化；對外定位為 canonical 操作入口

### 學習成效分析 `/admin/learning-analytics/*`

- **User Goal**：群體分析、模型、raw data、報告
- **What Works**：子 nav 清楚；subtitle 說明「數字用來比較趨勢」
- **Friction**：9 tab + 側欄 9 項重複；雙 h1；手機 tab overflow 待驗
- **Severity**：Medium
- **Recommendation**：與 LJ 分工文案；子 nav 手機優化

### 資料匯入中心 `/admin/import-center`

- **User Goal**：找到匯入入口
- **What Works**：狀態 legend、卡片權限、說明「原頁操作」誠實
- **Friction**：多一跳；denied 角色體驗
- **Severity**：Medium

### 問卷中心 `/admin/survey-center`

- **User Goal**：建立／發布問卷
- **What Works**：與 rules 分離符合業務（gate 在 rules）
- **Friction**：與 legacy module 並存
- **Severity**：Low–Medium

### 我的帶班場次 `/admin/et-grouping/my-sessions`

- **User Goal**：Leader 看場次、進任務勾選
- **What Works**：學期 filter、連活動明細
- **Friction**：empty 無 CTA；AccessDenied 死路
- **Severity**：Medium（Leader）

### 帳號／系統設定

- **What Works**：mustResetPassword 強制流程清楚；token 15 分鐘警告
- **Friction**：設定入口分散（dashboard CTA + 側欄）
- **Severity**：Low

---

## G. Top 10 改進項目

| # | Priority | Issue | User Impact | Proposed Change | Effort |
|---|----------|-------|-------------|-----------------|--------|
| 1 | P0 | 學習資料多入口 | 查學生迷路、數字對帳困難 | 收斂為 LJ 操作 + LA 分析；移除 legacy 側欄查詢 | M |
| 2 | P0 | Leader AccessDenied 死路 | 無權限頁無法離開 | role-aware CTA | XS |
| 3 | P0 | Worker 側欄與文件不一致 | 工讀生看到過多功能 | 接線 `isWorkerRestrictedMenu` 或改文件 | S |
| 4 | P1 | 活動營運分散 | 簽到／違規／統計多入口 | 強化活動明細 tab 導引；列表顯示狀態 | M |
| 5 | P1 | 雙重頁首 | 小螢幕浪費、標題不一致 | 統一由 AdminLayout 出標題 | S |
| 6 | P1 | 側欄預設全收合 | 新人不知系統全貌 | 角色預設展開 + 可選搜尋 | M |
| 7 | P1 | Legacy redirect 無說明 | 舊 SOP 與新 UI 脫節 | migrated toast + 內部文件 | S |
| 8 | P2 | 違規 UX 粗糙 | 成功像失敗、empty 無導引 | toast + empty CTA + responsive | S |
| 9 | P2 | 中英混雜 | 非技術行政讀不懂 | LJ／route label 中文化 | XS |
| 10 | P2 | Dashboard 缺待辦 | 不知道今天先做什麼 | KPI 旁加待辦 strip | M |

---

## H. Improvement Roadmap

### Phase 1｜Quick Wins

- AccessDenied、Login leader 落地、違規 toast、LJ 中文化、登入頁學生導流
- Worker 側欄接線或文件更新
- Dashboard quick links 清理

### Phase 2｜Core UX（主要工作流）

- 活動列表 → 明細導引（簽到／違規）
- Breadcrumb 強化（群組可點、活動名）
- 收斂學習資料側欄
- Redirect migrated 提示

### Phase 3｜Information Architecture

- Role-based home／待辦
- ET 分組子 hub
- Import Center 權限空狀態
- 問卷工作流 onboarding 文案

### Phase 4｜Polish

- 側欄搜尋／釘選
- LA 手機 subnav
- 視覺統一 admin-minimal 與各模組 CSS

---

## Navigation Audit

**管理員能否只靠側欄理解整個 EEARS 後台？困難。**

| 觀察 | 例子 |
|------|------|
| 同一資料多入口 | LJ／LA／analytics/students |
| 同一流程多入口 | 簽到（明細）／參與統計／違規（獨立頁） |
| 名稱太技術 | Breakdown、Student Table、V3 API、Legacy |
| Legacy 別名 | english-test-tracking → learning-journey |
| hidden 但仍可达 | BESTEP import、survey-module、LJ operations |
| 群組過深 | 活動與預約 8 子項；LA 9 子項 |
| 營運總覽位置 | 在「系統與稽核」底，非第一眼 |
| 角色差異大 | Leader 極簡 vs admin 極繁，但 AccessDenied 假設人人有 dashboard |

---

## Visual Hierarchy Audit

| 頁 | 先看到 | 是否最重要 | 問題 |
|----|--------|------------|------|
| 任意子 layout | Layout 標題 + 頁內 h1 | 否 | 雙標題 |
| 營運總覽 | KPI 四格 | 是 | 缺待辦 |
| LJ dashboard | B2 KPI 卡 | 是 | 下方 Breakdown／Table 英文搶眼 |
| LA | 大 h1 + 9 tab | 是 | tab 過多 |
| 活動列表 | filter + 表 | 是 | OK |
| 違規 | 表單 + 表 | 是 | 成功訊息像錯誤 |

---

## Cognitive Load Audit

- **一次太多**：側欄 10 區 × 多子項；活動明細多 tab；LA 9 視圖。
- **術語**：ET、EC、B2、LJ V3、canonical、gate、import run、quarantine。
- **重複**：LJ 與 LA 都講「成效」；dashboard 與側欄都有設定入口。
- **可改善**：Role-based 預設展開；hub 頁（ET 分組、匯入）減少同層平鋪；對外 glossary tooltip。

---

## Microcopy Audit

| 現況 | 問題 | 建議 |
|------|------|------|
| 返回後台首頁 | Leader 無 dashboard | 「返回我的工作頁」 |
| 違規登記成功（error 樣式） | 像失敗 | 成功 toast |
| Breakdown / Student Table | 英文 | 「分項統計」「學生清單」 |
| 原頁操作（Import Center） | 好，誠實 | 維持，卡片加「將前往 ○○ 頁上傳」 |
| 問卷管理（Legacy） | 封存 | 維持，確保無 dead link |
| ET Leader（badge） | 中英混 | 「英語桌帶班」 |

---

## 系統回饋 Audit

| 情境 | 成功？ | 問題 |
|------|--------|------|
| KPI 載入失敗 | 有 N/A + tooltip | ✓ 好 |
| 違規登記成功 | 用 error UI | ✗ |
| 無權限 | 有說明 | CTA 錯 |
| Leader 無場次 | Alert | 缺 CTA |
| mustResetPassword | 強制導向 | ✓ |
| Token 15 分鐘 | 警告 banner | ✓ |
| Import 卡片 disabled | badge | 缺「為何 disabled」一句 |

---

## Mobile UX Audit（待 browser 確認）

- **側欄**：≤992px 抽屜 + backdrop（`adminLayout.css`）——基本 OK。
- **活動列表**：filter 堆疊、表橫捲——可接受。
- **違規**：原生 table 無 wrap——較差。
- **LA subnav**：9 tab 橫向——需實機。
- **雙層 header**：小螢幕垂直空間消耗大。

---

## Accessibility Audit（程式面）

- 側欄 `aria-expanded`、`aria-label="後台主導覽"` ✓
- KPI 有 `role="status"` spinner ✓
- AccessDenied 用 `role="alert"` ✓
- 待驗：表格 header scope、違規表單欄位 error 關聯、LA tab 鍵盤操作

---

## Consistency Audit → Design System Pattern

| 模式 | 不一致 | 應統一 |
|------|--------|--------|
| 頁首 | Layout h2 vs 子頁 h1/h4 | 單一 `AdminPageHeader` |
| 成功／失敗 | toast vs alert vs showErrorMessage | 統一 `useToast` success/error |
| Empty state | dashboard 有 CTA、違規無 | `AdminEmptyState` |
| 表格 | operations wrap vs violations 裸 table | 一律 `admin-table-wrap` |
| 學生查詢 | LJ table vs legacy search vs LA students | 單一 `StudentLookup` → LJ profile |
| Quick link | 新舊 dashboard 連結混 | 只連 Phase 2 路徑 |

---

## 19. 為什麼目前 UI 會形成這些 UX 問題（對照實作）

### Feature-centered 側欄

`adminNavigation.js` 註解寫 Phase 2 IA，排序依**模組**（活動、班級、英檢、問卷、匯入、分析…），不是依「簽到今日場次」「查這個學生」任務。與學生端 `Header.js` 的資訊架構問題同構。

### Phase 2 重組保留 Legacy 債

`App.js` L397–466 大量 `<Navigate>`；`hiddenFromNav: true` 只藏側欄不藏路由——遷移策略正確，但**使用者教育**不足（無 migrated 提示）。

### 權限模型比 UI 領先

`adminRouteAccess.js` + `filterVisibleNav` 雙層過濾很完整，但 worker 縮限、`AccessDenied` CTA 未跟上權限矩陣。

### 多產品線並列

英檢、護照、LJ V3、LA、ET 分組、問卷 gate 是不同時期產物；側欄誠實反映後端模組，但**未幫使用者決定先走哪條路**。

### 子 layout 各自為政

LA、LJ、Import Center 有獨立 shell CSS 與頁首——快速迭代結果，犧牲全站一致性。

### 關鍵程式碼引用

Worker 縮限未接線：

```111:117:reservation-frontend/src/constants/adminNavigation.js
export function isWorkerRestrictedMenu(c) {
  return c.actualUserRole === 'worker';
}
```

（`filterVisibleNav` 未呼叫此函式。）

AccessDenied 固定 dashboard：

```17:19:reservation-frontend/src/components/system/AdminAccessDenied.jsx
          <Link className="btn btn-primary btn-sm" to="/admin/dashboard">
            返回後台首頁
          </Link>
```

Leader redirect：

```82:87:reservation-frontend/src/components/AdminLayout.js
  useEffect(() => {
    if (accessProfile.role !== 'leader') return;
    if (location.pathname === '/admin' || location.pathname === '/admin/dashboard') {
      navigate('/admin/et-grouping/my-sessions', { replace: true });
    }
  }, [accessProfile.role, location.pathname, navigate]);
```

違規成功誤用 error：

```165:165:reservation-frontend/src/components/ViolationManagement.js
      showErrorMessage('違規登記成功！');
```

雙重標題（Layout + LA）：

```204:206:reservation-frontend/src/components/AdminLayout.js
        <div className="admin-page-header">
          <h2 className="admin-page-header__title">{pageTitle}</h2>
          <AdminBreadcrumbs pathname={location.pathname} navContext={navContext} />
```

```29:30:reservation-frontend/src/pages/admin/LearningAnalyticsLayout.jsx
      <header className="la-page-header">
        <h1 className="la-page-title">英語學習成效分析</h1>
```

---

## 結論

EEARS 管理後台在**權限、API 診斷、Phase 2 路由整理**上已比學生端成熟，但 UX 仍停留在「把模組掛上側欄」。與學生端 audit 結論平行：

> 功能都在，但使用者要自己拼「今天先做哪一件、查學生走哪條路、做錯了怎麼回來」。

優先順序建議：**收斂學習入口 → 修復 Leader／worker 角色死路 → 活動營運導引 → 頁首與回饋一致**。完成後再以各角色帳號做 browser walkthrough，補齊 Think-Aloud 實測段落。

---

## 附錄：與學生端 audit 的對照

| 學生端 | 管理端 |
|--------|--------|
| 導覽是中心官網 IA | 導覽是後端模組 IA |
| 缺「我的進度」 | 缺「查學生」單一入口 |
| 雙首頁 overlay／週報 | 雙標題 layout／子 layout |
| 空日曆 Critical | 學習入口分裂 Critical |
| 已 browser 實測 | 本輪 code review，待補實測 |

---

## 附錄：主要路由速查

完整列表見本文件「F. Page-by-page」與 `adminNavigation.js` `ADMIN_NAV_SECTIONS`。

Legacy redirect 集中於 `reservation-frontend/src/App.js`（約 L397–466）。

权限規則集中於 `reservation-frontend/src/constants/adminRouteAccess.js`。
