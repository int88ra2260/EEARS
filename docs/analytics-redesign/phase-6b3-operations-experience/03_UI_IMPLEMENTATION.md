# 畫面

沿用既有 Bootstrap Card、Alert、Spinner、Button、表格與圖表。沒有新 UI 套件，也沒有第二個 Dashboard。

## 元件

- `operationsObservation.js`：純函式。輸入學期、日期窗、類型列、兩個既有比率與權限 profile。
- `AdminAnalyticsPage.jsx`：總覽成功後，在 KPI 前渲染 `data-testid="ops-observation"`。標題是「營運觀察」，避免與學期控制的無障礙名稱衝突。
- `activityOpsPresentation.js`：五張既有 KPI 說明各加一行統計單位。原有定義句保留。

## 狀態

- 切換學期或重新載入時先清空總覽、分項與圖表，並顯示 `role="status"` 的載入文字。
- 總覽失敗：紅色 Alert，不渲染觀察，不把錯誤顯示成 0。
- 全部數值為 0：既有次要 Alert 仍在，觀察另寫「各類型預約筆數皆為 0」。
- 分項失敗：類型句為資料不足；總覽 KPI 仍用總覽端點。不把分項錯誤改成 0。

## 篩選

學期與重新整理維持原位。觀察跟同一個 `semester` state。圖表與兩張表沒有改資料來源。

## 無障礙

標題層級沿用頁內 `h2`。KPI 說明是按鈕，`aria-expanded` 與 `aria-controls` 指向說明區，可用鍵盤開啟。連結文字是動作名稱，不是「點此」。空狀態、載入與錯誤各自有文字。顏色不是唯一狀態。

沒有做螢幕報讀器測試，不接受為 Screen Reader Accepted。
