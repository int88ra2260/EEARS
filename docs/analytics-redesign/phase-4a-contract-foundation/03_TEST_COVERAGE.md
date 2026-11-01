# 測試涵蓋

指令（於 `reservation-backend`）：

```text
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts tests/surveyAnswerKeyRegistry.test.js
```

結果：eslint 通過。Jest 3 個 suite、15 個測試通過。沒有連正式資料庫，沒有使用真實學生。

回歸用既有 `tests/surveyAnswerKeyRegistry.test.js`。它不載入分析 SQL。沒有跑全後端 suite，因為全 suite 會經 teardown 碰資料庫，而且本階段沒有改那些模組。

## registryIntegrity.test.js

- `validateRegistry()` 的 `errors` 為空。
- 32／9／7／11 的數量，決策門全部 pending，沒有 approved。
- Metric ID 與 Temporal ID 唯一。
- 未知 ID 丟 `ContractRegistryError`。
- 兩個未實作指標維持未實作，且 `legacyActive` 為 false。
- 映射裡的 Metric ID 都存在；同時有 verified 與 unmapped。

## semanticAndGolden.test.js

- 三種出席率互比為 `incompatible`。
- 四項達標、成對、歷史最佳、快照格互比為 `incompatible`。
- 同一成對 ID 缺 `policyKey` 為 `undetermined`；兩個不同 `policyKey` 為 `incompatible`。
- 歷史最佳拒絕 As-of，且限制含 `not_single_sitting`。
- 快照契約含 `generated_at_is_not_data_as_of`。
- 有伴差距、資源效果、校正成長的 `causalClaimAllowed` 為 false。
- G01–G15 的 caseId 齊全，並用登錄斷言來源、限制與正式宣稱拒絕。

## 合成情境對到什麼

| Case | 斷言 |
|---|---|
| G01 | 成對指標掛 `TC-ROSTER-LIFETIME-DEFAULT`。多次測驗不會在這裡被收成最近一次 |
| G02 | 該指標的 As-of 為 unsupported |
| G03 | `both_pairs` 仍是 not_implemented |
| G04 | 前後梯差與成對指標比較為 undetermined；限制含 `same_instrument_only` |
| G05 | 等級指標限制含 `plus_collapsed` |
| G06 | 四項指標限制含 `missing_level_counts_as_fail` |
| G07 | 歷史最佳 As-of 為 unsupported |
| G08 | 培力檔契約限制含 `import_time_is_not_assessment_time` |
| G09 | 列簽到率與名單參與率 incompatible |
| G10 | 四項只列 `bestep_exam_scores`；成對只列 et 表，不列培力成績表 |
| G11 | 快照產生時間不是資料截止 |
| G12 | 成對指標 legacyActive 仍不能正式宣稱 |
| G13 | 監測值與凍結值不相等，且列計數也不能正式宣稱。沒有發布儲存 |
| G14 | 有伴差距是 associational，且不允許因果 |
| G15 | streak 與 both_pairs 的正式宣稱為 not_implemented 或不允許 |

## 未涵蓋

- 沒有對真實列做學期、工具、日期或重複成績比對。
- 沒有重跑 KPI、快照重建或匯入。
- 沒有把 G13 做成發布版本庫。
- 問卷、週報、口說只有 unmapped 登錄，沒有公式測試。
- `ambiguous` 狀態沒有樣本，因為本階段沒有把任何入口標成語意不明。
