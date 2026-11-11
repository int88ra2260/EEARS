# EEARS UI/UX Design System：Phase 1 審計與 Phase 2 提案

狀態：歷史報告，不是現行專案狀態，也不是後續實作的永久禁令。  
這是 2026-11-10 的 Phase 1–2 分析與提案。文件本身當時沒有改產品程式；之後的程式以 repository 為準。  
範圍：Presentation Layer 的當時盤點與設計契約。不改 API、資料契約、權限、預約規則、問卷 Gate、匯入處理或成效公式。  
日期：2026-11-10

## 結論

不要把 EEARS 換成方案 A、B 或 C。

產品已經有一套被規則鎖住的機構識別：**Institutional Academic Blue**，主色 `#2a5d9f`。公開頁、圖表與 `design-system.css` 都對齊這組色。後台卻另用暖石色畫布與近黑按鈕。學習成效頁又有第三組 `--la-*`。三套表面同時存在，Accent 因此失去意義：藍色同時是連結、資訊、圖表、分頁、月曆與主要按鈕。

這一輪要做的是把現有 token **收成一份語意契約**，而不是再加一份主題。

推薦方案是 **方案 D：Academic Neutral**。兩種基礎色沿用現有冷中性畫布與白表面；唯一 Accent 繼續用學術藍，但只留給主要操作與鍵盤焦點。成功、警告、危險維持獨立色相。若必須在 A／B／C 中排序，順序是 **C（必須先拿掉電光藍與暖沙）＞ A ＞ B**。收斂後的 C 會和 D 變成同一件事。

品牌限制來自：

- `.cursor/rules/ui-accessibility.mdc`：以 `design-system.css` 為準，主色 `#2a5d9f`；公開頁不得再引入暖珊瑚或米色範本主色；不得另起一套全域樣式取代既有變數。
- `.cursor/rules/frontend-react.mdc`：Bootstrap 5 + 元件級 CSS + `design-system.css`。
- 現況衝突：`admin-minimal.css` 已把後台畫布做成暖石色。這是要收回的漂移，不是要擴大的第二品牌。

行政管理系統要的是資訊密度與操作效率。這一輪不採用大面積漸層、玻璃擬態、發光、行銷式留白或展示型字體。

---

## 1. 現有 UI/UX 問題盤點

### 1.1 四套表面同時生效

| 表面 | 主要檔案 | 畫布 | 主要操作色 | 問題 |
|---|---|---|---|---|
| 全域 | `reservation-frontend/src/styles/design-system.css` | `#f7f9fc` | `#2a5d9f` | 檔案前半與後半互相覆蓋 |
| 公開頁 | `styles/emi-brand.css`、`styles/public-ui.css`、`index.css` | 同學術藍冷灰 | `#2a5d9f` | token 複製成 `--pub-*`、`--home-*` |
| 後台 | `styles/admin-minimal.css`、`components/admin/adminLayout.css` | `#f3f0ea` 暖石 | `#241f1a` 近黑 | 與公開頁不是同一個產品 |
| 成效分析 | `components/learningAnalytics/learningAnalytics.css` | `#faf9f7` | `#2c5282` | 第三組 ink／border／accent |
| 圖表 | `components/charts/chartTheme.js` | — | 藍階 `#2a5d9f`→`#8bb8de` | 相鄰色無法區分 |
| 行銷殘留 | `styles/magic-ui.css` | — | `#111111` 閃光按鈕 | 與學術藍主按鈕並存 |

CSS 載入順序（`src/index.js`）：Bootstrap → `index.css` → `design-system.css`。後台 token 要等 `AdminLayout` 才載入 `admin-minimal.css`。公開頁 token 要等 `PublicLayout` 才載入 `emi-brand.css` 與 `public-ui.css`。同一顆 Bootstrap `.btn-primary` 在三個殼層長得不一樣。

### 1.2 `design-system.css` 自己打自己

`:root`（約第 6–96 行）定義了完整的色、字級、間距、圓角、陰影與 z-index，這是應該保留的契約。

同檔約第 102–360 行又把表格表頭、卡片表頭、Modal 表頭塗成主色藍，並讓所有 `.card:hover` 上移。約第 450–679 行的 “Institutional UI consolidation” 把這些改回中性表面、取消位移。後寫的規則勝出，前半段大多是死規則。之後若有人只改前半段，畫面上不會變。

具體殘留：

- `.card:hover` 陰影用暖色 `rgba(61, 46, 36, 0.045)`，出現在冷色主題裡（約第 576–578 行）。
- 斑馬紋用暖米色 `rgba(247, 246, 243, 0.58)`（約第 619–621 行）。
- `.alert-warning` 文字寫死 `#856404`，沒有用 `--color-warning`（約第 282 行）。
- `.btn` 圓角寫死 `6px`，沒有用 `--radius-*`（約第 482 行）。
- 表單焦點用 `rgba(42, 93, 159, 0.12)` 的 3px 光環，前面又把 `.form-control:focus` 的 `outline` 設成 `none`（約第 221–226 行與第 557–561 行）。全域 `:focus-visible` 因此蓋不過輸入框。

### 1.3 顏色沒有角色

`--color-primary`、`--color-accent`、`--color-info` 目前幾乎是同一個藍。`--color-accent` 設成 `#1c3d6e`，其實是 primary 的深色，不是獨立強調色。

後果：

