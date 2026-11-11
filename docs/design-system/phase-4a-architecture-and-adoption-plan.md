# EEARS Design System — Phase 4A Architecture and Adoption Plan

狀態：第 1–12 節是 Phase 4A 規劃。第 13 節是事後對照，不修改產品程式，也不新增需求。

日期：2026-11-11

規劃基底：`main` @ `ec3610625fa4e3688fd354f2d7c1aa955064fa5a`

對照基底：本機 `main` @ `7813d4e41bf718dda5cd8019260fd2dc2f5454ee`

方向：Academic Neutral + Institutional Academic Blue `#2A5D9F`

第 1–12 節的盤點、矩陣與路線圖都相對 `ec36106`。第 13 節只記錄後來進到本機 `main` 的 commit。路線圖裡沒有 commit 的項目仍未完成。

Phase 1–2 的歷史報告在 `docs/design-system/ui-ux-phase-1-2-audit-and-proposal.md`。那份文件當時引用的 `ui-accessibility.mdc` 與 `frontend-react.mdc` 已不在現行規則。現行前端約束是 `.cursor/rules/frontend.mdc`：Bootstrap 5、`design-system.css`、主色 `#2a5d9f`。第 1–12 節以 `ec36106` 的程式為準。

## 1. Executive Summary

EEARS 沒有第二套品牌主題要新建。`:root` 已經定義 Institutional Academic Blue `#2a5d9f`。問題是同一顆 Bootstrap 元件在四個殼層用了四種表面，而且 `design-system.css` 前半段與後半段互相覆蓋。

| 殼層 | 權威檔案 | 畫布 | 主要操作色 |
|---|---|---|---|
| 全域契約 | `reservation-frontend/src/styles/design-system.css` `:root` | `#f7f9fc` | `#2a5d9f` |
| 公開／學生 | `styles/public-ui.css`、`styles/emi-brand.css` | 同上，token 被複製成 `--pub-*`、`--home-*` | `#2a5d9f` |
| 後台殼 | `styles/admin-minimal.css` | 暖石 `#f3f0ea` | 近黑 `--admin-ink` `#241f1a` |
| Dashboard 試點 | `pages/admin/AdminDashboardProduct.css` | 不改後台畫布 | 區塊內唯一主按鈕回到 `#2a5d9f` |
| 成效分析 | `components/learningAnalytics/learningAnalytics.css` | `#faf9f7` | `--la-accent` `#2c5282` |
| 圖表序列 | `components/charts/chartTheme.js` | 不定義畫布 | 序列色，不是 UI 狀態色 |

Phase 3 已證明：後台可以維持既有殼層，只在一個區塊用學術藍做唯一 Primary Action。`adminDashboardPilot.browser.mjs` 鎖定主按鈕背景 `rgb(42, 93, 159)`、白字、畫面上只有一個 `.admin-dashboard__btn--primary`，以及 4.5:1 對比。Phase 3.1 已把 `browser-tests/dashboard.html` 與 `dashboard-main.jsx` 納入 `ec36106`。

Phase 4 不應一次把後台 `.btn-primary` 從近黑改成學術藍。那會讓所有後台主按鈕同時變色。建議先做零視覺差異的 token 別名與對比清單，再以 opt-in class 逐區導入。圖表序列色、CEFR／GSE 呈現與 `causalClaimAllowed` 不在換色範圍。

Phase 1–2 沒有預先劃定 4B–4G 的檔案清單。本文件依層疊邊界劃分，不依 CSS 檔案數量。

## 2. Current Design System Architecture

### 2.1 載入順序

`reservation-frontend/src/index.js` 的順序是：

1. `bootstrap/dist/css/bootstrap.min.css`
2. `src/index.css`
3. `src/styles/design-system.css`

後台要等 `components/AdminLayout.js` 才載入 `components/admin/adminLayout.css`，然後是 `styles/admin-minimal.css`。公開頁要等 `components/layout/PublicLayout.js` 才載入 `styles/public-ui.css`。`emi-brand.css` 由首頁與公開殼另行引入。

因此 `.btn-primary` 的勝負是：

1. Bootstrap 預設藍。
2. `design-system.css` 前段把 `.btn-primary` 設成 `var(--color-primary)`，hover 還有 `translateY(-1px)`（約第 102–118 行）。
3. 同檔後段把卡片、表格改回中性表面，但沒有取消公開頁按鈕位移。
4. `.admin-layout-root .btn-primary` 特異性更高，改成 `--admin-ink`，hover 為 `#333333`（`admin-minimal.css` 第 69–79 行），並用 `box-shadow: none !important` 與 `transform: none` 關掉位移。
5. Dashboard 再用 `.admin-layout-root .admin-dashboard .admin-dashboard__btn--primary` 只在該區塊恢復 `#2a5d9f`（`AdminDashboardProduct.css` 第 291–303 行）。

這是現行 Primary Action 不一致的直接原因，不是缺少 token。

### 2.2 Token 分層

Primitive 目前沒有獨立檔。色值直接寫在語意變數上。

Semantic 的權威位置應是 `design-system.css` 的 `:root`（第 5–96 行）。它已包含主色、表面、文字、邊框、狀態、陰影、圓角、字級、間距、過渡與 z-index。

Component-level token 是各殼層的複本，不是新的全域主題：

- `.public-site` 的 `--pub-*`（`public-ui.css` 第 3–27 行）
- `.public-site, .home-page` 再次覆寫 `--color-primary` 並定義 `--home-*`（`emi-brand.css` 第 6–40 行）
- `.admin-layout-root` 的 `--admin-*`（`admin-minimal.css` 第 3–20 行）
- `.admin-dashboard` 的 `--dash-warning: var(--color-warning)`（`AdminDashboardProduct.css` 第 6–7 行）
- `.learning-analytics` 範圍的 `--la-*`（`learningAnalytics.css` 第 2–6 行）

圖表沒有 CSS token。`chartTheme.js` 用 JS 常數 `CHART_PALETTE` 與 `CHART_SERIES`。

### 2.3 Phase 3 已落地的契約

`AdminDashboardProduct.jsx` 用 `primaryActionId` 保證只有一個主按鈕：有待辦時是第一筆待辦，否則才是空狀態或建立活動。CSS 選擇器都掛在 `.admin-layout-root .admin-dashboard` 底下，註解寫明不改後台殼層畫布。手機寬度主、次按鈕 `min-height: 44px`。`prefers-reduced-motion: reduce` 時關掉按鈕過渡。

這塊是後續階段的範本，不是要重做的對象。

### 2.4 `design-system.css` 內部衝突

同檔存在兩段同特異性規則，後寫者生效：

| 元件 | 前段 | 後段實際生效 | 位置 |
|---|---|---|---|
| `.table thead` | 主色藍底白字 | 中性 `--color-secondary`、次要文字色 | 約第 171 行與第 596 行 |
| `.card` | `--radius-lg` 與 hover 位移 | 中性邊框、無位移、暖色 hover 陰影 | 約第 238 行與第 569–578 行 |
| `.form-control:focus` | `outline: none` 加 0.2rem 藍光環 | 3px `rgba(42, 93, 159, 0.12)` 光環 | 約第 221–226 行與第 557–561 行 |
| `.btn` 圓角 | 前段主按鈕用 `--radius-md` | 後段一般 `.btn` 寫死 `6px` | 後段約第 482 行，Phase 1–2 已記錄 |

