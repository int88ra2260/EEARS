# 輸入契約

程式：`reservation-backend/analytics-contracts/pilots/bestepFileQualityContract.js`。

`parseBestepFileQualityInput` 會複製輸入後再檢查。非法形狀丟出 `ContractRegistryError`，code 為 `BESTEP_FILE_QUALITY_INPUT`。

## 集合

| 欄位 | 粒度 | 未提供 | 空陣列 |
|---|---|---|---|
| `rawFileRows` | 原始成績列 | `not_observed` | 已觀察，0 列 |
| `acceptedScoreRows` | 寫入或擬寫入的成績列 | 同上 | 同上 |
| `skippedImportRows` | 匯入跳過結果，需有 `code` | 同上 | 同上 |
| `currentScoreRecords` | 目前存量列 | 同上 | 同上 |
| `attendanceRows` | 出席項目。`attended` 只能是 true、false 或 null | 同上 | 同上 |
| `projectionRecords` | `exam_attempts` 或 `et_exam_attempts` 的一筆投影 | 同上 | 同上 |
| `registrationPopulation` | `{ availability, successRegistrationCount }` | 不計算覆蓋率 | 不適用 |
| `importHistory` | `{ availability, priorVersions }` | 不能還原重匯 | 不適用 |

`source.sourceFileId` 與 `source.importRunId` 缺值或 null 時不虛構。`importType` 必須是 `bestep_score_import` 才算成績匯入批次。

成績列沿用現有欄位：`listeningScore`、`listeningLevel`，以及 reading、speaking、writing 的同型欄位。`examDate` 可為 null。這與 `BestepExamScore` 及 `importScoreData` 把考試日寫成 null 的行為一致；validator 本身不寫入。

## 三種範圍

- Batch：`rawFileRows`、`acceptedScoreRows`、`skippedImportRows`。
- Current state：`currentScoreRecords`。
- Historical：只有 `importHistory.availability === 'provided'` 才算看過歷史集合。`priorVersions: []` 仍是 `historicalImportQuality: 'not_claimed'`，不是已還原的歷次品質。

投影列需要 `row`。`exam_attempts` 的確認連結沿用 adapter：`sourceRef` 為 `bestep_exam_scores:{數字}`，或 `rawPayload.bestepExamScoreId`。兩者不一致時 adapter 視為衝突。`dateProvenance` 只接受 `stated`、`inferred`、`unknown`。省略時，有日期也不視為已確認的推斷或已確認的陳述。