- 主要按鈕、連結、資訊提示、月曆日期、圖表第一序列、分頁，都在搶同一個藍色。
- 後台把 `.btn-primary` 改成近黑（`admin-minimal.css` 第 69–79 行），公開頁仍是學術藍。使用者換頁時，「最重要的按鈕」換了一種顏色。
- `.badge.bg-primary` 與 `.badge.bg-info` 在後台都被改成同一組粉藍（`admin-minimal.css` 第 237–265 行）。資訊與主要狀態不再可分。
- `StatusBadge` 另用 Bootstrap 色相：成功 `#146c43`、警告 `#856404`、危險底來自 `#dc3545`（`components/ui/statusBadge.css`）。和 `--color-success #2f6f4e`、`--color-warning #9a6700` 不是同一組。

### 1.4 Hardcoded HEX 仍然很多

`src` 內含 `#rrggbb` 的檔案超過 100 個。高風險熱點：

| 位置 | 例子 | 為何有關 |
|---|---|---|
| `pages/admin/LearningAnalyticsOverviewPage.jsx` 約第 266–336 行 | `#94a3b8`、`#2c5282`、`#64748b` | 圖表序列不走 `chartTheme.js` |
| `components/learningAnalytics/charts/*.jsx` | `#2c5282`、`#346538`、`#787774`、`#eaeaea` | 與 `--la-*`、`chartTheme` 各寫各的 |
| `components/learningAnalytics/MicroLearningEngagementPanel.jsx` | `#4f7cac` | 又一個藍 |
| `components/charts/chartTheme.js` | 8 色陣列 | 前四色是同一藍的深淺 |
| `components/ui/statusBadge.css` | Bootstrap RGBA | 狀態元件未接 token |
| `styles/magic-ui.css` | `#111111`、閃光漸層 | 公開頁第二套主按鈕 |
| `index.css` 約第 86–97 行 | `#1c3d6e`、`#f7f9fc` | 沉浸頁漢堡鈕寫死 |
| `utils/classBestepDisplayHelpers.js` 約第 38–45 行 | CEFR 對到 `secondary/info/warning/success/primary/danger` | 等級被畫成語意狀態。C2 使用 `danger`，讀起來像錯誤而不是最高級 |

`index.css` 約第 219–233 行仍把作用中的 tab 塗成主色藍；`design-system.css` 後段又改回白底深字。同等特異性下以後者為準，前者是會誤導維護者的死規則。

### 1.5 間距、圓角、陰影、層級

已有尺度，但頁面多半不走尺度：

- 間距：`--spacing-xs` 到 `--spacing-2xl`（4–48px）。頁面大量直接寫 `0.65rem`、`0.85rem`、`1.25rem`。
- 圓角：token 為 4／8／12／16。按鈕 6px、badge 999px、公開主容器 12px、後台卡片 8px，混用。
- 陰影：token 有四級冷藍陰影。後台幾乎全部 `box-shadow: none`。公開頁另寫 `0 8px 30px`。全域卡片 hover 又用暖陰影。光源方向不一致。
- z-index：token 停在 1000–1070，對齊 Bootstrap。例外包含 `WeeklyHomeModal.css` 的 `9999`、`index.css` skip-link 的 `10000`、`eventHoverCard.css` 的 `5000`。
- 字體：`index.html` 載入 IBM Plex Sans、Noto Sans TC、Noto Serif TC。`--font-family-serif` 實際仍是 IBM Plex Sans，襯線檔被載入但沒進 token。`--font-family-mono` 指向 IBM Plex Mono，頁首沒有載入這個字體。
- 所有 `.card:hover` 與所有 `.btn:hover` 曾被加上位移。後台後來關掉。公開頁的全域 `.btn:hover { transform: translateY(-1px) }` 仍在，次要按鈕與危險按鈕會一起浮起，層級被動效抹平。

### 1.6 按鈕沒有層級

Bootstrap 的 `btn-primary` 被當成「藍色或黑色按鈕」，不是「這個區塊唯一的主要動作」。

後台儀表板（`pages/admin/AdminDashboardProduct.jsx`）本身其實克制：更新是 `outline-secondary`，前往設定與空狀態下一步是 `outline-primary`，重新整理是 `btn-link`。問題出在全域規則把每一種 variant 都做成相近的存在感，以及其他頁面（英檢批次、頁面內容管理、學習有伴報名）同時堆疊多顆 `btn-primary`。

危險操作沒有獨立於 Accent 的按鈕規範。`btn-danger` 沿用 Bootstrap `#dc3545`，與 `--color-danger #b42318` 並存。

全域沒有統一的 `.btn:disabled` 對比處理，只有零星頁面自訂。

### 1.7 無障礙

對比以下用 WCAG 相對輝度計算，門檻為一般文字 4.5:1、大字與非文字 UI 3:1。

| 組合 | 對比 | 判定 |
|---|---|---|
| `#2f3437` on `#f7f9fc` | 11.94:1 | 通過 |
| `#2a5d9f` on `#ffffff` | 6.64:1 | 通過，適合作 Accent 文字或白字按鈕的底 |
| `#6a7176` on `#f7f9fc` | 4.70:1 | 勉強通過，不應再淡 |
| `#6e675f` on `#f3f0ea` | 4.90:1 | 勉強通過 |
| `#9a6700` on `#fff4ce` | 4.42:1 | **未過**。這正是 warning token 與其淺底的組合 |
| `#856404` on `#fff4ce` | 4.99:1 | 通過。alert 寫死這個色，反而比 token 安全 |
| Bootstrap `#ffc107` on `#ffffff` | 1.63:1 | **未過**。`text-warning` 不能拿來顯示「資料可靠度：中」 |
| 白字 on Bootstrap `#0d6efd` | 4.50:1 | 貼著門檻。未覆寫的 Bootstrap 主色比學術藍更危險 |
| 白字 on `#241f1a` | 16.33:1 | 通過 |
| 圖表 `#2a5d9f` 對 `#4a8bc2` | 1.82:1 | **未過** 3:1，相鄰序列分不開 |
| `#6aa3d4` 對 `#8bb8de` | 1.28:1 | **未過** |
| `#8bb8de` on `#ffffff` | 2.10:1 | 作細線或小圖例會消失 |
| 粉藍標籤 `#1f6c9f` on `#e1f3fe` | 4.98:1 | 通過 |
| 粉黃標籤 `#956400` on `#fbf3db` | 4.62:1 | 勉強通過 |

