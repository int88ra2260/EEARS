# 05 快照、截止日與版本

## 快照是什麼

學習成效多數頁讀的不是來源表，而是 `lj_analytic_students` 與 `lj_analytic_exams`。它們由 `rebuildAnalytics` 從 `lj_student_events` 算出來。事件本身由 `projectAllEvents` 從來源表重寫。

```text
來源表
  et_exam_attempts + skill scores
  exam_attempts + skill scores（培力 sync 等）
  activity_participations
  reservations + events
  course_enrollments
  學生／名冊（入學與名冊屬性，不是母體邊界）
        │ projectAllEvents（無 cutoff 日期條件）
        ▼
  lj_student_events
        │ findAll 該批學生全部事件（無 eventDate <= cutoff）
        ▼
  lj_analytic_students / lj_analytic_exams
        │ 只刪除「同一個 snapshotVersion」的列再插入
        ▼
  分析 API 預設最新 version
```

證據：`analyticRebuildService.js` 343–371 行；來源清單 `eventProjectorService.js` 234–270、647–660 行。

## 十個問題

| # | 問題 | 結論 | 狀態 |
|---|---|---|---|
| 1 | 從哪些表來 | 上列。不含問卷、週報、口說、微學習、`bestep_exam_scores` 本表 | VERIFIED |
| 2 | 如何建立 | `projectAllEvents` 後整批計算，`destroy` 同 version 再 `bulkCreate` | VERIFIED |
| 3 | 何時更新 | 培力成績匯入後 `setImmediate` 排程；選課匯入會重建；另有手動 API。不是 cron 本體（本次未找到排程器呼叫 `scheduleGlobalAnalyticsRebuild` 以外的 timer） | VERIFIED 這些觸發；沒有每日排程 UNVERIFIED（未全庫搜 cron） |
| 4 | 匯入後自動重算嗎 | 培力成績會排程。出席匯入函式本次看到的 `importAttendance` 沒有呼叫 promote（controller 70 行起只有成績路徑在 10–28 行呼叫）。只匯入出席不會重建快照 | VERIFIED |
| 5 | 有資料截止時間嗎 | 參數 `cutoffAt` 預設現在，寫入 `derivedAt` 與版本字串。來源查詢沒有用它過濾 | VERIFIED 沒當過濾器 |
| 6 | 保留規則版本嗎 | 有。`RULE_VERSION = lj-analytics-2026-v1` 寫在列上，也寫在版本字串 `rules:` 段 | VERIFIED |
| 7 | 能追溯原始列嗎 | 考試事件有 `sourceSystem`、`sourceRecordId`（投影時）。分析考試列有 `examEventId`。培力 sync 的 `rawPayload` 只有 score id，沒有原始 CEFR 字串 | VERIFIED |
| 8 | 能判斷過期嗎 | 沒有「來源最大更新時間 > derivedAt」的欄位或 API。只能人工比對 | VERIFIED 缺口 |
| 9 | 同一口徑能重算相同結果嗎 | 同一天、同一 build、sequence 固定為 1，版本字串相同，第二次會刪掉第一次的同版列。換日才是新 version。用今天的來源重算，不會等於昨天留下的舊版列 | VERIFIED |
| 10 | 與即時計算母體一致嗎 | 不一致。KPI／歷史最佳是名冊 ∩ `et_exam_attempts`。快照母體是有事件的人。班級是班級成員 ∩ `bestep_exam_scores`。三者沒有共用 WHERE | VERIFIED |

## 四個時間詞

| 詞 | 快照裡實際是什麼 | 不是什麼 |
|---|---|---|
| Generated At | `derivedAt`，預設重建當下 | 不是考試日 |
| Data As Of | 沒有獨立欄位。實務上是重建當下 `lj_student_events` 裡該批學生的全部事件 | 不是 `cutoffAt` 那個日期的 00:00 截止，因為沒有過濾 |
| Metric Version | 列上 `ruleVersion` 與版本字串的 `rules:` | 不是 KPI 政策版本。KPI 不讀這張表 |
| Source Version | 沒有來源批次 id 寫在分析學生列的必填欄位。考試事件 payload 有 attempt id | 不是匯入檔的 hash |

`cutoffAt` 同時被拿去當 Generated At 的原料。不要把它讀成 Data As Of。

## Snapshot Contract Gap Matrix

| 契約需要 | 現況 | 缺口 |
|---|---|---|
| 每次發布留一版不可覆蓋 | 同日同 build 會覆蓋 `...-v1` | 沒有遞增 sequence（程式寫死 1） |
| 可指定「只算到某日的事件」 | 參數存在但不過濾來源 | Data As Of 未實作 |
| 來源更新後標記過期 | 無 | 頁面可能顯示舊覆蓋率 |
| 與名冊達標同一母體 | 否 | 不能用來核對 KPI |
| 規則變更可辨識 | 規則字串會變，舊列還在（若不同日） | 舊列不會自動重算 |
| 重建失敗時的頁面 | job 有 failed 狀態。頁面是否改顯示舊版：PARTIALLY_VERIFIED | 使用者可能不知道失敗 |

## 與即時表的延遲

培力成績路徑是非同步：HTTP 回應可以先成功，sync 與重建在 `setImmediate`。失敗只寫 console（`bestepImportController.js` 30–31 行）。班級頁讀成績表，不受這段延遲影響。快照頁會受影響。KPI 完全不走這段，所以「重建完成」也不會讓 KPI 出現只存在於 `bestep_exam_scores` 的人。

## 可重現性結論

舊的快照列可以回答「那天寫入的聚合」，前提是 version 字串沒被同一天的第二次重建蓋掉，而且沒有別的工作刪版本。它不能回答「若用現在的來源、當初的規則，數字是否相同」，除非把來源也版本化。來源目前沒有版本化。
