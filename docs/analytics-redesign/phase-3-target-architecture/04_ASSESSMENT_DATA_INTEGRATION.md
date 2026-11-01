# 04 測驗來源整合

Phase 2 的事實：Excel 寫入 `bestep_exam_scores`；匯入後非同步寫入 `exam_attempts`；KPI 與歷史最佳只讀 `et_exam_attempts`；快照兩邊都讀，同人＋工具＋日期＋技能時留下 et。D11 未核准。本設計不改這條優先序，也不新增自動合併。

## 三個方案

| | A 保留原表＋統一讀取層 | B 標準化 Assessment Fact | C Adapter＋語意查詢 |
|---|---|---|---|
| 追溯 | 強，讀取層帶 sourceRef | 強，若 fact 存來源鍵 | 強 |
| 重複 | 讀取時標 possible_duplicate，不刪 | 寫入 fact 時就要決 | 查詢時標，不寫回 |
| 衝突 | 兩列都留下，查詢回傳衝突 | 必須有優先序才能只留一列 | 同 A |
| 同日同工具 | 可標候選鍵，不合併 | 易被當成同一場 | 候選鍵只用於警告 |
| 缺考試日 | 無法進入候選鍵 | 會把檔案學期誤當日期 | 拒絕候選鍵 |
| 原始與正規化 | 讀取層同時暴露 raw 與 normalized；現庫 raw 已不存在 | 需要新欄位才接得住以後的原始字串 | 同 A |
| 重匯入 | 原表仍是匯入目標 | fact 要重跑 | adapter 重讀 |
| 更正 | 原表更新，讀取層下次看到 | 要版本 | 同 A |
| 舊資料 | 不搬運 | 搬運風險高，加號已丟 | 不搬運 |
| 效能 | 多一次查詢或視圖 | 查詢快 | 視圖或應用層組裝，與 A 接近 |
| 跨工具 | 讀取層禁止把 CEFR 當分數互換 | 若 fact 只有 CEFR 欄，更危險 | 互換只發生在已標示的 GSE 對照，且不在本層 |

## 建議（PROPOSED）

採用 **C，並把 A 的「不搬運」寫進 C**。不採用 B 作為第一期。B 會逼著在搬運時決定 D11，而且現有加號已經不在庫裡，fact 會把摺疊後的 B2 變成看起來乾淨的標準事實。

C 的做法：

1. 不新建取代原表的事實表。
2. 每個讀取都經過來源 Adapter，輸出統一的 **Assessment Observation** 視圖物件（可以是 SQL view 或應用層 DTO，實作時再選；語意先定）。
3. Observation 永遠帶來源身分。沒有來源身分的列不得進入 DOM-ATTAIN。
4. 候選相同鍵只產生 `possibleSameSitting` 警告。不刪列、不改快照的 et 優先，直到 D11 核准且黃金資料通過。

## Source Identity Contract

```text
sourceSystem: bestep_exam_scores | exam_attempts | et_exam_attempts
sourceRecordId: 該表主鍵
sourceRef: 若 sync 產生，維持 bestep_exam_scores:{id}
importedAt: 可空
fileSemester: 可空
instrumentCode: 正規化後的工具代碼，缺則 UNKNOWN
```

`exam_attempts.sourceRef` 已能指回培力列（Phase 2）。et 列沒有這條 ref。兩條都留著。

## Assessment Identity Contract

一筆觀察是「某人、某工具、某技能、某來源列」，不是「某人的聽力」。

```text
personKey: 正規化學號（trim + upper）。全形合併只在快照寫入時發生，讀取層先不要合併，只在 NFKC 碰撞時標 identityRisk
skill
normalizedCefr: 可空
rawCefr: 現庫多數為空。空要明示 absent，不可把 normalized 填進 raw
rawScore: 可空
assessmentDate: 可空
assessmentDateQuality: observed | imputed | missing
fileSemester: 可空
```

相同考試的**候選**鍵（不足以合併）：

`personKey + instrumentCode + assessmentDate + skill`，且 `assessmentDateQuality=observed`。

缺日期、日期是 imputed、或工具是 UNKNOWN：不產生候選鍵。

## Deduplication Strategy

| 情況 | 行為 |
|---|---|
| 同一 sourceSystem 同一 sourceRecordId | 一筆 |
| 培力列與帶有其 sourceRef 的 exam_attempts | 標 `lineage`，不是重複。KPI 仍不讀這對 |
| 候選鍵相同但來源不同 | `possibleSameSitting`。兩筆都保留。指標計算仍走該指標自己的 SourcePolicy |
| 候選鍵不同 | 不合併 |
| 只有 CEFR 基底等級相同 | 永不視為同一筆或同一量尺 |

指標的 SourcePolicy 預設：

| Metric 族 | 讀取 |
|---|---|
| `bestep.file.*`、行政通過率、有伴差距 | 只讀 `bestep_exam_scores` |
| `roster.pair_pass.*`、`roster.best_skill_*` | 只讀 `et_exam_attempts` |
| 快照投影 | 維持現況（兩表，et 優先）並在 metadata 標 `snapshotDedupe: prefer_et_UNAPPROVED`。這是現況的標籤，不是新決定的優先序 |

`prefer_et_UNAPPROVED` 表示：我們沒有改行為，也沒有承認它是政策。D11 核准前，正式成果不得使用快照格子當達標來源，因此這條默認優先不會進入 Official。

## Conflict Resolution Workflow

1. 偵測：離線或重建時可產出衝突計數（對應 Phase 2 V-06），不改列。
2. 佇列：衝突是一份清單（來源鍵、候選鍵、哪一個欄位不同：分數、等級、日期）。第一期可以是匯出，不必做畫面。
3. 人工：業務選擇「場次以培力表為準、名冊以 et 為準」或「指定一筆作廢」。這就是 D11 的實例，不是工程預設。
4. 套用：只影響被點名的指標版本。不回寫另一張表，除非另有核准的修正流程。
5. 已發布的 Frozen Result 不因衝突處理而改變。

無法安全判定是同一場時，工作流的終點是「兩筆都留、指標各讀各的」，不是合併。

## Data Provenance Model

```text
Observation
  sourceIdentity
  assessmentIdentity
  transformVersion: 例如 bestep normalizeCefrLevel 的程式版本
  transforms: [strip_plus, unmapped_to_null]
  lineage: [upstream sourceRef]
```

正規化是 transform，不是來源。日後若 D10 決定另存原始字串，rawCefr 才開始有值；舊 Observation 的 rawCefr 維持 absent。

跨工具：CEFR 基底等級只能做門檻比較（在該指標已經如此定義時）。原始分不可跨工具運算。GSE 對照是另一個 transform（`2026-v1`），只允許出現在 `snapshot.near_b2_gse` 與成長指標，並帶鈍化註記。不得把 GSE 寫回成對達標。

## 效能與相容

讀取層第一期可以只包在新的查詢函式，舊 API 仍直接打表。這樣回滾就是不呼叫新函式。視圖若建立，必須是唯讀，且不成為匯入目標。

舊資料相容：不回填加號、不把 `exam_attempts` 複製進 `et_exam_attempts`。那會在未決定 D11 時製造第三份真相。
