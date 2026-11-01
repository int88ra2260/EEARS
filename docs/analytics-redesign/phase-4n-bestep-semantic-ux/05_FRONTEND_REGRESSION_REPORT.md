# 前端回歸

Vitest：

```text
npx vitest run src/utils/classBestepDisplayHelpers.attendance.test.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx
```

2 files、7 tests passed。測試渲染真正的 `formatAttendanceCell` 與 `ClassBestepStudentsTable`，沒有另寫一套假的格式化函式。

| ID | 結果 |
|---|---|
| N01 | `true` 顯示出席 |
| N02 | `false` 顯示缺席 |
| N03 | `null` 顯示未確認，不含缺席 |
| N04 | 缺少 `attended` 顯示未確認，不含缺席 |
| N05 | 無出席物件顯示未匯入 |
| N06 | 未報名列的出席格是未匯入，不是缺席 |
| N07 | 核准抵免列的出席格是未匯入，不是缺席或抵免 |
| N08 | 空出席物件不顯示不適用或抵免 |
| N09 | L/R/S/W 與 LR/SW 使用同一套嚴格判斷 |
| N10 | 表頭順序仍是學號、姓名、系所、報考、抵免、個人報名、團體報名、出席、其後為成績與操作 |
| N11 | 成功報名仍顯示報名成功；沒有報名物件仍顯示未報名 |
| N12 | 分頁文字與上一頁、下一頁仍在，下一頁會把頁碼加一 |
| N13 | 學期、考試類型、搜尋與每頁筆數元件仍可渲染 |
| N14 | 匯出按鈕仍呼叫原本的 `onExport`；後端匯出測試另見後端回歸 |
| N15 | 出席、缺席、未確認、未匯入都是可見文字 |
| N16–N19 | 前端測試沒有改 API 或學生物件；後端公式測試確認統計未改 |
| N20 | `true` 與 `false` 的文字維持出席與缺席 |

這三個前端檔案的 ESLint 是 0 errors、0 warnings。`npm run build` 成功，vite 在約 1 分 6 秒完成。

Browser Verification：Pending。`playwright.analytics.config.mjs` 只跑成效分析 Dashboard，沒有班級 BESTEP 頁。這次沒有為一個欄位新增瀏覽器 harness，所以不能寫成 Browser Accepted。