後段還留下兩處與冷色主題不一致的殘值：`.card:hover` 使用 `rgba(61, 46, 36, 0.045)`；斑馬紋使用 `rgba(247, 246, 243, 0.58)`（約第 619–621 行）。前段不是現行畫面，但是維護者會改錯地方。

全域 `:focus-visible`（第 676–678 行）用 2px `--color-primary`。輸入框前段把 `outline` 設成 `none`，所以鍵盤焦點在表單上主要靠 box-shadow，不靠這條全域規則。

`prefers-reduced-motion`（第 681–692 行）把所有動畫與過渡壓到 `0.01ms`，並使用 `!important`。這能壓過按鈕位移的時間，但不能從規格上刪掉 `transform`。

## 3. Token Ownership Matrix

數值相同不代表可以合併。下表的「建議」是 Phase 4B 以後的方向，本階段不改檔。

| 名稱 | 現行值 | 定義 | 使用範圍 | 重複 | 約束 | 權威來源 | 建議 |
|---|---|---|---|---|---|---|---|
| `--color-primary` | `#2a5d9f` | `design-system.css` `:root`；`emi-brand.css` 在公開殼再宣告一次 | 公開按鈕、Dashboard 主按鈕、圖表第一色、skip link | 與 `--color-info`、`--pub-primary`、`--home-primary`、`CHART_SERIES.primary` 同值 | 品牌。不可改成別的藍 | `design-system.css` `:root` | 保留。其他同值名稱改為別名，不改計算結果 |
| `--color-primary-dark` | `#1c3d6e` | 同上 | hover、Dashboard 焦點框、`--color-accent` | 與 `--color-accent`、`--pub-primary-dark` 同值 | 品牌的深色，不是第二個 Accent | `:root` | 保留。Accent 是否繼續等於它，列為開放決定 |
| `--color-primary-light` | `#eaf1fc` | `:root` | 資訊淺底、`--color-info-light` | 與 info light、`--pub-primary-light` 同值 | 品牌淺底 | `:root` | 保留 |
| `--color-accent` | `#1c3d6e` | `:root` | 名稱存在，畫面主操作多半不用它 | 等於 primary-dark | 角色未定 | 暫不另指定 | 先不要刪。Phase 4B 只加註解，不改值 |
| `--color-secondary` | `#f7f9fc` | `:root` | 次按鈕底、部分表面 | 等於 `--color-bg-primary` | 不是第二品牌色 | `:root` | 保留名稱。它目前是表面色，不是 Accent |
| `--color-bg-primary` | `#f7f9fc` | `:root` | 全域畫布、`index.css` body | 等於 secondary、`--pub-canvas` | Academic Neutral 畫布 | `:root` | 保留 |
| `--color-bg-secondary` | `#eef2f7` | `:root` | 次表面 | `--pub-canvas-deep` 同值 | 中性表面 | `:root` | 保留 |
| `--color-bg-paper` | `#ffffff` | `:root` | Dashboard 卡片、公開紙面 | `--pub-surface`、`--home` 紙面同值 | 表面 | `:root` | 保留 |
| `--color-text-primary` | `#2f3437` | `:root` | 正文 | `--pub-text`、圖表軸標籤同值 | 文字。Phase 1–2 記錄對 `#f7f9fc` 為 11.94:1 | `:root` | 保留 |
| `--color-text-secondary` | `#5a6169` | `:root` | 說明文字 | 公開頁另有 `--pub-text-body` `#3d4450` | 文字 | `:root` | 保留。`--pub-text-body` 先不要併掉 |
| `--color-text-muted` | `#6a7176` | `:root` | 輔助文字、圖表刻度 | `--pub-text-muted` 同值 | 文字。Phase 1–2 記錄對畫布 4.70:1 | `:root` | 保留。禁止再淡 |
| `--color-border` | `#d8e0ea` | `:root` | 一般邊框 | `--pub-border` 同值 | 中性 | `:root` | 保留 |
| `--color-border-light` / `soft` / `dark` | `#e8eef5` / `#d0d9e6` / `#b8c4d4` | `:root` | 分隔強度 | 公開頁只複製 light | 中性階層 | `:root` | 保留三階。不要收成一個 border |
| `--admin-canvas` | `#f3f0ea` | `admin-minimal.css` | 後台殼畫布 | 無同值全域 token | 後台現況，不是品牌第二色 | 後台殼，直到 4C 決定 | 暫留。不可在 4B 直接改成冷灰 |
| `--admin-ink` | `#241f1a` | `admin-minimal.css` | 後台 `.btn-primary`、作用中導覽內線 | 無 | 後台現行主操作色 | 後台殼 | 暫留。是否改指 `--color-primary` 是 4C 的決定 |
| `--admin-text` / `--admin-text-muted` | `#2c2926` / `#6e675f` | `admin-minimal.css` | 後台文字 | 與全域文字接近但不同 | 後台對比。Phase 1–2 記錄 muted 對暖畫布 4.90:1 | 後台殼 | 暫留 |
| `--admin-pastel-*` | 粉藍、粉綠、粉黃、粉紅各一組 | `admin-minimal.css` | Badge、Alert | 與 StatusBadge、語意色不同 | 後台狀態表面 | 後台殼 | 暫留。info 與 primary 目前被畫成同一粉藍，列為技術債 |
| `--la-accent` | `#2c5282` | `learningAnalytics.css` | 成效分析強調 | 不是 `#2a5d9f` | 第三組藍。不可在未測量前改成品牌藍 | 成效分析殼 | 暫留。換色會讓圖表與 UI 強調同時改變 |
| `--la-ink` / `--la-muted` / `--la-border` / `--la-surface` | `#1a1a1a` / `#5c5c5c` / `#e8e4df` / `#faf9f7` | 同檔 | 成效分析排版 | 暖中性，接近後台但不相同 | 分析頁密度 | 成效分析殼 | 暫留到 4G |
| `--color-success` | `#2f6f4e` | `:root` | 語意成功 | StatusBadge 用 `#146c43`；圖表 success 用 `#5b8f7a` | 語意。不可拿來當 Accent | `:root` | 保留。元件與圖表維持各自對照，不強制同色 |
| `--color-warning` | `#9a6700` | `:root` | Dashboard `--dash-warning`、公開 warning 字 | 淺底 `#fff4ce`。Phase 1–2 記錄此組合 4.42:1，未過 AA | 語意 | `:root` | 保留色相。淺底上的字色要在 4D 重測後才決定是否改用較深字，例如既有 alert 的 `#856404` |
| `--color-danger` | `#b42318` | `:root` | 語意危險 | Bootstrap danger、StatusBadge 的 `#dc3545` 底、圖表 `#c0725a` | 語意 | `:root` | 保留。不把圖表危險色改成 UI 危險色 |
| `--color-info` | `#2a5d9f` | `:root` | 資訊 | 等於 primary | 語意角色與品牌色重疊 | `:root` | 保留名稱，先標成 primary 的別名。不要新增第三個藍 |
| Focus | 無獨立 token | 多處寫死 | 全域 2px primary；表單 3px 或後台灰環 `rgba(17,17,17,.06)`；Dashboard 用 primary-dark | 三套焦點 | WCAG 鍵盤 | 應是 `:root` 的一個 focus ring | 4B 可新增別名指向現行 primary，不改後台灰環，直到 4C |
| `CHART_PALETTE` | `#2a5d9f` 到 `#7a6bb0` 八色 | `chartTheme.js` | Recharts 序列 | 第一色等於 primary；success／warning／danger 不等於 UI 語意色 | 資料序列。相鄰四個藍階區分弱 | `chartTheme.js` | 保留。4G 只准整理註解與對比，不准為了視覺一致改序列意義 |
| `--spacing-*` | 4／8／16／24／32／48px | `:root` | Dashboard 與少數頁 | 大量頁面直接寫 rem | 尺度 | `:root` | 保留。不為對齊而改現有 padding |
| `--radius-*` | 4／8／12／16／50% | `:root` | 部分元件 | 後台按鈕 6px、badge 999px、Dashboard 主按鈕用 `--radius-sm` | 尺度 | `:root` | 保留。pill 需要獨立語意，不要併進 radius-xl |
| `--shadow-*` | 四級冷藍陰影 | `:root` | 公開按鈕、部分卡片 | 後台與 Dashboard 多數 `none` | 後台密度要求陰影關閉 | `:root` 定義、後台明確關閉 | 保留 token。不要把後台陰影打開 |
| `--font-family-sans` | IBM Plex Sans, Noto Sans TC | `:root` | `index.css` body | 後台再寫一次相同字串 | 品牌字體 | `:root` | 保留 |
| `--font-family-serif` | 實際仍是 IBM Plex Sans | `:root` | 名稱像襯線 | 與 sans 相同 | 無現行襯線角色 | `:root` | 保留名稱，不要在 4B 改成真正襯線 |
| `--transition-*` | 0.15s／0.2s／0.3s | `:root` | 全域元件 | `--transition-slow` 是 300ms，超過 frontend.mdc 所說 CSS 顏色過渡宜在 150ms 內 | 動效 | `:root` | 保留。新樣式不得再使用 slow 做顏色過渡 |
| `--z-*` | 1000–1070 | `:root` | 對齊 Bootstrap | `index.css` skip-link 是 10000 | 層級 | `:root` 加一個 skip-link 例外 | 4B 只記錄，不改 skip-link |

