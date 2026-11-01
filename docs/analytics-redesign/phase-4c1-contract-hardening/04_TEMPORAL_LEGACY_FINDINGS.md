# 日期與學期差異

這些結論來自靜態閱讀與既有 JavaScript 合成測試。它們沒有證明 MySQL 查出來的筆數。

## 學期邊界

`shared/semesterConfig.js` 的 `114-2` 是 `2026-02-01` 到 `2026-07-31`，尾日含在內。`semesterBoundaryAdapter.halfOpenFromConfiguredSemester` 轉成台北時間半開區間：起點 `2026-02-01T00:00:00+08:00`，終點 `2026-08-01T00:00:00+08:00`。不在表上的學期代碼不會用月曆補日期。檔案上的學期標籤也不會被展開成考試日。

`models/EtSemester.js` 的 `startDate`、`endDate`、`snapshotDate` 都可空。契約 adapter 不讀這張表。表內日期與程式設定是否一致：`REQUIRES_DATA_VALIDATION`。

## 既有 SQL 的日期型別

- `services/kpiService.js` 先組了 `00:00:00` 與 `23:59:59` 字串，實際綁定的是 `range.start` 與 `range.end`，條件是 `e.date BETWEEN`。
- `services/analyticsService.js` 註明 `events.date` 是字串，查詢用 `CAST(TRIM(date) AS DATE)` 的含尾日區間。
- 英檢自然鍵用 `COALESCE(examDate, testDate)`，欄位是 DATEONLY。
- JavaScript 字串比較 `'2026-07-31 18:00:00'` 與尾日 `'2026-07-31'` 會落在字串區間外，同一個台北時間瞬間仍在半開區間內。這只驗證 JS，不驗證 MySQL。既有測試在 `tests/analytics-contracts/legacyTemporalBoundary.test.js`。

## et 的兩個日期

| 寫入 | 函式 | 寫進哪一欄 |
|---|---|---|
| 匯入 | `examAttemptImportService` | `testDate`。表頭別名含 `examDate`，仍寫入 `testDate`。技能進 `et_exam_attempt_scores` |
| 追蹤建立 | `examAttemptService.create` | `examDate`。技能進 `et_exam_attempt_skill_scores` |
| 歷史最佳 | `bestSkillService.getStudentBestSkillsWithSource` | 讀 `testDate || examDate`，技能只看 `skillScores` |
| 列表排序 | `examAttemptService` | 查詢依 `examDate`，記憶體再以 `examDate || testDate` 排 |
| 去重 | `buildCanonicalAttemptWhere` | `COALESCE(examDate, testDate)` |

三處順序不同。契約在兩欄都有值且不同時，`assessmentDate` 為 null，`dateProvenance` 為 `columns_disagree`，`officialAssessmentDate` 為 `unknown`，兩欄原文留在 provenance。只有一欄時，使用那一欄的字面日期，並在 provenance 標出欄名。這不表示該欄已被核定為正式測驗日期。

## 1970-01-01

`syncService.resolveBestepExamDate` 的最後退路回傳這個字串。順序是：培力列 `examDate`、LR 出席日、該學期最晚出席日、`importedAt` 的 ISO 日期、然後才是哨兵。

契約規則只適用 `exam_attempts` 且投影已確認的列。沒有這條鏈的 `1970-01-01` 保持原樣。歷史匯入或其他表是否出現這個日期：`REQUIRES_DATA_VALIDATION`。若有人在已確認投影上手動把考試日改成這一天，也會被標成哨兵；這個邊界記在開放問題。
