# 02 指標語意層

Phase 2 的 32 個 ID 全部保留。本層不合併衝突組。Usage Mode 決定能不能標成正式成果，不改變公式。

## 概念實體

這些是契約物件，不是十張表的指令。

| 實體 | 職責 | 第一階段放哪 |
|---|---|---|
| MetricDefinition | 穩定 ID、領域、單位、不可與誰相減 | Git 上的 registry 模組 |
| MetricVersion | 公式、門檻常數、缺漏政策的不可變版 | registry 內版本字串，例如沿用 `kpi-policy.v1`、`lj-analytics-2026-v1` |
| PopulationDefinition | 分母是誰：預約列、名單、名冊、有成績者、快照 version | registry，執行時把工作集與權限範圍記在結果裡 |
| TemporalContract | Phase 2 的 TC-* | registry |
| AssessmentPolicy | 成對組場、passMode、年級、時間窗 | **資料庫既有政策列**。未核准前不得新增「官方政策」旗標 |
| SourcePolicy | 讀哪張表、身分鍵、衝突時做什麼 | registry 寫「不合併」，D11 核准後才加優先序 |
| MissingDataPolicy | 留在分母或移出 | 與現行程式行為對齊的版本，改動等 D6 |
| EvidencePolicy | 宣稱天花板、必顯示的限制句 | registry |
| AggregationRule | 人去重或列計數 | 寫在 MetricVersion，禁止呼叫端另算 |
| ComparisonEligibility | 可並排的條件 | registry |
| MetricResultMetadata | 一次計算的 ID、版本、母體摘要、as-of、列數、宣稱等級、usage | 監測可先放 API 回應；正式放發布儲存 |

工作集與權限不寫進 MetricDefinition。它們寫進該次 Result 的 `populationScope`，否則同一 ID 會在不同帳號下變成兩個沉默的指標。

## 兩種實作

| | Code-defined registry | Database-backed registry |
|---|---|---|
| 版本 | Git 歷史即版本 | 要另做遷移與鎖定，否則可被畫面改掉 |
| 測試 | 契約測試直接 import | 要種子資料，CI 較脆 |
| 執行期彈性 | 改規則要發版 | 行政可改政策而不發版 |
| 遷移成本 | 低，先包一層不改 SQL | 高，還要決定誰能改 |
| 稽核 | PR | 需要修改紀錄 |
| 授權 | 程式碼審查 | 必須有權限模型，否則教師能改門檻 |
| 維護 | 工程改公式 | 業務與工程易互相覆蓋 |

## 建議（PROPOSED，不是已核准的工具選型）

混合，而且資料庫只放**已經存在**的那種變動：

- Metric ID、時間契約、缺漏政策、宣稱天花板、領域：程式 registry。這些不該在正式環境被改掉而沒有 PR。
- 成對政策的選擇（同日或跨日、CEFR 或合計、年級）：繼續用現有 KPI 政策表。那是 AssessmentPolicy 實例，不是第二套指標字典。
- 發布後的數值與當時的政策快照：發布儲存（`05`），不再回讀「現在的政策列」。

不建議把 32 個公式搬進可編輯的資料表。Phase 2 的錯誤正是名稱相同、公式不同；可編輯註冊表會讓這件事更容易發生。

## 核心指標契約（追溯 Phase 2 ID）

下列只列目標契約裡必須固定的欄位。公式正文以 Phase 2 字典為準，這裡不改數字。

