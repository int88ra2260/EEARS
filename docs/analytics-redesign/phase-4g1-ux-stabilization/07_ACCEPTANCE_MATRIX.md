# 驗收案例狀態

| ID | 內容 | 狀態 | 依據 |
|---|---|---|---|
| G101 | `act(...)` warning 已解決 | PASSED_AUTOMATED | 三次輸出都沒有該 warning |
| G102 | 連跑 3 次無偶發失敗 | PASSED_AUTOMATED | 每次 17 passed |
| G103 | API 數值保持原樣 | PASSED_AUTOMATED | 含 33.33 → `33.3%` |
| G104 | Null / Zero / Error 區分 | PASSED_AUTOMATED | 「—」、`0.0%`、錯誤 alert |
| G105 | 學期切換 | PASSED_AUTOMATED | 請求改為 114-1，載入時清掉 777 |
| G106 | 重新整理 | PASSED_AUTOMATED | 同一學期第二次請求 |
| G107 | Loading 不混用舊數據 | PASSED_AUTOMATED | 載入中沒有 777，完成後顯示 4 |
| G108 | 說明可用鍵盤操作 | PASSED_AUTOMATED | jsdom 的 Enter、Space、Tab。真實瀏覽器 NOT_VERIFIED |
| G109 | B2 補充區展開收合 | PASSED_AUTOMATED | 按鈕 `aria-expanded` |
| G110 | B2 不在核心 KPI | PASSED_AUTOMATED | 核心區找不到該名稱 |
| G111 | Breakdown 不重複加總 | PASSED_AUTOMATED | 類型表一列，沒有 20 |
| G112 | 活動趨勢保留 | PASSED_AUTOMATED | 標題出現。圖形 NOT_VERIFIED |
| G113 | 簽到趨勢保留 | PASSED_AUTOMATED | 標題出現。圖形 NOT_VERIFIED |
| G114 | 班級 Top 10 保留 | PASSED_AUTOMATED | 標題出現。圖形 NOT_VERIFIED |
| G115 | 類型與場次表保留 | PASSED_AUTOMATED | 兩表與「週一桌」 |
| G116 | 114-2 日期 | PASSED_AUTOMATED | 來自 `SEMESTER_RANGES` 的 `2026/02/01–2026/07/31` |
| G117 | 沒有第二份硬編碼學期範圍 | PASSED_AUTOMATED | 頁面與文案檔沒有寫死該日期 |
| G118 | Desktop 不溢出 | BLOCKED | 沒有瀏覽器 viewport |
| G119 | Tablet 不溢出 | BLOCKED | 同上 |
| G120 | Mobile 不溢出 | BLOCKED | 同上 |
| G121 | 窄螢幕表格可閱讀 | BLOCKED | 只確認有 `.table-responsive`，沒有看窄螢幕 |
| G122 | 沒有鍵盤陷阱 | PASSED_AUTOMATED | jsdom 可 Tab 到下一個說明。真實瀏覽器 NOT_VERIFIED |
| G123 | API request shape 不變 | PASSED_AUTOMATED | semester 與 `kind=reservation` |
| G124 | 其他管理分析頁不受影響 | PASSED_AUTOMATED | diff 沒有那些檔。沒有逐頁打開 |
| G125 | 沒有 SQL / KPI / 資料庫變更 | PASSED_AUTOMATED | diff 只有前端測試依賴、頁面與文件 |
