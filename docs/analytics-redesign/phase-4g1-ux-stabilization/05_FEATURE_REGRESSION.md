# 功能回歸

資料都是測試 fixture。Recharts 在測試中被換成不畫圖的元件，因此圖表只核對標題與空狀態文字，沒有核對像素或座標。

| 項目 | 自動化結果 | 範圍 |
|---|---|---|
| 活動總名額、預約筆數、預約名額比、預約列簽到率、預約列違規狀態比 | PASSED_AUTOMATED | 顯示 API 原值 |
| `bookingRate: 33.33`，預約 1、名額 100 | PASSED_AUTOMATED | 顯示 `33.3%`，不是 `1.0%` |
| null 與 0 | PASSED_AUTOMATED | 「—」與 `0.0%` 不同 |
| API error | PASSED_AUTOMATED | 顯示錯誤文字，沒有 `0.0%` |
| 全 0 | PASSED_AUTOMATED | 顯示 0，並出現「皆為 0」 |
| 學期切換 | PASSED_AUTOMATED | 下一輪請求帶新學期；載入時不留 777 |
| 重新整理 | PASSED_AUTOMATED | 同一學期再請求一次，數字回到 API 值 |
| 類型表與場次表 | PASSED_AUTOMATED | 各出現一次；沒有把兩份分項加總成 20 |
| 活動趨勢、簽到趨勢、班級 Top 10 | PASSED_AUTOMATED | 三個標題在資料回來後出現。圖形本身 NOT_VERIFIED |
| 空圖表 | PASSED_AUTOMATED | 出現文字「尚無足夠資料產生圖表」 |
| B2 補充區 | PASSED_AUTOMATED | 不在核心 KPI；展開後看得到 12.5% 與未 JOIN 說明 |
| 請求參數 | PASSED_AUTOMATED | overview 仍是 `kind=reservation`，其餘端點參數未改 |
| 其他分析頁 | PASSED_AUTOMATED | 本階段 diff 沒有那些頁面。沒有逐頁渲染 |
| SQL / KPI / 資料庫 | PASSED_AUTOMATED | diff 沒有後端檔 |

真實瀏覽器裡的圖表、表格捲動與版面是 `BLOCKED`。