| Metric ID | 領域 | Usage 預設 | 母體 | 時間 | 缺漏 | 宣稱上限 | 正式成果 |
|---|---|---|---|---|---|---|---|
| `ops.event.count` | OPS | Monitoring | 日期學期內活動 | TC-OPS-DATE-SEMESTER | 無法 CAST 的場次不在內 | Descriptive | 可納入營運附錄，不是達標 |
| `ops.reservation.row_count` | OPS | Monitoring | 預約列，含未排除狀態 | 同上 | 無列則 0 | Descriptive | 同上 |
| `ops.reservation.checkin_row_count` | OPS | Monitoring | 已簽到列 | 同上 | 同上 | Descriptive | 同上 |
| `ops.reservation.checkin_row_rate` | OPS | Monitoring | 簽到列／預約列 | 同上 | 分母 0 則空，不顯示 0% 冒充 | Descriptive | 同上 |
| `ops.capacity.reservation_over_seats` | OPS | Monitoring | 預約列／名額加總 | 同上 | 名額 0 則空 | Descriptive | 同上。不是資源效果 |
| `ops.roster.distinct_checkin_students` | PART | Monitoring | 傳入名單 | TC-OPS-DATE-STRING | 無簽到仍留在名單 | Descriptive | 與列指標並列時必須兩欄 |
| `ops.roster.distinct_checkin_rate` | PART | Monitoring | 至少一次簽到／名單人數 | 同上 | 同上 | Descriptive | 同上 |
| `ops.roster.avg_checkin_count` | PART | Monitoring | 簽到次數／名單人數 | 同上 | 零次的人留在分母 | Descriptive | 不是持續參與 |
| `ops.participation.streak` | PART | 無 | — | — | — | — | **Proposed。無實作、無正式欄** |
| `bestep.file.four_skill_cefr_b2` | ATTAIN | Monitoring，Official 等 D1 | 班級 registeredCount | TC-BESTEP-FILE-SEMESTER | 缺等級＝未通過且留在分母（現況，D6 可改） | Comparative to threshold | 在 D1 選它之前不得標 Official |
| `bestep.file.skill_score` / `skill_level` / `skill_reached_b2` | ATTAIN | Monitoring | 培力成績列 | 檔案學期 | 空分是 null，0 是 0 | Descriptive | 單科率沒有獨立分母，不得自製率 |
| `ops.roster.bestep_pass_over_attendance` | ATTAIN | Monitoring | 出席較大者當分母 | 檔案學期＋只認 LR／SW | 出席為 0 則率空，人數仍可顯示 | Descriptive | 不得標成四項達標率 |
| `bestep.file.attendance_lr_sw_avg` | PART | Monitoring | 報名成功 | 檔案學期 | 分項碼 L/R/S/W 不會被計入 | Descriptive | 與班級分項出席分開標 |
| `ops.registration.legacy_has_cefr_b2` | ATTAIN | 不進預設監測 | 報名列 | 報名學期 | 非肯定值算未標記 | Descriptive | 維持 legacy，不升級 |
| `roster.pair_pass.listening_reading` | ATTAIN | Monitoring | 名冊 ∩ 政策年級 ∩ 工作集 | TC-ROSTER-LIFETIME-DEFAULT | 缺科不通過、人留在分母 | Comparative to policy | Official 等 D1、D2、D5 |
| `roster.pair_pass.speaking_writing` | ATTAIN | 同上 | 同上 | 同上 | 同上 | 同上 | 同上。不可與聽讀加總後叫四項 |
| `roster.pair_pass.both_pairs` | ATTAIN | 無 | — | — | — | — | **Proposed** |
| `roster.best_skill_state` | STATE | Monitoring／Explore | 名冊，但時間是查詢當下 | TC-ROSTER-BEST-ASOF-NOW | 無該技能則該格空，人仍在 | Descriptive state | 禁止 Official Attainment |
| `roster.best_skill_rank_b2` | STATE | 同上 | 名冊 | 同上 | 無成績算未達、人在分母 | Descriptive state | 禁止當成學期成果 |
| `snapshot.exam_cell_rank_b2` | STATE | Explore | 快照考試格 | TC-SNAPSHOT-VERSION | 學測排除 | Descriptive | 學生層 b2plusRate 在 Phase 2 仍 PARTIALLY_VERIFIED，不另造 ID |
| `snapshot.near_b2_gse` | STATE | Monitoring 找人 | 快照可換算者 | 快照版本 | 不能換 GSE 的人排除並計數 | Descriptive | 不是達標 |
| `snapshot.gse_raw_delta` | LONG | Explore | 同工具兩梯 | TC-EXAM-SESSION | 單梯排除並計覆蓋 | Longitudinal | 不是成果 |
| `snapshot.gse_adjusted_delta` | LONG 計算、EXPLORE 解讀 | Explore | 有成長對且可回歸者 | 快照版本＋梯次 | 樣本流失必須顯示 | Adjusted，非 Causal | 禁止 Official |
| `snapshot.skill_exposure` | LONG | Explore | 考試格的考前窗 | TC-EXPOSURE-BEFORE-EXAM | 無前一梯時起點未完全驗證 | Descriptive | 不是參與率 |
| `snapshot.growth_episode` | LONG | Explore | 模型產生的段 | 快照／模型執行 | PARTIALLY_VERIFIED | Descriptive | 計數不是效果 |
| `snapshot.resource_effect` | EXPLORE | Explore | 模型樣本 | 快照版本 | 旗標 false | Associational 或 Adjusted | 禁止 Causal，禁止 Official |
| `snapshot.evidence_quality` | GOV 標籤的一種輸入 | Explore | 快照學生 | 快照版本 | 規則未逐條複核 | 不是能力 | 不得外推到培力檔 |
| `trace.micro_learning.30d` | PART | Monitoring | 軌跡事件 | 滾動 30 日 | 不進快照 | Descriptive | 與學期活動分開 |
| `etgroup.gse_snapshot` | STATE | 分組作業 | 分組指派列 | 重算當下 | CAPS 已不是現行模型 | Descriptive | 不是成長 |
| `partner.score_gap` | EXPLORE | Explore | 有成績的有伴與非有伴 | 檔案學期 | 無成績者排除並計數 | Associational | 禁止 Official 成果 |

## 結果詮釋資料（監測回應最小集合）

正式 JSON 欄位名可在實作時微調，語意不可少。

```json
{
  "metricId": "roster.pair_pass.listening_reading",
  "metricVersion": "kpi-policy.v1",
  "usage": "monitoring",
  "official": false,
  "policyKey": "pair-bothcefr-samedate-g24",
  "temporalContract": "TC-ROSTER-LIFETIME-DEFAULT",
  "population": {
    "kind": "enrollment_snapshot",
    "semesterId": "114-2",
    "grade": "g24",
    "workingSet": null,
    "denominator": 1200
  },
  "value": { "numerator": 400, "rate": 0.3333 },
  "claimCeiling": "comparative_to_policy",
  "limitations": ["lifetime_attempts", "not_this_sitting", "cefr_plus_collapsed"]
}
```

`official: false` 在 D1 核准前對所有達標 ID 都是安全預設。監測仍可回傳 `value`，與今天的頁面數字相容。

## 比較資格

同一張圖要並排，必須：

1. Metric ID 相同。
2. Metric Version 相同。
3. Temporal Contract 相同，且參數可對齊（兩個日期學期，或兩個檔案學期）。
4. Missing Data Policy 相同。
5. 若是成對，政策鍵相同。

否則 API 應拒絕該比較，而不是回兩個數讓前端自己畫。這條是契約測試的核心，見 `11` WP-1。