`--dash-warning` 只是 `--color-warning` 的區塊別名，沒有新色值。可以留在 Dashboard，不必提升成全域 token。

## 4. Component Inventory

本階段不新增元件。

### Button

實作至少四套：

1. Bootstrap `btn-*`，被 `design-system.css` 覆寫。公開頁主按鈕是學術藍，hover 上移。
2. `.admin-layout-root .btn-primary`，近黑、無陰影、無位移。
3. Dashboard 的 `admin-dashboard__btn--primary|secondary|tertiary`，一個區塊只有一個 primary。
4. `styles/magic-ui.css` 仍有另一套深色閃光按鈕，Phase 1–2 已標成行銷殘留。

可共用的是層級概念，不是把所有 `btn-primary` 立刻改成 Dashboard class。必要差異：後台資訊密度要扁平；公開頁可以保留較明確的主按鈕；危險確認必須繼續用 danger，不能改成學術藍。技術債是同一 variant 在殼層間變色，以及多顆 primary 同時出現。無障礙：白字在 `#2a5d9f` 上，Phase 1–2 記錄 6.64:1；白字在 `#241f1a` 上為 16.33:1。兩者都過 AA。風險是後台改成藍之後，次要按鈕若仍是藍連結，層級會消失。漸進方式：抽出 opt-in 的單一主按鈕 class，先給新改的區塊用，不掃全站 `btn-primary`。

### Card

實作：Bootstrap `.card` 的全域中性樣式、後台 `.admin-layout-root .card` 無陰影、Dashboard `__card` 用 paper 與 `--color-border`、圖表 `.eears-chart-card` 寫死白底與 12px 圓角（`chartKit.css`）。必要差異是圖表卡片要容納 Recharts。技術債是全域 hover 暖陰影，以及前段死規則仍寫著主色卡片頭。無障礙問題低。漸進方式：4E 以前不要改 `.card` 全域規則。

### Badge / Status

實作：

1. `components/ui/StatusBadge.jsx` 與 `statusBadge.css`。variant 為 success、neutral、warning、danger、info。顏色是 Bootstrap 色相，不是 `:root` 語意色。
2. `.admin-badge--role|warn`。
3. 後台 `.badge.bg-*` 被改成 pastel，而且 `bg-primary` 與 `bg-info` 同一粉藍（`admin-minimal.css` 第 237 行之後）。
4. `ElpStatusBadge`、`DetailModalStatusBadge` 等領域徽章。
5. `utils/classBestepDisplayHelpers.js` 把 CEFR 對到 Bootstrap variant。C2 使用 danger，讀起來像錯誤。這是語意耦合，4G 前禁止改對照。

可共用 StatusBadge 的是預約與問卷這類狀態 pill。CEFR、GSE、達標與否必須維持自己的對照，不能為了視覺統一改成成功／危險。技術債是三套狀態色。警告淺底對比未過的證據在 Phase 1–2，對象是 `#9a6700` on `#fff4ce`，不是 StatusBadge 的 `#856404`。漸進方式：4D 只讓 StatusBadge 改指既有語意 token 的淺底與深字，並用對比測試守住；不改 BESTEP 等級對照。

### Alert

Bootstrap `.alert-*` 在 `design-system.css` 有覆寫；後台 `admin-minimal.css` 再用 pastel 蓋過。Phase 1–2 記錄 `.alert-warning` 寫死 `#856404`，比 warning token 在淺底上更接近 AA。必要差異是警告必須獨立於 Accent。技術債是 token 與 alert 字色不一致。漸進方式：先重測，再決定 token 或 alert 誰遷就誰。不要先改 token 值。

### Form Controls

全域 `.form-control` 用 primary 焦點環；後台改成灰邊與近黑淡環（`admin-minimal.css` 第 115–118 行）。這是必要的殼層差異，也是焦點不一致。無障礙風險：輸入框 `outline: none` 後，若 box-shadow 對比不足，鍵盤使用者會看不見焦點。漸進方式：4C 才決定後台焦點是否改回 primary-dark 的 2px outline。4B 不改表單。

### Table

全域後段是中性表頭。後台再用 `!important` 把 thead 設成暖色表面（`admin-minimal.css` 第 134–146 行）。前段藍表頭是死規則。必要差異是後台密度與數字用 tabular-nums。技術債是死規則與 `!important`。漸進方式：4E 可以刪前段死規則，但必須先有視覺比對，確認沒有頁面仍依賴藍表頭。

### Modal

共用路徑是 Bootstrap Modal，加上 `ConfirmDialog.jsx`、`AlertDialog.jsx`。兩者都 `backdrop="static"` 且 `keyboard={false}`，關閉依賴標頭關閉鈕與頁尾按鈕。ConfirmDialog 在有信件預覽時把初始焦點放在取消。這是行為，不是視覺。Phase 4 的視覺階段不得改 `keyboard` 或焦點策略。另外仍有大量頁面直接使用 `react-bootstrap` Modal，以及 `WeeklyHomeModal.css`、`DynamicSurveyModal.css`。必要差異是問卷、取消預約、違規登記的文案與按鈕語意。漸進方式：只統一圓角與標題表面，不改開關行為。

