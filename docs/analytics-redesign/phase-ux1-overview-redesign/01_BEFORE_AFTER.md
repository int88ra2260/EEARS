# Phase UX-1 — Before / After

合成 Fixture 與既有 analytics browser harness 相同（`semester=114-2` 正常 payload：預約 48、名額 80、預約名額比 60% 等）。  
截圖目錄（不進正式部署產物）：`reservation-frontend/browser-tests/ux1-artifacts/`。

## 截圖檔

| 視窗 | Before（原始元件） | After（重構後） |
|------|--------------------|-----------------|
| Desktop 1440×900 | `before/overview-desktop-1440.png` | `after/overview-desktop-1440.png` |
| Laptop 1280×800 | `before/overview-laptop-1280.png` | `after/overview-laptop-1280.png` |
| Tablet 768×1024 | `before/overview-tablet-768.png` | `after/overview-tablet-768.png` |
| Mobile 390×844 | `before/overview-mobile-390.png` | `after/overview-mobile-390.png` |
| Mobile 375×667 | `before/overview-mobile-375.png` | `after/overview-mobile-375.png` |

Before 擷取自改版前的真正 `AdminAnalyticsPage`；原始碼另存 `__ux1_baseline__/AdminAnalyticsPage.baseline.jsx`。

## 差異摘要

| 面向 | Before | After |
|------|--------|-------|
| IA | 長說明 → 單一 Card 內：脈絡／觀察／分組 KPI／表 → 圖表在外 | Header → sticky 篩選列 → KPI 優先 → 觀察 → 明細 → 圖表 |
| KPI | 四個小節（供給／需求／簽到／例外），需往下捲 | 五卡同區、字級加大、說明按需展開 |
| Filter | 右上角學期＋刷新，範圍語意分散 | 固定工具列＋「目前範圍」晶片 |
| Observation | 清單＋純文字連結 | 雙欄；行動以卡片呈現 |
| Charts | 標題偏技術 | 補學期脈絡與管理問題一句話 |
| Tables | bordered 較重 | 去重邊框、tabular nums、捲動容器保留 |

## 操作差異

- 進頁先見標題與 KPI，不必先讀長篇治理說明。
- 切換學期／刷新行為不變；Loading 仍清空舊 KPI。
- Drill-down 仍指向既有管理頁（活動列表、簽到、違規、風險、報表）與 Hub。