其他可用性問題：

- 輸入框焦點被 `outline: none` 拿掉，改成 12% 透明度的藍環，達不到非文字 3:1。後台表單環更淡：`rgba(17, 17, 17, 0.06)`。
- 按鈕有 `:focus-visible` 輪廓，這部分應保留。
- 有 skip-link（`index.css`）與 `prefers-reduced-motion`（`design-system.css` 約第 681 行）。這兩項不要在換色時弄丟。
- 後台側欄有 `aria-expanded`，作用中項目靠 class，不靠 `aria-current`。視覺上有 pastel active，但鍵盤焦點仍受全域 outline 問題影響。
- 表格的 `table-responsive` 已散落多頁，不是缺一整套。風險在未包覆的寬表與後台橫向 tab（`admin-minimal.css` 的 `.admin-event-detail-tabs`）。
- Loading／Empty／Error 有共用件：`RouteLoading`、`EmptyState`、`AlertDialog`、`ToastProvider`。儀表板有用到。大量頁面仍直接寫 `alert alert-info` 當載入文案，或只用 Bootstrap `Spinner`。
- 圖表多數有 `name` 與 `Legend`，但相鄰藍階仍讓色覺差異使用者無法靠顏色分系列。狀態必須保留文字，不能只靠顏色。CEFR 等級目前被映射到 success／warning／danger，這是語意誤用。

### 1.8 與產品密度衝突的樣式

`magic-ui.css` 的文字掃光、`index.css` 的大面積徑向漸層、公開主容器的 30px 陰影，都偏展示頁。後台 `admin-minimal.css` 的扁平卡片比較接近行政工具，方向是對的，色相不對。

不要把儀表板改成不對稱大標、超大留白或襯線英雄標題。Noto Serif TC 可以留在關於我們、法規等閱讀頁，不進入後台資料介面。

---

## 2. 現有 Design Tokens 與共用元件

### 2.1 已存在、應繼續當唯一來源的 token

檔案：`reservation-frontend/src/styles/design-system.css` 的 `:root`。

| 類別 | 現有名稱 | 現值 | 備註 |
|---|---|---|---|
| 字體 | `--font-family-sans` | IBM Plex Sans, Noto Sans TC | 保留。中文需要 Noto Sans TC |
| 字體 | `--font-family-mono` | IBM Plex Mono… | 名稱保留；字體檔尚未載入 |
| 主色 | `--color-primary` | `#2a5d9f` | 保留為 Accent，縮小使用範圍 |
| 主色深 | `--color-primary-dark` | `#1c3d6e` | 作為 Accent hover |
| 主色淺 | `--color-primary-light` | `#eaf1fc` | 作為 Accent 的安靜底，不是第二個 Accent |
| 假 Accent | `--color-accent` | `#1c3d6e` | 與 primary-dark 重複，Phase 3 再改指向 |
| 畫布 | `--color-bg-primary` | `#f7f9fc` | 基礎色 1 |
| 畫布深 | `--color-bg-secondary` | `#eef2f7` | 凹陷表面 |
| 紙面 | `--color-bg-paper` | `#ffffff` | 基礎色 2 |
| 文字 | `--color-text-primary` | `#2f3437` | 11.94:1，保留 |
| 次文字 | `--color-text-secondary` | `#5a6169` | 5.95:1，保留 |
| 弱文字 | `--color-text-muted` | `#6a7176` | 4.70:1，不要再淡 |
| 成功 | `--color-success` / `-light` | `#2f6f4e` / `#e3f2ea` | 保留 |
| 警告 | `--color-warning` / `-light` | `#9a6700` / `#fff4ce` | 淺底上的文字對比不足，見第 4 節 |
| 危險 | `--color-danger` / `-light` | `#b42318` / `#fdeceb` | 保留，與 Accent 分離 |
| 資訊 | `--color-info` | `#2a5d9f` | 與主色重複。資訊改走中性＋文字，或用更深的藍字配淺底 |
| 邊框 | `--color-border` 系列 | `#d8e0ea` 等 | 保留冷灰藍，不要改暖 |
| 圓角 | `--radius-sm/md/lg/xl` | 4／8／12／16 | 按鈕改吃 `--radius-sm`，不要新開 6px 尺度 |
| 間距 | `--spacing-*` | 4–48px | 作為 `--space-*` 的別名來源，不另造尺度 |
| 陰影 | `--shadow-sm/md/lg/xl` | 冷藍透明 | 後台預設不用；浮層才用 `--shadow-lg` |
| z-index | `--z-dropdown` 到 `--z-tooltip` | 1000–1070 | 例外值應逐步收回 |

Primitive 與 Semantic 今天混在同一層。Phase 3 應在**同一個檔案**裡拆開，而不是新增 `theme-c.css`。

### 2.2 應收斂、不應並存的別名