### Empty State

已有共用 `components/ui/EmptyState.js`。Dashboard、活動列表、問卷、學習歷程表格都有使用。variant 含 no-data、no-results、no-pending、no-activity。這是必要情境差異。技術債低。無障礙：根節點是 `role="status"`。漸進方式：保持元件，只在 4D 檢查它在後台暖底與公開冷底上的文字色。

### Loading State

`RouteLoading.jsx` 使用 Bootstrap Spinner 與 `role="status"`。`SkeletonCard` 與圖表 `.eears-chart-skeleton` 各自實作。圖表骨架有 `prefers-reduced-motion`。必要差異是路由層級與圖表層級。技術債是頁面仍直接放 Spinner，文案不統一。漸進方式：不新做 loading 元件。後續只要求新改區塊沿用 RouteLoading 或既有 Skeleton。

### Navigation

後台是 `adminLayout.css` 的側欄，作用中項目用 inset 墨線，不是學術藍。公開頁是 `Header.css` 與 `index.css` 的 tab。Phase 1–2 記錄 `index.css` 有一段把作用中 tab 塗成主色，後段又改回白底深字。必要差異是後台資訊架構與公開行銷頁。技術債是 tab 死規則。漸進方式：側欄顏色留到 4C 的殼層決定，不在 4B 改導覽。

### KPI Cards

Dashboard KPI 是 `AdminDashboardProduct` 裡的區塊，樣式在 `AdminDashboardProduct.css` 的 `__kpi`。成效分析 KPI 在 learning analytics 頁，使用 `--la-*`，並受 `learning-analytics.mdc` 約束：CEFR 看達標、GSE 看比較、接近 B2 是 GSE 51–58、`causalClaimAllowed` 維持 false。兩者不可合成一個元件。Dashboard 的數字層級可以當行政 KPI 的視覺參考；分析 KPI 的顏色與文案不能為了對齊 Dashboard 而改。

## 5. CSS Conflict and Specificity Findings

高特異性是有意為之的地方：

- `.admin-layout-root .btn-primary` 必須高於 `.btn-primary`，否則後台會掉回全域藍。
- `.admin-layout-root .admin-dashboard .admin-dashboard__btn--primary` 必須高於後台近黑，否則 Dashboard 主按鈕會變黑。Phase 3 的瀏覽器測試會因此失敗。

不必要或過寬的地方：

- `design-system.css` 前段與後段同特異性重複定義 `.table`、`.card`、`.form-control:focus`。前段應視為待刪的死規則，而不是第二份設計。
- `admin-minimal.css` 對 thead、badge、card-header 使用 `!important`，用來壓過 Bootstrap 與前段藍表頭。死規則刪掉之後，這些 `!important` 才有機會下降。現在不能先刪 `!important`。
- Dashboard 只在取消 Bootstrap 按鈕位移時使用 `!important`（`AdminDashboardProduct.css` 第 287–288 行）。這是局部防禦，應保留到後台按鈕不再統一上移為止。
- `import-center.css` 的 `!important` 數量高（盤點時該檔約 32 處）。它是匯入中心的局部覆寫，4E 前不要當全域清理對象。
- `index.css`、`EventList.css`、`EventDetail.css` 也有成組 `!important`。它們靠近預約與公開活動，視覺清理必須綁預約回歸測試。
- 全域 reduced-motion 的 `!important` 是無障礙底線，不列入淘汰。

硬編碼顏色仍然分布在大量 CSS。熱點與 Phase 1–2 相同，而且 `ec36106` 仍在：

- `learningAnalytics.css` 與 learning analytics 圖表元件的 `#2c5282`。
- `chartTheme.js` 的八色陣列。
- `statusBadge.css` 的 Bootstrap RGBA。
- `chartKit.css` 寫死 `#2f3437`、`#6a7176`，數值雖與 token 相同，卻沒有引用變數。
- `magic-ui.css` 的深色閃光按鈕。

重複定義不等于可以刪除。`--pub-*` 與 `--home-*` 在公開殼重新宣告，是為了不碰到 `.admin-layout-root`。`emi-brand.css` 的檔頭已寫明不影響後台。合併方式應是讓它們 `var(--color-primary)`，而不是把後台畫布改成公開畫布。

## 6. Adoption Priority Matrix

風險看的是契約與層疊，不是檔案數。

| 模組 | 視覺一致性 | 共用元件 | CSS 耦合 | 影響 | 功能回歸 | 順序 | 驗收 |
|---|---|---|---|---|---|---|---|
| Admin Dashboard | 高。Phase 3 已是 Academic Neutral 試點 | EmptyState、Bootstrap Spinner、自有按鈕層級 | 高，但是範圍鎖在 `.admin-dashboard` | 一個後台頁 | 低，若不動 JSX 邏輯 | 不重做。當回歸基準 | 既有 Vitest 8 項與 Playwright 5 項 |
| Admin shell／Navigation | 低。暖石加近黑，與試點主按鈕並存 | AdminLayout、Bootstrap | 高。`admin-minimal.css` 影響所有後台頁 | 全部後台 | 中。不改權限，但主按鈕變色會改變操作辨識 | 4C，且必須先做決定 | 殼層截圖與鍵盤焦點；Dashboard Playwright 不得退 |
| Admin Operations | 中。沿用後台殼 | Bootstrap 表格、Modal、表單 | `admin-operations.css`、`operationsSurfaces.css` | 活動營運 | 高。畫面旁就是預約、取消、違規 | 4E，晚於殼層決定 | 營運列表與取消對話的既有測試；不改 API |
| Import Center | 中低。暖色 kicker，局部動效 | 後台殼 | `import-center.css` 耦合高 | 匯入流程 | 高。處理狀態不能因 CSS 改義 | 4E 的後段 | 匯入狀態文案測試；只改表面 |
| Learning Journey | 中。表格已用 EmptyState | EmptyState | `learning-journey-import.css`、timeline CSS | 歷程閱讀與匯入 | 高。匯入與讀模型 | 4E 之後、4G 之前，只改表面 | 既有 LJ 前端測試；不改 gate 或匯入規則 |
| Analytics | 低。`--la-*` 是第三組表面 | 少量 StatusBadge、自有圖表 | 高，且與資料顏色綁在一起 | 成效判斷 | 很高。改色可能被讀成指標改變 | 4G | 既有 analytics Vitest 與 Playwright；公式與文案凍結 |
| Public Pages | 高。已是學術藍 | Header、public-ui、emi-brand | token 複製但數值對齊 | 首頁與內容頁 | 中。含 GSAP 既有頁 | 4F 前半，只收 token 別名 | 建置與公開頁冒煙；不改 GSAP |
| Student Reservation | 高。`public-ui.css` 對齊主色 | StatusBadge、EmptyState、Modal | `EventList.css`、`EventDetail.css` 有大量 `!important` | 學生預約與取消 | 很高 | 4F 後半 | 預約 Vitest 與既有流程測試；只改顏色類名 |
| Survey Gate | 中。問卷頁用 EmptyState | EmptyState、Modal | 問卷 CSS 局部 | 未完成問卷時的 409 流程 | 很高 | 4F，與預約同一階段但獨立驗收 | 確認 redirect 與畫面文案不變 |
| BESTEP | 中。沒有獨立全站 CSS；等級色走 helper | Bootstrap variant | `classBestepDisplayHelpers.js` 把等級映射到 variant | 班級與出席 | 很高。C2 用 danger 是語意問題，但改映射會改變讀法 | 4G 的保護範圍，預設不改映射 | 既有 BESTEP 測試仍綠；本路線不改 helper |

