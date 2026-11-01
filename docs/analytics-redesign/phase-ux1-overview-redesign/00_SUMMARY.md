# Phase UX-1 — 活動營運總覽 UI/UX 重構摘要

**範圍**：直接重構既有 `/admin/analytics/overview`（`AdminAnalyticsPage`）。  
**非範圍**：未新增第二個 Dashboard；未改 API／Metric Registry／Shadow／權限／導覽；未重構 BESTEP 或 Learning Analytics。

## 實際完成的改善

1. **資訊架構**：Header → 固定篩選工具列 → KPI 一覽 → 營運觀察 → 類型／場次明細 → 圖表 → 報名補充（收合）。
2. **KPI**：五個營運指標同列清楚層級；說明改為按需展開；`englishPassRate` 仍只在補充區。
3. **篩選**：學期 + 重新整理 +「目前範圍」晶片（學期／活動日期）；切換學期仍清空舊數字避免誤讀。
4. **營運觀察**：雙欄（觀察句＋管理行動卡片）；禁止「供給不足」因果文案；保留既有 follow-up 路由。
5. **圖表／表格**：圖表標題補學期脈絡與管理問題；表格改 denser hover、數值靠右、水平捲動容器保留。
6. **視覺**：新增 `AdminAnalyticsPage.css`（Institutional Blue、一致圓角／密度）；未安裝新 UI framework。

## 基準與隔離

- Feature branch：`feature/analytics-ux-redesign-v1`
- Worktree：`D:/EEARS-analytics-ux-v1`
- HEAD 起點：`31383ab`（與當時 `main` 同 SHA）
- Baseline 原始頁面複本：`reservation-frontend/src/pages/admin/__ux1_baseline__/AdminAnalyticsPage.baseline.jsx`
- 本階段變更**未提交**