| 別名 | 檔案 | 處理 |
|---|---|---|
| `--pub-*`、`--home-*` | `emi-brand.css`、`public-ui.css`、`home.css` | 改成指向 `--color-*`，不再寫第二份 HEX |
| `--admin-*` | `admin-minimal.css` | 後台殼層改指向同一份 semantic token。暖石 HEX 列為待淘汰 |
| `--la-*` | `learningAnalytics.css` | 成效頁改吃 semantic token。圖表序列另走 data palette |
| `CHART_PALETTE` | `chartTheme.js` | 保留 JS 出口，改讀與 CSS 同一組 data 色，避免第四份藍 |
| Bootstrap `--bs-*` | 未被覆寫 | 在 `design-system.css` 把 `--bs-primary`、`--bs-danger`、`--bs-success`、`--bs-warning`、`--bs-body-bg`、`--bs-border-color` 指到 semantic token |

Bootstrap 5.3.3 與 react-bootstrap 2.10.9 繼續使用。不引入 Tailwind，不新增元件庫。

### 2.3 共用元件盤點

| 元件 | 現況 | 設計系統應怎麼接 |
|---|---|---|
| Header | `components/Header.js` + `Header.css`。公開頁黏性頂欄，學術藍邊 | 維持。不改成後台側欄 |
| 後台側欄 | `components/admin/AdminSidebar.jsx` + `adminLayout.css` | 殼層色改跟 semantic token。這是全後台共用，不放進第一個視覺試點的色相改動 |
| Footer | `components/home/HomeFooter.js`、`styles/site-footer.css` | 公開頁專用 |
| 版面 | `PublicLayout.js`、`AdminLayout.js` | 學生個人頁走公開殼；`/admin/*` 走後台殼 |
| Button | Bootstrap + 三層覆寫 | 加層級規範，不新做 Button 元件 |
| Card | Bootstrap `.card`，全域 hover 規則過寬 | 靜態卡片不要 hover 位移。可點擊卡片才有 hover |
| Table | Bootstrap + 後台覆寫。多數管理表有 `table-responsive` | 表頭維持中性，不要塗 Accent |
| Form | Bootstrap。焦點對比不足 | 修 focus ring，不改驗證邏輯 |
| Modal | Bootstrap。後台已是白底 | 保持白底。危險確認用 `ConfirmDialog` |
| Alert | Bootstrap + token。warning 對比不穩 | 統一走 semantic 淺底＋深字 |
| Badge | Bootstrap `bg-*`、`StatusBadge`、`.admin-badge` 三套 | 狀態走 `StatusBadge`。CEFR 等級不要再借 danger |
| Empty / Loading | `EmptyState`、`RouteLoading`、`SkeletonCard` | 試點頁只准用這三個，不再用 info alert 假裝載入 |
| Toast / Confirm | `ToastProvider`、`ConfirmDialog`、`AlertDialog` | 不改行為 |
| 圖表 | Recharts 3 + `chartTheme.js`。多處仍寫死 fill | 試點不改圖表。下一階段才收 data palette |
| 儀表板 | 正式路由是 `AdminDashboardProduct`。`AdminDashboard.jsx` 第 1 行註明未掛進 `App.js` | 試點用正式頁 |

學生端預約、活動、問卷、學習歷程各自有頁面 CSS（`student-events.css`、`EventList.css`、`DynamicSurveyModal.css`、`elp.css`、`learningJourneyTimeline.css`）。它們已部分使用 `--color-*`。這一輪不要逐頁改，等 token 契約穩定後再逐區替換寫死色。

---

## 3. 三套候選配色與推薦方案

配色原則：兩種基礎色建立秩序，一種 Accent 只引導主要操作。Accent 飽和度保持可與中性色相處。以下 HEX 都已依白底或所屬畫布檢查一般文字 4.5:1；不能達標的宣傳色已改深，並在評語標出。

### 方案 A — Cream + Ink + Burnt Orange

| 角色 | HEX | 對比 |
|---|---|---|
| 畫布 | `#F6F1E7` | — |
| 表面 | `#FFFCF7` | — |
| 文字 | `#241F1A` | 對畫布 14.4:1 等級 |
| Accent | `#9A3412` | 對白 6.49:1 |
| Accent hover | `#7C2D12` | 更深 |
| 成功 / 警告 / 危險 | `#346538` / `#854F0B` / `#9F2F2D` | 與 Accent 分開 |

評語：最接近現在的後台暖石殼，所以遷移看起來小。但它直接違反「不要引入暖米色範本主色」。焦橙和警告色 `#9A6700` 同屬橙褐，主要操作和警告會互相誤認。不適合同時呈現缺席、未達標、黑名單與截止提示的系統。

### 方案 B — Navy + White + Hot Pink

| 角色 | HEX | 對比 |
|---|---|---|
| 畫布 | `#F7F8FA` | — |
| 表面 | `#FFFFFF` | — |
| 文字 Navy | `#10243F` | 對白 15.60:1 |
| Accent | `#C2185B` | 對白 5.87:1。更亮的 `#E11D74` 只有 4.54:1，不能當小字 |
| Accent hover | `#9D1248` | — |

評語：對校園行政與英檢成績是錯誤的訊號。粉紅像活動宣傳，不像預約、審核、違規與成績。它也會和危險紅搶色相。不採用。

### 方案 C — Charcoal + Sand + Electric Blue

使用者原始方向若直接落地：

| 角色 | 原始傾向 | 問題 |
|---|---|---|
| Charcoal | `#1F2933` | 文字本身沒問題，對淺底約 12:1 以上 |
| Sand | `#F4EFE6` | 暖沙。和公開頁冷灰 `#F7F9FC` 不能同時當「同一產品的畫布」 |
| Electric Blue | `#2563EB` | 對白 5.17:1，勉強可做按鈕白字，但是高飽和的第二個藍。現有學術藍已經是藍 |