## 7. Phase 4B–4G Roadmap

本節是當時的路線圖。實際 commit 與仍停在計畫中的項目見第 13 節。

每一階段都可單獨驗收與回退。沒有階段得改 API、權限、預約規則、問卷 Gate、黑名單、匯入處理、BESTEP 計算、schema、指標、CEFR／GSE 或 `causalClaimAllowed`。

### 4B — Token 別名與對比清單，零視覺差異

目標：把權威來源寫進程式註解與別名，讓複製 token 指向 `:root`，計算後的顏色不變。

Scope：`design-system.css` 的註解與「值等於現值」的別名；`public-ui.css`、`emi-brand.css` 裡與 `:root` 同值的變數改為 `var(--color-*)`。

Out of scope：後台 `--admin-*`、`--la-*`、`chartTheme.js`、任何元件 class、按鈕層級。

預計檔案：上述三個 CSS。不新增套件。

Token：不改任何已發布色值。`--color-accent` 維持 `#1c3d6e`。

相容：別名前後的 computed color 必須相同。

測試：`npm test` 的前端相關子集、`npm run build`、Dashboard Playwright。比對公開頁主按鈕仍是 `rgb(42, 93, 159)`。

回退：還原這三個 CSS。

Entry：本文件審查通過，且 `ec36106` 仍是 Dashboard harness 的祖先。

Exit：公開頁與 `:root` 的主色、畫布、文字、邊框 computed value 不變；後台暖石與近黑不變；Dashboard 5 項瀏覽器測試通過。

### 4C — 後台殼層的 Primary Action 決定與 opt-in

目標：決定後台主按鈕繼續用 `--admin-ink`，或改為學術藍。在決定前，只新增 opt-in class，不改 `.admin-layout-root .btn-primary`。

Scope：`admin-minimal.css` 的註解、一個不自動套到全部 `.btn` 的主按鈕 class。可選一頁試用，優先不是 Dashboard。

Out of scope：一次替換所有後台 `btn-primary`、側欄結構、權限選單。

預計檔案：`admin-minimal.css`，以及被選中的單一後台頁 CSS。

Token：若決定改色，只改該 class 的背景為 `var(--color-primary)`，不改 `--admin-canvas`。

相容：未掛上新 class 的按鈕保持近黑。

測試：該頁鍵盤操作、對比、Dashboard Playwright 仍要求區塊內只有一個學術藍主按鈕。

回退：移除 opt-in class。

Entry：4B exit。並且書面決定「殼層主按鈕維持近黑」或「只在明確主操作使用學術藍」。

Exit：後台其他頁的 `.btn-primary` computed color 仍是近黑，除非該決定明確允許；Dashboard 測試不退步。

這個階段故意不把全站後台主按鈕改藍。Phase 3 的經驗是層級比全站同色重要。

### 4D — 共用狀態元件對齊語意色

目標：讓 `StatusBadge` 使用既有 success／warning／danger／info token 的淺底與深字，並重測 warning。

Scope：`statusBadge.css`，必要時只改 `EmptyState.css` 的文字色引用。

Out of scope：`classBestepDisplayHelpers.js`、ElpStatusBadge 的領域規則、Alert 文案、新增 Badge 元件。

預計檔案：`components/ui/statusBadge.css`，既有 `EmptyState.test.jsx` 若斷言 class 才更新。

Token：不新增色值。若 warning 淺底仍低於 4.5:1，沿用已通過對比的 `#856404` 作為 warning 文字的元件值，並在 token 註解標明，不直接改 `--color-warning`。

相容：variant 名稱不變。

測試：StatusBadge 渲染測試或既有引用頁 Vitest；對比腳本可沿用 Dashboard Playwright 的演算法，但不新建框架。

回退：還原 `statusBadge.css`。

Entry：4B exit。4C 未完成也可以做，因為它不依賴殼層主按鈕。

Exit：五個 variant 的文字對其背景達到 4.5:1；BESTEP helper 的 diff 為空。

### 4E — 後台高密度表面

目標：清掉 `design-system.css` 前段已失效的表格、卡片、表單規則；降低因此存在的後台 `!important`。Operations、Import、Learning Journey 只改表面。

Scope：`design-system.css` 死規則、`admin-minimal.css` 裡確定只為壓死規則而存在的 `!important`、`operationsSurfaces.css` 的硬編碼色改引用既有 token。

Out of scope：匯入狀態機、預約取消、違規登記、表格欄位、Modal 的 `keyboard`。

預計檔案：`design-system.css`、`admin-minimal.css`、`pages/admin/operationsSurfaces.css`。`import-center.css` 另開一個提交，不與營運頁捆在一起。

Token：只改引用，不改值。

相容：刪規則前先在營運頁與匯入頁比對表頭、斑馬紋、卡片 hover。

測試：營運與匯入既有 Vitest；手動鍵盤走過一個 Modal 的關閉鈕。`npm run build`。

回退：各提交獨立還原。

Entry：4C 的決定已寫下。沒有決定就不得刪後台 `!important`。

Exit：營運表頭不再依賴死規則；匯入頁狀態文字沒有改字；Dashboard Playwright 通過。

### 4F — 公開頁、學生預約與問卷的別名收斂

目標：學生可見表面繼續只用學術藍與既有語意色，清掉與 token 同值的硬編碼，不改流程。

Scope：`public-ui.css` 剩餘硬編碼、`Header.css`、`index.css` 裡與後段重複的 tab 死規則。預約卡片只改顏色引用。

Out of scope：`cutoffHours`、黑名單、問卷 409 與 `redirectUrl`、取消 API、FullCalendar 行為、GSAP。

預計檔案：`public-ui.css`、`index.css`、必要時 `EventList.css` 的顏色行。每次一個流程。

Token：不新增品牌色。

相容：活動狀態、名額、截止、未填問卷仍要看得到。

測試：預約與問卷相關 Vitest；公開頁 `npm run build`；390 與 1440 寬度檢查月曆仍在。

回退：按頁還原 CSS。

Entry：4B exit。不需要等 4C，因為公開頁本來就是學術藍。

Exit：主色仍是 `#2a5d9f`；預約與問卷測試不失敗；沒有流程檔 diff。

### 4G — 分析與圖表的表面，不動資料色

目標：成效分析頁的非資料表面改引用中性 token，圖表序列與 CEFR／GSE 對照凍結。

Scope：`learningAnalytics.css` 的表面、邊框、說明文字。`chartKit.css` 可改為引用已同值的文字 token。

Out of scope：`chartTheme.js` 的序列順序與色相、`CHART_SERIES` 的 success／warning／danger、BESTEP helper、指標公式、`causalClaimAllowed`、任何「為了和 Dashboard 一樣」而改的圖表。

預計檔案：`learningAnalytics.css`、`chartKit.css`。

