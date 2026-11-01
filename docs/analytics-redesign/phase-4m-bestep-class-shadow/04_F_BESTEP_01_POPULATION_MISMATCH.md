# F-BESTEP-01 通過率母體不一致

代碼：`PASS_RATE_POPULATION_MISMATCH`。

證據來源是後端公式、欄位契約與合成 fixture。這不是前端測試，也不是 L3 的正式資料驗證。

## 實際公式

`buildClassBestepOverviewStatistics` 裡：

```js
const passedCount = allStudents.filter((s) => s.score && s.score.passed).length;
const passRate = summary.registeredCount > 0
  ? Number(((passedCount / summary.registeredCount) * 100).toFixed(2))
  : 0;
```

`allStudents` 是該班該查詢學期的全部名冊列。`score.passed` 來自四科 CEFR 都存在且每一科至少是 B2。非本國生、報名失敗、沒有成功報名但有成績的列，只要 `score.passed` 為真，就進入分子。

`registeredCount` 來自 `computeClassBestepExportSummary`。它先留下 `isDomesticForStats` 的學生，再排除報名失敗，然後只對 `success` 或 `registered_success` 加一。外籍學生與報名失敗的學生不在分母。

因此這是 `definition_mismatch`：分子與分母的母體定義不同。它不表示每一個班級的公布數字都算錯。母體剛好重疊時，數字可以仍然合理。

## 合成案例

測試直接呼叫匯出摘要函式，再用上面兩行相同的運算。沒有連線 MySQL。

| 案例 | 合成組合 | 結果 |
|---|---|---|
| A 母體重疊 | 兩名本國成功報名，一人通過 | `registeredCount` 2、`passedCount` 1、`passRate` 50。沒有數值異常 |
| B 母體不同 | 兩名本國成功報名、一名本國報名失敗且通過、一名非本國成功且通過 | 分母 2、分子 3、`passRate` 150 |
| C 分母為 0 | 只有一名非本國且通過 | 分子 1、分母 0、公布的 `passRate` 是 0 |

案例 B 是 `observed_numerical_anomaly`：分子大於分母，公布通過率超過 100。案例 C 也是數值異常，但程式把通過率收成 0，不會變成超過 100，也不會變成無限大。

## 尚未決定

正式母體應該是全部名冊、本國成功報名，還是有四科成績的人，仍是業務決策。本階段不改公式，也不新增正式 metric id。