把電光藍降成可長期使用的藍、把暖沙改成冷石，方案 C 就會變成下面的方案 D。因此 C 沒有獨立存在的必要。

### 方案 D — Academic Neutral（推薦）

兩種基礎色是已經在公開頁使用的冷中性色。Accent 是已經被規則鎖定、且對比達 6.64:1 的學術藍。不新增品牌色。

| 角色 | Token | HEX | 用途 |
|---|---|---|---|
| 基礎色 1，畫布 | `--color-bg` | `#F7F9FC` | 頁面底 |
| 基礎色 2，表面 | `--color-surface` | `#FFFFFF` | 卡片、Modal、輸入框 |
| 凹陷表面 | `--color-surface-muted` | `#EEF2F7` | 表頭、側欄、次要區塊 |
| 抬升表面 | `--color-surface-elevated` | `#FFFFFF` | 只用陰影與邊框區分，不加新顏色 |
| 文字 | `--color-text-primary` | `#2F3437` | 標題與內文 |
| 次文字 | `--color-text-secondary` | `#5A6169` | 說明 |
| 弱文字 | `--color-text-muted` | `#6A7176` | 中繼資料。不可再淡 |
| 邊框 | `--color-border` | `#D8E0EA` | 預設 1px |
| Accent | `--color-accent` | `#2A5D9F` | 只給主要按鈕、目前位置的細指示、鍵盤焦點 |
| Accent hover | `--color-accent-hover` | `#1C3D6E` | 主要按鈕 hover／active |
| Accent 安靜底 | `--color-accent-subtle` | `#EAF1FC` | 選取列、資訊底。不可當大面積按鈕 |
| 焦點 | `--color-focus` | `#1C3D6E` | 2px 實線，offset 2px。禁止再用 12% 透明環單獨當焦點 |
| 成功 | `--color-success` | `#2F6F4E` | 完成、出席、已通過。淺底 `#E3F2EA` |
| 警告 | `--color-warning` | `#854F0B` | 由 `#9A6700` 加深，讓它在 `#FFF4CE` 上離開 4.42:1 的失敗區。淺底維持 `#FFF4CE` |
| 危險 | `--color-danger` | `#B42318` | 刪除、拒絕、黑名單、破壞性確認。淺底 `#FDECEB` |
| 停用文字 | `--color-text-disabled` | `#8E969C` | 僅搭配禁用樣式，不單獨傳遞狀態 |
| 連結 | `--color-link` | `#1C3D6E` | 比 Accent 深，避免每個連結都像主按鈕 |

警告色從 `#9A6700` 調到 `#854F0B` 是這一方案裡唯一的色值修正，原因是對比失敗，不是為了換風格。Phase 3 試點若要零色差，可以暫時沿用 `#856404`（對淺底 4.99:1），再於全站 token 階段切換。

### 比較

| 準則 | A 奶油＋焦橙 | B 海軍＋粉紅 | C 炭＋沙＋電光藍 | D 學術中性 |
|---|---|---|---|---|
| 符合既有品牌規則 | 否 | 否 | 否，除非拿掉電光藍與暖沙 | 是 |
| 與警告／危險可分 | 弱 | 弱 | 電光藍可分，暖沙破壞秩序 | 強 |
| 行政密度 | 可 | 差，偏活動視覺 | 暖沙偏展示 | 可 |
| 遷移成本 | 後台看起來小，公開頁要整片翻暖 | 全站重刷 | 全站重刷 | 收斂別名，公開頁幾乎不變 |
| 圖表是否被 Accent 綁架 | 會 | 會 | 會 | Accent 不進入資料序列 |
| 建議 | 不採用 | 不採用 | 不作為獨立方案 | 採用 |

### 資料視覺化色盤（不屬於 Accent）

UI Accent 只允許佔資料圖的「需要被比較的那一條」中的一條，例如「目前」對「起點」。其餘序列改色相，不改明度階。

建議資料色，全部可在白底上當粗標線辨識，且相鄰色相不同：

| 序列 | HEX | 角色 |
|---|---|---|
| 1 | `#2A5D9F` | 與 Accent 相同，一個圖最多一條 |
| 2 | `#0F6E6B` | 青綠 |
| 3 | `#854F0B` | 琥珀。不可拿來表示「警告」，圖例必須寫名稱 |
| 4 | `#6D4A8A` | 紫 |
| 5 | `#9F3D2F` | 磚。不可拿來表示「錯誤」 |
| 6 | `#3D5A3A` | 森林 |
| 起點／對照 | `#64748B` | 石板灰，固定當 baseline |

`chartTheme.js` 現有的 `#4A8BC2`、`#6AA3D4`、`#8BB8DE` 應從分類色盤移除。淺色只可做單一序列的面積填色，不可做相鄰類別。

CEFR 等級保持 A1–C2 的文字標籤。若要上色，使用由淺到深的同一藍灰階，並加字母。不要再把 B1 畫成 warning、B2 畫成 success、C2 畫成 danger。這項不在試點範圍，因為 `Badge bg` 被班級與英檢畫面共用，改錯會讓「缺席」和「C2」互換讀法。

每個圖仍須有系列名稱、圖例與座標軸文字。顏色是輔助。

---

## 4. Color Roles 與 Semantic Tokens

Primitive 只放色值。Semantic 只放用途。元件只准使用 Semantic。