Token：`--la-accent` 維持 `#2c5282`，除非另有對比與讀法審查。它不是 4G 的預設改動。

相容：圖表相鄰序列的辨識不能變差。Phase 1–2 已指出前四個藍階過近，那是資料視覺問題，應獨立於 Design System 換皮。

測試：既有 analytics Vitest 與 `test:analytics-browser` 裡與本次表面有關的案例。不要為了 4G 新增框架。

回退：還原這兩個 CSS。

Entry：4D 的狀態色已穩定，避免分析頁同時改狀態 pill 與表面。

Exit：圖表截圖的序列色不變；分析文案測試不變；`causalClaimAllowed` 仍為 false。

若後續審查希望減少階段數，可以合併 4D 與 4F 的「只改引用」提交，但不建議合併 4C、4E、4G。這三個的回歸面不同。

## 8. Accessibility Requirements

沿用 WCAG AA：一般文字 4.5:1，大字與非文字 UI 3:1。Phase 1–2 已計算、且本階段仍採為已知證據的組合：

| 組合 | 對比 | 判定 |
|---|---|---|
| `#2f3437` on `#f7f9fc` | 11.94:1 | 通過 |
| 白字 on `#2a5d9f` | 6.64:1 | 通過 |
| `#6a7176` on `#f7f9fc` | 4.70:1 | 通過，不可再淡 |
| `#6e675f` on `#f3f0ea` | 4.90:1 | 通過，不可再淡 |
| `#9a6700` on `#fff4ce` | 4.42:1 | 未過 |
| `#856404` on `#fff4ce` | 4.99:1 | 通過 |
| 白字 on `#241f1a` | 16.33:1 | 通過 |
| Bootstrap `#ffc107` 當文字 on 白 | 1.63:1 | 未過。不得用 `text-warning` 呈現狀態 |

Dashboard Playwright 已對「部分異常」與主按鈕做 4.5:1 斷言，並檢查 375、390、768、1440 不溢出。後續階段若改到這兩個顏色，必須維持這條測試。

鍵盤：全域 `:focus-visible` 已存在。表單與後台焦點環不一致，4C 前不要假設所有控制項都有 2px 藍框。Modal 的 Escape 行為是既有產品設定，視覺階段不改。主按鈕在手機上沿用 Dashboard 的 44px 最小高度，只要求新改的主操作，不追溯全部歷史按鈕。

動效：新 CSS 的顏色過渡不得超過 150ms。必須尊重 `prefers-reduced-motion`。不要新增 GSAP。不要再給全站 `.btn:hover` 加 `translateY`。

## 9. Risk and Rollback Plan

| 風險 | 為什麼不是檔案數量問題 | 緩解 | 回退 |
|---|---|---|---|
| 後台主按鈕一次改藍 | 所有 `.admin-layout-root .btn-primary` 同時變色，操作層級消失 | 4C 只用 opt-in | 移除 class |
| 刪死規則時誤刪後段 | 同選擇器以前段為維護者慣例 | 4E 先附畫面比對 | 還原 `design-system.css` |
| warning token 直接加深 | 會連動 Dashboard `--dash-warning` 與公開警告 | 4D 先改元件字色 | 還原 `statusBadge.css` |
| 圖表改成 UI 語意色 | 序列意義與達標色會被讀成另一種指標 | 4G 凍結 `chartTheme.js` | 不進入該 diff |
| CEFR 不再用 danger 表示 C2 | 讀法改變，像修了資料語意 | 預設不改 helper | 不進入該 diff |
| 預約 CSS 的 `!important` 清理 | 月曆、黑名單、截止、名額狀態可能被蓋掉 | 4F 只改同值顏色 | 按頁還原 |
| 公開 token 別名改到後台 | `emi-brand.css` 若選擇器變寬，會染到 `.admin-layout-root` | 別名只留在 `.public-site, .home-page` | 還原該檔 |

每個階段一個提交，不與業務功能提交混合。回退單位是該提交，不需要資料庫或 API 回滾。

未追蹤的 `.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/` 與其他 worktree 不屬於本路線。

## 10. Validation Strategy

不新增測試框架。沿用：

| 工具 | 用途 |
|---|---|
| Vitest `npm test` | Dashboard、EmptyState、預約、問卷、analytics 的既有案例 |
| Playwright `npm run test:analytics-browser` | 全套瀏覽器回歸。Dashboard 子集是 `adminDashboardPilot.browser.mjs` |
| Dashboard harness | `browser-tests/dashboard.html`、`dashboard-main.jsx`，已在 `ec36106` |
| `npm run build` | 確認生產建置仍從 `src/index.js` 進入，不把 browser harness 包進去。既有 `browser-tests/productionBuildIsolation.test.mjs` 守這條 |
| Viewport | Dashboard 已涵蓋 375／390／768／1440。其他頁在該階段改到版面時，沿用同一組寬度 |
| WCAG AA | 沿用 Dashboard 測試裡的對比函式與 Phase 1–2 已記錄的組合。新組合要先測量再改 token |
| Keyboard | 該階段若改到焦點環或 Modal 外觀，用鍵盤走一次 Tab、Shift+Tab 與關閉鈕。不改 `keyboard={false}` |
| Reduced motion | 全域規則已存在。新動畫必須在 reduce 時關閉 |

4B 的最低驗收是 Dashboard Vitest、Dashboard Playwright 與 production build。不必為了別名重跑全部 analytics 瀏覽器測試，除非 diff 碰到 analytics CSS。4G 才需要 analytics 瀏覽器案例。

## 11. Open Decisions

下列七點是 4A 寫下時的開放問題。試點已經回答的範圍，以及仍然開放的部分，見第 13.6 節。本節原文保留。

1. 後台殼的主按鈕維持 `--admin-ink`，還是只在明確的唯一主操作改用 `#2a5d9f`？未決定前，禁止修改 `.admin-layout-root .btn-primary`。
2. `--color-accent` 繼續等於 `#1c3d6e`，或改成 `--color-primary` 的別名？兩者都不是新色。未決定前保持現值。
3. warning 在淺底上改用 `#856404`，或改淺底？未重測前不改 `--color-warning`。
4. `--la-accent` `#2c5282` 是否要在更晚的階段對齊 `#2a5d9f`？預設否。它會同時改變分析頁強調與部分圖表。
5. `classBestepDisplayHelpers.js` 的 C2 → danger 是否另案改文案或 variant？不屬於 4B–4G 的預設範圍。
6. `ConfirmDialog` 與 `AlertDialog` 的 `keyboard={false}` 是否要恢復 Escape？這是行為變更，不放進視覺階段。
7. `magic-ui.css` 是否停用？它是公開頁第二套按鈕。需先確認仍有頁面引用，再單獨廢棄，不塞進 4B。

## 12. Phase 4B Entry Gate

可以進入 4B 規劃實作的條件：

1. 本文件被接受為 Phase 4 的範圍。
2. `main` 包含 `ec36106`，Dashboard browser harness 已追蹤。
3. 4B 的 diff 只限 `design-system.css`、`public-ui.css`、`emi-brand.css` 的同值別名與註解。
4. 不修改 `--admin-*`、`--la-*`、`chartTheme.js`、Dashboard JSX／CSS、預約、問卷、權限、分析公式。
5. 不新增套件、不新增測試框架、不改 Rules 或 Skills。
6. Exit 時 Dashboard Vitest、Dashboard Playwright 與 `npm run build` 通過，且公開主色 computed value 仍是 `#2a5d9f`。

