# 來源身分、版本與投影

程式：`assessmentAdapters.js`、`assessmentObservation.js`、`assessmentSourceRegistry.js`。

## 五種身分

| 概念 | 契約欄位 | 規則 |
|---|---|---|
| Source Record Identity | `sourceIdentity.recordNamespace` | `資料表:主鍵`。缺主鍵則為 null，並標 `UNKNOWN_SOURCE_IDENTITY` |
| Assessment Observation Identity | `observationId` | `obs:資料表:主鍵:技能`。同一列四科是四個觀測 |
| Source Record Version | `sourceRecordVersion` | 呼叫端沒給 `metadata.sourceVersion` 時為 `unknown`。不自造版本號 |
| Import Batch Identity | `importBatchId` | 欄位空著就標 `UNKNOWN_IMPORT_BATCH` |
| Projection Relationship | `upstreamSource` | 只接受對得上的 `sourceRef` 或 `rawPayload.bestepExamScoreId` |

`sourceVersion` 仍保留呼叫端原值；沒給就是 null。對外讀版本用 `sourceRecordVersion`。

## 不會被當成身分的東西

- 分數或 CEFR 相同。
- 姓名。adapter 設 `provenance.nameIgnored`。
- 不同資料表裡相同的數字主鍵。比較時加證據 `table_namespace_differs`，關係停在疑似同場或更弱，不會變成 `same_source_record`。
- 學生比對只用 trim 後轉大寫的學號。NFKC 折疊不同時只記 `identityRisk`，不拿來合併。

## 投影

`readProjection()`：

- `bestep_exam_scores:{id}` 與 payload 的 id 一致，或只有其中一個：`confirmed`。
- 兩個都有但數字不同：`conflict`，不建立 `upstreamSource`。
- 只有 `sourceType=BESTEP`、沒有來源鍵：`unverified`，旗標 `UNVERIFIED_PROJECTION`。

`syncBestepScoresToExamAttempts`（`services/learningJourney/syncService.js`）建立列時寫入 `sourceRef` 與 payload。已存在列若 `syncManualLock` 就跳過；否則只在考試日不同時更新 `examDate`。這段程式沒有改寫既有列的 `sourceRef`。其他更新路徑是否改 payload：`REQUIRES_DATA_VALIDATION`。

成績更新不改變 `recordNamespace` 或 `observationId`。資料庫沒有觀測版本欄時，契約保持 `unknown`。`exam_attempts.updated_at` 存在，但本契約不把它當成版本號。

## 哨兵日期

`resolveBestepExamDate` 在列上沒有考試日、出席日與 `importedAt` 都沒有時，回傳硬編碼 `1970-01-01`（`syncService.js`）。全後端 JavaScript 只有這裡寫死這個日期。

adapter 只在投影狀態為 `confirmed` 時把這個日期從可觀測考試日拿掉，記成 `sync_fallback_sentinel`。手動列，或只有 BESTEP 類型、沒有來源鍵的列，仍保留字面日期。英檢表不套這條規則。哨兵不會被改寫成另一個考試日。