```css
:root {
  /* Primitive */
  --primitive-canvas: #f7f9fc;
  --primitive-white: #ffffff;
  --primitive-ink: #2f3437;
  --primitive-ink-soft: #5a6169;
  --primitive-ink-muted: #6a7176;
  --primitive-line: #d8e0ea;
  --primitive-blue: #2a5d9f;
  --primitive-blue-deep: #1c3d6e;
  --primitive-blue-wash: #eaf1fc;
  --primitive-green: #2f6f4e;
  --primitive-green-wash: #e3f2ea;
  --primitive-amber: #854f0b;
  --primitive-amber-wash: #fff4ce;
  --primitive-red: #b42318;
  --primitive-red-wash: #fdeceb;

  /* Semantic */
  --color-bg: var(--primitive-canvas);
  --color-surface: var(--primitive-white);
  --color-surface-muted: #eef2f7;
  --color-surface-elevated: var(--primitive-white);
  --color-text-primary: var(--primitive-ink);
  --color-text-secondary: var(--primitive-ink-soft);
  --color-text-muted: var(--primitive-ink-muted);
  --color-border: var(--primitive-line);
  --color-accent: var(--primitive-blue);
  --color-accent-hover: var(--primitive-blue-deep);
  --color-accent-subtle: var(--primitive-blue-wash);
  --color-focus: var(--primitive-blue-deep);
  --color-success: var(--primitive-green);
  --color-success-subtle: var(--primitive-green-wash);
  --color-warning: var(--primitive-amber);
  --color-warning-subtle: var(--primitive-amber-wash);
  --color-danger: var(--primitive-red);
  --color-danger-subtle: var(--primitive-red-wash);
  --color-link: var(--primitive-blue-deep);

  /* 舊名暫時保留，避免一次改破頁面 */
  --color-primary: var(--color-accent);
  --color-primary-dark: var(--color-accent-hover);
  --color-primary-light: var(--color-accent-subtle);
  --color-bg-primary: var(--color-bg);
  --color-bg-paper: var(--color-surface);
  --color-info: var(--color-link);
  --color-info-light: var(--color-accent-subtle);

  /* Bootstrap 對接 */
  --bs-primary: var(--color-accent);
  --bs-primary-rgb: 42, 93, 159;
  --bs-success: var(--color-success);
  --bs-danger: var(--color-danger);
  --bs-warning: var(--color-warning);
  --bs-body-bg: var(--color-bg);
  --bs-body-color: var(--color-text-primary);
  --bs-border-color: var(--color-border);
  --bs-link-color: var(--color-link);
  --bs-focus-ring-color: var(--color-focus);
}
```

間距、圓角、陰影沿用既有名稱，只加別名：

| 新別名 | 指向 | 值 |
|---|---|---|
| `--space-1` … `--space-6` | `--spacing-xs` 到 `--spacing-2xl` | 4／8／16／24／32／48 |
| `--radius-control` | `--radius-sm` | 4px，按鈕與輸入 |
| `--radius-surface` | `--radius-md` | 8px，卡片與表格 |
| `--radius-overlay` | `--radius-lg` | 12px，Modal |
| `--shadow-overlay` | `--shadow-lg` | 只給 Modal、下拉、抽屜 |
| `--shadow-sticky` | `--shadow-sm` | 只給黏性工具列 |

後台與公開頁的區域別名在過渡期這樣接，不寫新 HEX：

```css
.admin-layout-root {
  --admin-canvas: var(--color-bg);
  --admin-surface: var(--color-surface);
  --admin-surface-muted: var(--color-surface-muted);
  --admin-border: var(--color-border);
  --admin-text: var(--color-text-primary);
  --admin-text-muted: var(--color-text-muted);
  --admin-ink: var(--color-accent);
}
```

`--admin-ink` 今天是近黑按鈕。接到 Accent 之後，後台主按鈕會從黑變成學術藍。這是全後台的視覺變化，**不要放進第一個試點**。試點只在單一頁面使用新的按鈕 class，全站 `--admin-ink` 改指向留到殼層統一階段。

`--warning` 的 Bootstrap 對接要同時設定 `--bs-warning-text-emphasis`，避免 `text-warning` 繼續解析成 `#ffc107`。儀表板上的「資料可靠度：中」今天用 `text-warning`，這是已知對比缺陷。

---

## 5. 按鈕與主要操作的視覺層級

一個操作區域只允許一顆 Primary。頁首的「建立」可以是 Primary；卡片裡的「更新」就是 Secondary。空狀態的下一步若是該區塊唯一出口，可以用 Primary；若頁首已經有 Primary，空狀態用 Secondary。

| 層級 | 何時使用 | 外觀 | 不可以用在 |
|---|---|---|---|
| Primary | 完成這個畫面的主要任務 | 實心 `--color-accent`，白字，圓角 4px，無陰影，hover 改 `--color-accent-hover` | 重新整理、取消、篩選、每一列的檢視 |
| Secondary | 替代動作、導向、更新 | 白底、1px `--color-border`、`--color-text-primary` | 不可使用 Accent 填色 |
| Tertiary | 列內動作、補充連結 | 無框文字，`--color-link`，底線在 hover 出現 | 不可加實心底 |
| Danger | 刪除、拒絕、解除且不可回復 | 實心 `--color-danger` 或危險描邊。確認對話才用實心 | 不可使用 Accent，不可用焦橙代替 |
| Success | 幾乎不做成按鈕 | 只做結果狀態：已儲存、已出席 | 不把「送出」畫成綠色 |
| Disabled | 不可用 | 邊框與文字降到 disabled，不使用 Accent 淺底假裝可點 | 不可只靠顏色，需 `disabled` 與說明 |

互動狀態：