以上是 4A 寫下時的進入條件。當時 4B 尚未開始。後來的 commit、驗收與未做項目見第 13 節。

## 13. As-Built Record（4B–4E）

本節是 2026-11-11 對本機 `main` `7813d4e41bf718dda5cd8019260fd2dc2f5454ee` 的事後對照。它不改第 3 節的 Token Ownership Matrix，也不把第 7 節的預計檔案改寫成已完成。品牌色仍是 `#2a5d9f`。`--color-warning` 仍是 `#9a6700`。

祖先是一條快轉，沒有 merge commit：

```
ec36106  test(dashboard): track browser harness for reproducible pilot tests
  └─ 1dbdc94  refactor(design-system): consolidate public color token aliases
       └─ 13ca0ed  feat(design-system): pilot opt-in admin primary action
            └─ 43f3133  refactor(design-system): align import center status badges
                 └─ ad15db0  fix(a11y): improve warning toast text contrast
                      └─ 7813d4e  fix(a11y): improve public warning text contrast
```

`43f3133` 是 4B–4D 快轉後的 `main`。`7813d4e` 是 4E-B 與 4E-C 再快轉後的 `main`。兩次都只在本機進行，撰寫本節時沒有 push、沒有部署。

### 13.1 計畫與成果

| 計畫 | 計畫當時要動的檔 | 實際 commit | 實際檔案 | 結果 |
|---|---|---|---|---|
| 4B 同值別名，零視覺差異 | `design-system.css`、`public-ui.css`、`emi-brand.css` | `1dbdc94fb55f4818edbe88ba80c69cee3c6107ac` | `home.css`、`emi-brand.css`、`public-ui.css` | 已落地。沒有改 `design-system.css` |
| 4C opt-in 主按鈕，殼層維持近黑 | `admin-minimal.css` 與單一後台頁 | `13ca0ed2e3e87c5aec422721ac3320b9b76e547d` | `admin-minimal.css`、`AdminAuditLogsPage.js`、`AdminAuditLogsPage.test.jsx` | 已落地。試點只有稽核頁「查找」 |
| 4D StatusBadge 對齊語意色 | `statusBadge.css`，必要時 `EmptyState.css` | `43f3133c241485d1b1f9fac0fe2958d0b1792fbd` | `ImportCenterPage.jsx`、`ImportCenterPage.test.jsx` | 換成匯入中心圖例。`statusBadge.css` 未改 |
| 4E 高密度表面、刪死規則 | `design-system.css`、`admin-minimal.css`、`operationsSurfaces.css` | 無 | 無 | 仍停在第 7 節 |
| 4E-B Warning Toast 對比 | 計畫編號裡沒有這一項 | `ad15db068f54e1c29db11f5d4364f90f5c3645c9` | `english-test/ToastMessage.js`、`ToastMessage.test.jsx` | 已落地 |
| 4E-C 公開淺黃底文字 | 計畫把這件事放在 4D 的 warning 重測 | `7813d4e41bf718dda5cd8019260fd2dc2f5454ee` | `public-ui.css`、`home.css` | 已落地。只改兩個文字別名 |
| 4E-D 公開「額滿」Badge | 無此計畫項 | 無 | 無 | 調查後取消。問題假設不成立 |
| 4F 公開頁與預約硬編碼 | `public-ui.css`、`index.css`、必要時 `EventList.css` | 無 | 無 | 仍停在第 7 節 |
| 4G 分析表面 | `learningAnalytics.css`、`chartKit.css` | 無 | 無 | 仍停在第 7 節 |

4E-A 是唯讀盤點，沒有 commit。業務契約沒有改：預約與取消、問卷 Gate、權限、黑名單、匯入處理、BESTEP、學習歷程、成效分析、CEFR／GSE、`causalClaimAllowed`、`chartTheme.js` 都不在上述 diff。

### 13.2 Phase 4B

`1dbdc94` 只把同值、同角色的公開與首頁變數改成 `:root` 別名。`design-system.css` 沒有進這個 commit。

已改成別名的包括公開畫布、紙面、邊框、正文、輔助文字、主色與深淺主色、成功／警告／危險／資訊的淺底與文字，以及首頁對應的 `--home-canvas`、`--home-primary`、`--home-pastel-*`。警告文字在這一筆仍是 `var(--color-warning)`，也就是 `#9a6700`。後來 4E-C 才改字色。

刻意留成字面值的包括 `--pub-text-body` `#3d4450`、`--pub-info-text` `#1c3d6e`、`--pub-canvas-deep` 與淡表面 `#eef2f7`。公開殼的 `--color-bg-secondary` 仍是 `#f7f9fc`，因為 `:root` 的 `--color-bg-secondary` 是 `#eef2f7`，兩者不同角色。`--color-accent`、後台 `--admin-*`、`--la-*`、`chartTheme.js` 都沒有進 4B。

回退這一筆會碰到後面的 `7813d4e`，因為兩筆都修改 `public-ui.css` 與 `home.css`。`emi-brand.css` 只有 4B 動過。

### 13.3 Phase 4C

決定是：後台殼的 `.admin-layout-root .btn-primary` 維持 `--admin-ink` `#241f1a`，hover／focus／active 維持 `#333333`。學術藍只做 opt-in。

Class 是 `.admin-layout-root .btn.btn-primary.admin-action--primary`。背景與邊框用 `--color-primary`，字用 `--color-text-white`，hover／focus／active 用 `--color-primary-dark`，`focus-visible` 是 2px `--color-primary-dark` outline、offset 2px。沒有 `translate`。定義在 `reservation-frontend/src/styles/admin-minimal.css`。

唯一試點是 `reservation-frontend/src/pages/admin/AdminAuditLogsPage.js` 的「查找」：`variant="primary"` 加上 `admin-action--primary`。其他後台 `.btn-primary` 沒有掛這個 class。Dashboard 的主按鈕仍是 `.admin-dashboard__btn--primary`，不是這個 class。

回退單位是 `13ca0ed`。它與 4B、4D、4E 的路徑不重疊。

### 13.4 Phase 4D

`43f3133` 讓匯入中心圖例使用既有 `IMPORT_STATUS_BADGE`，與 `ImportTaskCard` 同一套後台粉彩 Badge。對照在 `reservation-frontend/src/constants/importCenterStatus.js`，這一筆沒有改該檔：

| tier | 文案 | Badge |
|---|---|---|
| `enabled` | 已啟用 | `success` |
| `export_only` | 僅匯出 | `primary` |
| `disabled` | 尚未啟用 | `secondary` |
| `pending` | 待確認 | `warning`，並附 `text-dark` |

狀態值、匯入處理與類型標籤 `import-center-kind--*` 都沒有改。`pending` 的 `text-dark` 在後台會被 `.admin-layout-root .badge.bg-warning` 的粉彩字色蓋過。`components/ui/statusBadge.css` 與 `EmptyState` 不在這個 commit。第 7 節 4D 所寫的 StatusBadge token 化仍未做。

回退單位是 `43f3133`。

### 13.5 Phase 4E-B、4E-C、4E-D

