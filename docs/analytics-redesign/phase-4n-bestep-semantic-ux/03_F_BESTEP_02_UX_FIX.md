# F-BESTEP-02 出席顯示修正

Phase 4M 確認 `formatAttendanceCell` 在出席物件存在時，用 truthy 判斷把 `null` 畫成「缺席」。後端 `resolveComponentAttended` 仍以 `null` 表示未知。匯出 `getAttendanceExportCell` 對 `null` 留空，這次沒有改匯出。

## 修改

只改 `reservation-frontend/src/utils/classBestepDisplayHelpers.js`。

`attended === true` 顯示「出席」，徽章是 success。`attended === false` 顯示「缺席」，徽章是 danger。其他值，包含 `null` 與 undefined，顯示「未確認」，徽章是 secondary。文字本身不同，不靠顏色單獨區分。版面仍是原本的 L/R 與 S/W 兩列，LR、SW 只有在沒有對應單科時才出現。

`ClassBestepStudentsTable` 仍只把 `student.attendance` 傳入。沒有為了未報名或抵免增加 props。空的出席物件維持「未匯入」，不會顯示「不適用」或「抵免」。表格既有的「抵免項目」欄繼續顯示 `exemptionType`，與出席格分開。

## 沒有改的範圍

後端 controller、service、匯入、analytics contract、統計公式、KPI、資料庫、匯出儲存格、篩選元件與其他班級頁都沒有改。

Finding 的程式與元件測試已完成，所以標成 `implementation_completed`。正式環境驗收與部署尚未進行。