- Hover：只改背景或邊框，150–200ms。禁止 `translateY` 當成全按鈕預設。
- Active：`background` 再深一階。不使用霓虹外光。
- Focus：`outline: 2px solid var(--color-focus); outline-offset: 2px`。輸入框同樣保留這條實線，透明 box-shadow 只能當加強，不能取代它。
- Disabled：維持 Bootstrap `disabled`，對比不足時改邊框色，不把透明度降到看不見文字。
- 圖示按鈕必須有 `aria-label`。試點不新增純圖示主按鈕。

狀態除了顏色，還要有文字：

- 成功、警告、危險的 Alert 與 Badge 保留現有中文標籤。
- KPI 可靠度不可再使用 Bootstrap `text-warning`。改為「中」字加上 warning token 的深字，或乾脆用文字，不靠黃色。
- 黑名單、未填問卷、名額已滿、截止、重複預約的既有文案與出現條件不變。

---

## 6. 建議 Pilot 頁面

**採用 `/admin/dashboard`，元件是 `reservation-frontend/src/pages/admin/AdminDashboardProduct.jsx`。**

路由在 `src/App.js`：`path="dashboard"` 載入 `AdminDashboardProduct`。`AdminDashboard.jsx` 未掛路由，不能拿它試。

選擇理由：

- 它是後台首頁，同時有 KPI 卡、主要／次要／文字按鈕、載入、錯誤、空狀態與清單。足夠檢驗層級，又不含 Recharts。
- 數字來自 `useAdminDashboardProduct` 與 `services/adminDashboardApi.js`。試點不改這兩個檔，公式與資料契約保持原樣。
- 頁面已有測試 `AdminDashboardProduct.test.jsx`，可以確認文案、狀態與連結沒有被視覺改動帶走。
- 成效分析總覽不適合當第一站。`LearningAnalyticsOverviewPage.jsx` 的長條圖顏色代表「起點」與「目前最佳」，CEFR／GSE 的讀法被產品規則分開。先改那裡會把設計實驗和指標解讀綁在一起。
- 匯入中心有約 800 行專用 CSS 與進場動效，回歸面太大。

試點邊界：

- 只加頁面級 class，例如包在 `.admin-dashboard`。
- 在這個 class 裡示範 Primary／Secondary／Tertiary，並修正可靠度文字的對比。
- 不改 `.admin-layout-root` 的暖石畫布。否則一改 token，整個後台一起變色，就不是可控試點。
- 不改側欄、不改權限、不改 KPI 定義、不改空狀態的業務文案。
- 載入狀態改用既有 `RouteLoading` 或卡片內既有 Spinner 的視覺整理，不改請求時序。

試點通過的判準：桌面、平板、手機都能完成「看 KPI、更新一張卡、走一條空狀態連結」；可靠度文字對比達 4.5:1；一個視區內不會出現兩顆同層級的實心 Accent；既有測試仍通過。

---

## 7. 預計修改的檔案與影響範圍

Phase 3 才動程式。現在列出的是下一階段的預期清單。

### 試點會改

| 檔案 | 改什麼 | 不改什麼 |
|---|---|---|
| `src/styles/design-system.css` | 在 `:root` 增加 primitive／semantic 別名與 Bootstrap 變數對接。舊名保留指向。刪除或標成待清的前半段死規則要非常小心，試點可以只加別名、先不刪 | 不重寫全站元件 |
| `src/pages/admin/AdminDashboardProduct.jsx` | 頁面根 class、按鈕 variant 對應層級、可靠度文字 class | 不改 hook、不改數字、不改連結目標 |
| `src/pages/admin/AdminDashboardProduct.test.jsx` | 若 class 或可訪問名稱有變，只更新斷言 | 不放寬測試來配合視覺 |

可能新增一個很小的頁面 CSS：`src/pages/admin/AdminDashboardProduct.css`，只服務 `.admin-dashboard`。不要把試點規則寫進 `admin-minimal.css`。

### 試點明確不改

- `hooks/useAdminDashboardProduct.js`
- `services/adminDashboardApi.js`
- `utils/adminDashboardTodos.js`
- `components/admin/adminLayout.css`
- `styles/admin-minimal.css` 的畫布色值
- `styles/emi-brand.css`、`public-ui.css`
- `chartTheme.js` 與任何 `LearningAnalytics*`
- `App.js` 路由、`adminRouteAccess.js`、`adminNavigation.js`
- 後端全部

### 後續階段才會碰到的熱點

全站按鈕層級、後台暖石收斂、`--pub-*`／`--la-*` 別名、圖表色盤、CEFR badge 映射、`magic-ui.css` 的第二套黑按鈕、`index.css` 與 `design-system.css` 的 tab 衝突、輸入框 focus、`z-index: 9999`。這些都等試點判準通過再排。

影響面判斷：試點 CSS 若確實掛在 `.admin-dashboard`，其他後台頁不會變。若有人把 Accent 改寫進 `.admin-layout-root .btn-primary`，影響範圍會變成整個後台，包含英檢審核、預約管理、問卷與匯入。Phase 3 禁止這麼做。

業務底線：此試點不觸及學生登入綁學號、`cutoffHours`、黑名單、問卷 Gate、`redirectUrl`。儀表板上若有這些狀態的既有提示，只准改呈現 class，不准改出現條件或文案。

---

## 8. 風險、測試與分階段計畫

### 風險