4E-B，`ad15db0`：`ToastMessage.js` 的 warning 由 `bg-warning text-dark` 改為 `bg-warning text-white`。關閉鈕一律 `btn-close btn-close-white btn-sm ms-2`。Success、Danger、Info 原本就是白字與白色關閉鈕，class 字串不變。`role="alert"`、`aria-live="polite"`、訊息、`onClose` 與 3000ms 沒有改。`components/ui/ToastMessage.js` 仍只轉出 english-test 的元件。實色背景仍來自全域 `.bg-warning`，也就是 `--color-warning` `#9a6700`。

4E-C，`7813d4e`：只改兩個文字別名。

- `public-ui.css` 的 `--pub-warning-text` 由 `var(--color-warning)` 改為 `#856404`。`--pub-warning-bg` 仍是 `var(--color-warning-light)`。
- `home.css` 的 `--home-pastel-yellow-text` 同樣改為 `#856404`。`--home-pastel-yellow` 仍是 `var(--color-warning-light)`。

使用這兩個別名的規則是 `.public-site .alert-warning`、`.announcement-ticker__badge`、`.home-tag--yellow`。後台粉彩、Dashboard「部分異常」（`--dash-warning: var(--color-warning)`）與 `--color-warning` 本身都沒有改。

4E-D：唯讀追查後取消，沒有 worktree、沒有 commit、沒有程式 diff。公開活動列表的「已額滿」走 `EventDeadlineHint.js` 的 `FULL: 'danger'`，以及 `EventCalendarSection.js` 的 `calendar-event--full`。預約摘要名額用 `.event-booking-summary__spots--full`，字色是 `--color-danger`。唯一把文字寫成「額滿」、class 寫成 `bg-warning text-dark` 的是 `utils/eventListStatus.js`，只用在後台營運表 `EventReportTable.js`；後台粉彩規則會蓋過該 Badge 的實色 warning。因此沒有把 `text-dark` 改成白字，也沒有改全域 `.bg-warning`。

`ad15db0` 可單獨回退。回退 `7813d4e` 會把兩個警告文字別名還原成 4B 的 `var(--color-warning)`。第 7 節的 4E 高密度清理仍未開始，所以沒有死規則或後台 `!important` 的回退。

### 13.6 開放問題的現況

1. 後台殼主按鈕：試點決定維持 `--admin-ink`。學術藍只出現在掛上 `admin-action--primary` 的操作。目前只有稽核頁「查找」。其餘後台主按鈕沒有改色，也沒有授權全站替換。
2. `--color-accent`：仍等於 `#1c3d6e`。4B 沒有改。
3. 淺底 warning：公開與首頁的文字別名已用 `#856404`，淺底沒有改，`--color-warning` 沒有改。StatusBadge、後台粉彩與 Dashboard「部分異常」沿用各自既有色。這不是全站 warning 字色已經統一。
4. `--la-accent` `#2c5282`：未對齊品牌藍。
5. BESTEP C2 → danger：未改。
6. `ConfirmDialog` 與 `AlertDialog` 的 `keyboard={false}`：未改。
7. `magic-ui.css`：未停用。

### 13.7 驗收證據

證據分成四種。選擇器夾具只證明該 class 在已載入的 CSS 下的 computed style，不是完整頁面驗收。

| 證據 | 方法 | 範圍 | 結果 |
|---|---|---|---|
| 本機 `main` 快轉到 `7813d4e` | Git | `43f3133..7813d4e` 只有 Toast 兩檔與 `public-ui.css`、`home.css` | 沒有 merge commit。4B–4D 已在 `43f3133` |
| Toast DOM Vitest | 測試 | `ToastMessage.test.jsx`，4 項 | 在 `7813d4e` 通過。斷言 warning 為 `bg-warning text-white`、關閉鈕含 `btn-close-white`，Success／Danger／Info 維持原 class |
| Dashboard Vitest | 測試 | `AdminDashboardProduct.test.jsx`，8 項 | 在 `7813d4e` 通過 |
| Import Center DOM | 測試 | `ImportCenterPage.test.jsx`，1 項 | 在 `7813d4e` 通過。圖例與卡片同一套 Badge |
| importCenterCards | 測試 | `importCenterCards.test.js`，3 項 | 在 `7813d4e` 通過 |
| 稽核頁 Vitest | 測試 | `AdminAuditLogsPage.test.jsx` 4 項、`auditLogsUi.test.js` 3 項 | 在 `7813d4e` 通過。含「查找」是該頁唯一 opt-in primary |
| Dashboard Playwright | 瀏覽器測試 | `adminDashboardPilot.browser.mjs`，5 項 | 在 `7813d4e` 通過。1440／768／390／375，以及 primary action |
| Production build | 建置 | `reservation-frontend` 的 `npm run build` | 在 `7813d4e` 成功，46.28s |
| `git diff --check` | Git | 工作區與 `43f3133..HEAD` | 通過 |
| 公開淺黃字色 | 選擇器夾具 | production preview `http://127.0.0.1:3025/`。公告 API 拒絕連線，頁上沒有既有 warning alert、置頂 Badge 或黃色標籤。節點被放進真正的 `.public-site` 與 `.home-page` | 1440／768／390／375 皆為字 `rgb(133, 100, 4)`、底 `rgb(255, 244, 206)`。由這組 computed RGB 算出 4.99:1 |
| Warning class | 選擇器夾具 | 同一頁插入 `bg-warning text-white` | 字 `rgb(255, 255, 255)`、底 `rgb(154, 103, 0)`。由 computed RGB 算出 4.87:1。`--color-warning` computed 仍是 `#9a6700` |
| 4B 期間的前端 Vitest | 測試，提交前 | 當時 worktree 的 `npm test` | 510 passed、1 failed。失敗是既有 `student-feedback` 導覽詞彙。整合後沒有重跑整套 |

第 8 節已列的 `#856404` on `#fff4ce` 4.99:1，現在有夾具 computed style 對上同一組 RGB。白字 on `#9a6700` 的 4.87:1 也來自夾具，不是另寫一份色票。

各階段提交前，在各自 worktree 也跑過 Dashboard Playwright 與 production build。那些是提交前紀錄。上表「在 `7813d4e`」的列才是整合後重跑的結果。

### 13.8 尚未驗證，也尚未修復

- 登入後的 Warning Toast 畫面。夾具只讀到同 class 的 computed style。
- 稽核頁登入後的完整 RWD，以及滑鼠按下時的 `:active` 取樣。
- Import Center 登入後的畫面。
- 公告 API 正常時，首頁真實公告、置頂 Badge 與 `.home-tag--yellow` 的版面。
- Toast 內層 `role="alert"` 與外層 `aria-live="polite"` 的重複公告。結構維持原樣。
- 既有 `student-feedback` 導覽詞彙測試失敗。導覽 id 在 `adminNavigation.js`，與這次 CSS 無關。

第 7 節的 4E 高密度表面、4F、4G，以及 StatusBadge 改指語意 token，都還沒有 commit。

### 13.9 版控

本文件沒有秘密，也沒有產品程式。若要納入版本管理，只加入 `docs/design-system/phase-4a-architecture-and-adoption-plan.md`。`.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/` 與其他 worktree 不屬於這份對照。撰寫本節時檔案仍未追蹤，也沒有為它建立 commit。
