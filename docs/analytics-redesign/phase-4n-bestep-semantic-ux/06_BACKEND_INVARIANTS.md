# 後端不變

`reservation-backend/services/bestepClassService.js` 在本階段沒有修改。`bestepClassPassRateDecision.test.js` 讀取原始碼，確認仍是：

```js
const passedCount = allStudents.filter((s) => s.score && s.score.passed).length;
```

以及 `passedCount / summary.registeredCount`，分母為 0 時為 0。`domesticStudentCount` 仍是 `summary.enrolledCount`。`attendanceRate` 仍由 `computeClassBestepExportSummary` 計算。`isPassed` 仍在 `bestepImportService.js`，要求四個有效 CEFR 且都達 B2。

150% 合成案例仍在。Phase 4M 的 `bestepClassAnalyticsShadow.test.js` 與本階段決策測試都期待 Legacy `passRate` 150，沒有把案例改成不超過 100。

SQL、Sequelize 查詢、controller、匯入與 shadow runtime 沒有為了這次 UX 而修改。治理數量仍是 32 個 metric、9 個 temporal contract、7 個 domain、D1–D11 pending、2 個未實作指標。四個治理旗標維持 false。沒有新增 source priority，也沒有做來源去重。
