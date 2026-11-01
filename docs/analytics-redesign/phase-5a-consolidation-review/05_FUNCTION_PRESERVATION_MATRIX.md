# 既有功能保全

對照程式與本階段測試，不是對照舊文件的計畫。

## 活動營運

`AdminAnalyticsPage` 仍讀 reservation overview。Vitest `AdminAnalyticsPage.test.jsx` 17 項通過，涵蓋 API 數字、學期切換、重新整理、圖表、表格、null 不當成 0、類型表不加總成第二個總數。

`englishPassRate` 在 `activityOpsPresentation.js` 的標籤是「報名資料 B2 標記比例」，渲染在補充區，不在核心 KPI。瀏覽器 H05 鎖定畫面使用 API 原值。

預約列與不重複學生仍是不同欄位。取消後的現存列沒有被改成歷史全部預約；本階段沒有改 SQL。

資源供給、預約需求、出席、行政例外、類型分布、容量分布、趨勢、原表格、學期篩選與重新整理都還在頁面測試路徑上。沒有新增匯出按鈕（測試 U18）。

## BESTEP

本分支沒有移除個人報名、團體報名、成績匯入、出席匯入、名單、班級總覽、成績表、匯出、四技能分數與 CEFR、抵免欄、到考狀態、KPI、Learning Journey、同步或晉用。Shadow 測試斷言出席匯入、報名與 KPI 不含檔案品質 hook。

班級頁仍呼叫既有 `GET /api/admin/classes/:classId/bestep-overview`。統計卡使用 API 的 `passRate`，前端不重算。

出席顯示（`classBestepDisplayHelpers.js`）：

- `true` → 出席
- `false` → 缺席
- 有出席結構但不是布林 → 未確認
- 空物件或沒有 L/R/S/W/LR/SW → 未匯入

格式化函式沒有報名參數，所以不會把空值猜成「不適用」或「抵免」。抵免仍在抵免欄。匯出對 null 仍是空白，與畫面的「未確認」不同；這是已知落差，本階段沒有改匯出。

總分：`ClassBestepStudentsTable.jsx` 只把 `null` 與 `''` 顯示成 `-`。數字 0 顯示 0。單元測試要求列文字含「總分: 0」且不含「總分: -」。

`passRate`：`bestepClassService.js` 仍是 `registeredCount > 0 ? round(passedCount / registeredCount * 100, 2) : 0`。決策測試確認服務程式沒有 `candidateRate` 或 `optionA`。合成案例 Legacy 150%（3/2）仍可出現。F-BESTEP-01 維持 `decision_pending`。

F-BESTEP-02 的畫面修正在本分支與瀏覽器測試中成立。`main` 還沒有這個提交，所以不能說正式環境已更新。
