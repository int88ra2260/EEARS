# 響應式問題

沒有在真實 viewport 重現排版問題，所以沒有改 Grid、沒有新增 CSS 檔，也沒有改全站樣式。

## 既有保護

- KPI 欄位維持 `col-12 col-sm-6 col-xl-4`。
- 學期選單容器是寬度 100%、`max-width: 220px`。
- 類型表與場次表都包在 `.table-responsive`。場次表另有直向 `max-height: 420px`。
- 數字節點加上既有 Bootstrap class `text-break`，讓長數字可以在卡片內換行。這不是針對已看見的溢出所做的修正。

## 自動化只確認到

- 核心區有 `col-12`。
- 兩張表有橫向捲動容器。
- 表頭文字存在。

窄螢幕是否真的不溢出、表格是否好讀，狀態是 `BLOCKED`。見 `02_BROWSER_ACCEPTANCE_MATRIX.md`。
