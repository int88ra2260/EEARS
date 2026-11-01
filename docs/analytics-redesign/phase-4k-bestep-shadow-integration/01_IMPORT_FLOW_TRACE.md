# 成績匯入路徑

目標路由：`POST /api/admin/bestep/scores/import`。

| 步驟 | 位置 | 實際行為 |
|---|---|---|
| Router | `routes/bestepRouter.js` `router.post('/scores/import', ...)` | `englishTestDomainMiddleware`，接著 `upload.single('file')`，再進 `importScores`。本階段沒有改這行 |
| Controller | `controllers/bestepImportController.js` `importScores` | 檢查 file 與 semester。缺檔或學期回 400。呼叫 `importScoreData(file.path, semester)` |
| 解析 | `services/bestepImportService.js` `importScoreData` | `XLSX.readFile` 後 `sheet_to_json`。整份列在變數 `rows` |
| 驗證與配對 | 同一個 for 迴圈 | `getFieldValue` 讀欄位。學號空為 `MISSING_STUDENT_ID`。`findRegistrationForSemester` 找不到 `status=success` 為 `STUDENT_NOT_FOUND`。分數與等級不合則跳過 |
| 寫入 | `BestepExamScore.upsert` | 同一 transaction。`examDate` 寫入 null。CEFR 先經 `normalizeCefrLevel`。一列錯誤被該列的 catch 收成 `PROCESSING_ERROR`，不讓整批在該列中斷 |
| Transaction | `sequelize.transaction()` | 迴圈結束 `commit`。外層失敗 `rollback` 後把錯誤丟出 |
| 回傳 | `outcome` | `imported`、`skipped`、`errors`、`importBatchId`、`sourceFile` |
| Controller 組回應 | `res.json` | 另含 `success`、`errorFileUrl`、`analyticsPromoteScheduled`、`analyticsPromoteHint`。`errors` 仍帶既有的學號與姓名 |
| 同步 | `scheduleBestepScoreAnalyticsPromote` | 只在 `imported > 0` 時 `setImmediate`。裡面才 `runSync({ sections: ['bestep_scores'] })` 與 `scheduleGlobalAnalyticsRebuild`。不是在 request 裡 await |

沒有 streaming。Excel 先整份進記憶體，這是既有行為。Shadow 不再讀一次檔，也不再呼叫 `findRegistrationForSemester`。

Hook 不在 controller。controller 手上沒有 `rows`。放在 commit 成功之後，是業務寫入已經確定、回傳物件尚未被改寫的位置。`importScores` 仍用同一個 `outcome` 組 JSON。