| 風險 | 原因 | 控制 |
|---|---|---|
| 試點變成全後台換膚 | `.btn-primary` 與 `--admin-ink` 是殼層選擇器 | 新規則必須寫在 `.admin-dashboard` 底下 |
| `text-warning` 修正被看成資料語意改變 | 可靠度顏色會從亮黃變成深琥珀字 | 保留「高／中／低」文字，測試斷言對文字，不對色碼 |
| Bootstrap 變數一接，未檢查的頁面跟着變 | `--bs-primary` 會影響進度條、表單勾選、分頁 | Phase 3 可以先不接 `--bs-*`，只在試點頁使用明確 class。全站對接放到 Phase 5 的第一個殼層 PR |
| 刪 `design-system.css` 前半段時打到仍生效的選擇器 | 前後半特異性不完全相同 | 刪除前先在瀏覽器比對公開首頁、預約月曆、後台儀表板 |
| 圖表淺藍被提前替換 | 相鄰對比雖差，但使用者已習慣「藍色長條」 | 試點不改圖 |
| CEFR badge 提前改色 | C2＝danger 是錯的，但班級頁測試可能鎖定 variant | 另案處理，並同步 `classBestepDisplayHelpers` 的測試 |
| 字體替換 | 設計趨勢會建議換 Geist 或襯線標題 | 不換。中文介面已載入 Noto Sans TC，行政密度不適合展示字體 |

### Phase 3 驗證

功能：

- `cd reservation-frontend && npx vitest run src/pages/admin/AdminDashboardProduct.test.jsx src/utils/adminDashboardTodos.test.js`
- 不跑後端測試。此階段沒有後端差異。

瀏覽器，需登入有儀表板權限的後台帳號：

- 桌面寬度：KPI、更新、空狀態連結、錯誤態「查看操作紀錄」。
- 約 768px：卡片改為兩欄時，按鈕不溢出、文字不重疊。
- 約 390px：側欄改為既有手機選單後，儀表板內容仍可直向閱讀。試點不改側欄行為。
- 鍵盤：Tab 到更新、設定、空狀態連結時看得到 2px 焦點環。
- 可靠度「中」的文字對比用瀏覽器檢查，不可再是 `#ffc107`。
- 確認黑名單、問卷、截止等既有警示如果出現在這頁的連結文案裡，文字仍在。

這一階段不做的驗證：不重跑學習成效、不重跑匯入、不把色票擴到學生預約流程。

### Phase 5 漸進導入順序

每一步都是獨立、可回滾的呈現層變更。前一步沒過，不開下一步。

1. **Token 別名落地，零視覺變更。** `design-system.css` 加上 primitive／semantic，舊變數改為別名。快照或計算後的顏色必須與現在相同。警告色加深不放在這一步。
2. **儀表板試點。** 即第 6 節。只動 `.admin-dashboard`。
3. **焦點與警告對比。** 修全域輸入框 `outline: none`，以及 `text-warning`／warning token。這一步影響全站，所以放在試點證明層級規則之後，而且單獨審查。
4. **後台殼層對齊。** 把 `--admin-canvas` 等接到冷中性 token，主按鈕從近黑回到 Accent。同時看側欄、英檢表、問卷 Modal、匯入中心。這是第一次使用者會感到「後台變了」。
5. **公開頁別名。** `--pub-*`、`--home-*` 改指向，不改 HEX。清掉 `magic-ui` 裡與主按鈕競爭的純黑閃光樣式，只留仍被使用且不搶 Primary 的效果。
6. **成效分析與圖表。** `chartTheme.js` 換成第 3 節的資料色盤，再替換各頁寫死的 fill。不改指標計算、不改 CEFR／GSE 定義、不改「接近 B2＝GSE 51–58」。
7. **狀態元件統一。** `StatusBadge` 改吃 semantic token。CEFR 等級改為帶字母的順序色，和出席／缺席的 success／danger 分開。
8. **死規則清理。** 移除 `design-system.css` 前半段已被覆蓋的表格、卡片、Modal 規則，以及 `index.css` 裡不會再生效的 tab 色。最後才做，避免和視覺變更混在同一個 diff。

每步完成後重跑該區既有前端測試，並對該區做桌面與手機瀏覽。不一次修改整個 `src`。

---

## 附錄：關鍵檔案索引

| 用途 | 路徑 |
|---|---|
| 全域 token 與互相覆蓋的元件規則 | `reservation-frontend/src/styles/design-system.css` |
| 載入順序 | `reservation-frontend/src/index.js` |
| 公開頁殘留規則、skip-link、月曆 | `reservation-frontend/src/index.css` |
| 公開品牌 | `reservation-frontend/src/styles/emi-brand.css` |
| 學生／公開 token | `reservation-frontend/src/styles/public-ui.css` |
| 後台暖石主題 | `reservation-frontend/src/styles/admin-minimal.css` |
| 側欄版面 | `reservation-frontend/src/components/admin/adminLayout.css` |
| 後台殼 | `reservation-frontend/src/components/AdminLayout.js` |
| 公開殼 | `reservation-frontend/src/components/layout/PublicLayout.js` |
| 正式儀表板 | `reservation-frontend/src/pages/admin/AdminDashboardProduct.jsx` |
| 未掛載的舊儀表板 | `reservation-frontend/src/pages/admin/AdminDashboard.jsx` |
| 成效總覽與寫死圖色 | `reservation-frontend/src/pages/admin/LearningAnalyticsOverviewPage.jsx` |
| 成效第三套 token | `reservation-frontend/src/components/learningAnalytics/learningAnalytics.css` |
| 圖表色盤 | `reservation-frontend/src/components/charts/chartTheme.js` |
| 狀態 pill | `reservation-frontend/src/components/ui/statusBadge.css` |
| CEFR 誤用語意色 | `reservation-frontend/src/utils/classBestepDisplayHelpers.js` |
| 字體載入 | `reservation-frontend/index.html` |
| 品牌規則 | `.cursor/rules/ui-accessibility.mdc` |
