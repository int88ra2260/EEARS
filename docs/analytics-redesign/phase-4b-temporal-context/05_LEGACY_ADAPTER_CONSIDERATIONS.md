# 以後接入舊 SQL 的限制

`toSafeQueryBoundaries` 只描述邊界。`safety` 固定為：

- 不允許把值拼進 SQL 字串
- 不允許動態表名或欄位名
- 不允許自動產生 Sequelize `where`
- 不允許改既有報表查詢

Adapter 以後若要使用這些邊界，必須自己寫死契約對應的欄位，並沿用該契約已經驗證過的比較方式。

## 不能直接套用的地方

| 現況 | 接入時要分開處理 |
|---|---|
| `TC-OPS-DATE-SEMESTER` 的 CAST 含尾日 | 半開的 `endExclusive` 不能原樣塞進現有的 `BETWEEN ... AND :end` |
| `TC-OPS-DATE-STRING` 的字串 `BETWEEN` | 與 CAST 窗即使瞬間相同也是 incompatible。字串尾碼仍可能漏列 |
| `kpiService.buildKpiContext` 組了 `00:00:00` / `23:59:59` 但查詢沒用 | 不要把那兩個未使用變數當成已經定義的時間精度 |
| 培力檔案學期 | 標籤不是考試日，不能拿學期起日去濾 `examDate` |
| 名冊成對的 lifetime | `rosterSemester` 只標分母。沒有另外給 `dateRange` 時，不能加上考試日過濾 |
| 歷史最佳 | 沒有 as-of 參數可填。不能把 `asOfDate` 寫進 `testDate <=` |
| 快照 `cutoffAt` / `derivedAt` | 只能當版本或產生時間。不能當成來源列的截止過濾 |
| `et_semesters` 資料表 | 這次沒讀。不能假設它與 `shared/semesterConfig.js` 相同 |

`adaptLegacyTimeFields` 的欄位清單是白名單。新欄位要先加白名單，不能依名稱結尾是 `At` 或 `Date` 自動歸類。
