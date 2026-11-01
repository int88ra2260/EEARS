# F-BESTEP-01

`bestepClassService.js` 的計算沒有改：

- 分子：`passedCount`，有成績且 `score.passed` 的人數。
- 分母：`summary.registeredCount`，學習歷程名冊內、報名成功的本國學生人數。
- 分母大於 0 才做除法並保留兩位；否則回 0。

這兩個母體不是同一組人，所以比例可以是 150。畫面直接顯示 API 的 `passRate`，不截成 100，也不把 0 改成缺值。

卡片標題改為「既有通過人數」，旁邊寫「既有統計口徑」與「尚未核准為官方達標率」。讀法區重述分子、分母與不准拿來下成效結論。

沒有選擇 A／B／C。沒有改匯出公式。沒有新增官方 KPI。`officialUseAllowed` 仍是 false。
