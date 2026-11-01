# Recharts 實測

Vitest 仍把 Recharts mock 成空元件。本階段的圖表證據來自 Chromium 裡的真實 `ResponsiveContainer`、`LineChart` 與 `BarChart`。

等待條件是 `.recharts-surface` 至少 3 個，且第一個 `.recharts-wrapper` 寬度大於 40。沒有使用固定 sleep。

## 實測尺寸

`container-fluid` 既有 `max-width: min(100% - 1.5rem, 1200px)`，所以 1440 與 1280 的內容寬度相同。

| Viewport | 活動趨勢 | 簽到趨勢 | 班級 Top 10 | 整頁橫向溢出 |
|---|---|---|---|---|
| 1440×900 | 528×320 | 528×320 | 1120×340 | 0 |
| 1280×800 | 528×320 | 528×320 | 1120×340 | 0 |
| 768×1024 | 680×320 | 680×320 | 680×340 | 0 |
| 390×844 | 318×320 | 318×320 | 318×340 | 0 |
| 375×667 | 303×320 | 303×320 | 303×340 | 0 |

三張圖都有 SVG。viewBox 沒有負寬度。座標軸刻度沒有超出圖卡。軸上看得到 fixture 的 `03/02` 與 `班01`。游標移到長條後，tooltip wrapper 為可見。

沒有 `width(-1)`，也沒有 ResizeObserver 或 ResponsiveContainer 造成的 console error。

Zero 與 Null fixture 不畫這三張圖，改顯示「尚無足夠資料產生圖表」。這是既有空狀態，不是渲染失敗。
