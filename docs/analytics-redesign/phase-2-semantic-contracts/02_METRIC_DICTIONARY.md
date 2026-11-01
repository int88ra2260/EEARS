# 02 候選指標字典

Metric ID 是契約草案，不是中心已核准的定義。`Evidence Level` 用 Phase 2 的四種狀態，不代表評估方法等級（方法等級見 `07`）。

Alias：同計算、不同顯示名。Conflict：同中文、不同計算，禁止共用 ID。

## Alias Map

| Alias | Canonical ID | 說明 |
|---|---|---|
| 名額利用率、bookingRate | `ops.capacity.reservation_over_seats` | S1-A |
| 簽到率（營運 SQL） | `ops.reservation.checkin_row_rate` | 列對列，不是人 |
| 參與率（行政 KPI） | `ops.roster.distinct_checkin_rate` | 人對名單 |
| 四項都達 B2、班級 passed | `bestep.file.four_skill_cefr_b2` | 匯入布林 |
| 認證通過率、歷史最佳 B2+ | `roster.best_skill_rank_b2` | 名稱超過資料 |
| 接近 B2、舊稱 B1+ | `snapshot.near_b2_gse` | 路由仍是 b1-plus |
| 校正後成長、修正成長、adjustedGseGrowth | `snapshot.gse_adjusted_delta` | 不是 CAPS |
| 聽讀達標／說寫達標（KPI 頁） | `roster.pair_pass.listening_reading`／`speaking_writing` | 規則隨政策變，ID 仍要加政策鍵才能當正式數 |

## Conflict Map

| 中文 | 衝突的 ID | 差在哪 |
|---|---|---|
| 出席率 | `ops.reservation.checkin_row_rate`、`bestep.file.attendance_lr_sw_avg`、`bestep.class.attendance_by_item` | 分母分別是預約列、報名成功人數、班級篩選後的人；培力行政只認 LR／SW |
| 達標率 | `bestep.file.four_skill_cefr_b2`、`ops.roster.bestep_pass_over_attendance`、`roster.pair_pass.*`、`roster.best_skill_rank_b2`、`ops.registration.legacy_has_cefr_b2` | 五個分母或門檻 |
| B2+ | `roster.best_skill_rank_b2`、`snapshot.exam_cell_rank_b2` | 都是 rank≥4，母體不同；都不是未剝加號的 B2+ |
| 學期 | 見 `04`，不設單一 `semester` 指標 |

## Dependency Map

```text
bestep.file.four_skill_cefr_b2
  ← bestep.file.skill_level（正規化後）
  ← 匯入 isPassed
  → ops.roster.bestep_pass_over_attendance（同一布林，分母改出席）
  → partner.score_gap（同一布林的通過率差）

roster.pair_pass.*
  ← et_exam_attempts only
  不依賴 bestep.file.*

roster.best_skill_rank_b2
  ← 同一 et 表，但是最高 rank，不是成對

snapshot.*
  ← lj_analytic_* 
  ← et 與 exam_attempts 投影（et 優先）
  不依賴 KPI 政策

ops.reservation.*
  不依賴任何達標 ID
```

---

## 活動與資源使用

### ops.event.count

- Display Name: 活動場次
- Business Question: 這個日期學期有幾場活動被納入名額
- Definition: `SEMESTER_RANGES` 內、進入容量查詢的 `events` 列數
- Analysis Unit: 活動
- Population: 日期可 CAST 且落在區間的活動
- Numerator / Denominator: NOT_APPLICABLE（計數）
- Source: `events`
- Time Model: `TC-OPS-DATE-SEMESTER`
- Attempt Selection / Deduplication: 一列一場。同一活動多個預約不重複計場次（容量 SQL 先依活動 id 聚合，PARTIALLY_VERIFIED 599–617 行）
- Threshold: NOT_APPLICABLE
- Missing Data: 日期無法 CAST 的場次不在區間內
- Version: 無獨立規則版本
- Evidence Level: PARTIALLY_VERIFIED
- Known Limitations: 與「有人預約的場次」可能不同，若 SQL 從 events 起算
- Current Implementations: `getReservationCapacityBreakdown`

### ops.reservation.row_count

- Display Name: 預約人次（列）
- Business Question: 區間內有多少筆預約
- Definition: `COUNT(*)` from reservations join events，日期在區間
- Analysis Unit: 預約列
- Population: 見 S1-A。不排除取消
- Numerator / Denominator: NOT_APPLICABLE
- Source: `reservations`、`events`
- Time Model: `TC-OPS-DATE-SEMESTER`
- Deduplication: 不去重學號、不去重活動
- Missing Data: 無
- Version: 無
- Evidence Level: VERIFIED
- Known Limitations: 一人多場、取消單都會計入，除非狀態另濾（目前沒濾）
- Current Implementations: `getReservationOverview` 444 行

### ops.reservation.checkin_row_count

- Display Name: 實際出席人次（簽到列）
- Definition: 上列中 `checkinStatus = '已簽到'` 的列數
- Analysis Unit: 預約列
- Population / Time / Source: 同 `ops.reservation.row_count`
- Numerator / Denominator: NOT_APPLICABLE
- Deduplication: 無
- Evidence Level: VERIFIED
- Known Limitations: 不是不重複學生
- Current Implementations: `getReservationOverview` 445 行

### ops.roster.distinct_checkin_students

- Display Name: 不重複參與學生數
- Definition: 傳入名單中，學期區間內至少一筆 `已簽到` 的學號數
- Analysis Unit: 學生
- Population: 呼叫端學生名單（班級或風險母體），不是全校預約者
- Numerator / Denominator: NOT_APPLICABLE（此 ID 是人數；率見下一項）
- Source: `reservations`、`events`
- Time Model: `TC-OPS-DATE-STRING`（`e.date BETWEEN` 字串，無 CAST）
- Deduplication: 學號
- Evidence Level: VERIFIED
- Known Limitations: 與預約列人次不可相減。日期比對方式與 S1-A 不同
- Current Implementations: `getParticipationMetrics` 382–388 行

### ops.reservation.checkin_row_rate

- Display Name: 出席率（預約列）
- Definition: 已簽到列／預約列
- Numerator: `ops.reservation.checkin_row_count`
- Denominator: `ops.reservation.row_count`
- 其餘同 S1-A
- Evidence Level: VERIFIED
- Known Limitations: 分母含未簽到與可能的取消列

### ops.roster.distinct_checkin_rate

- Display Name: 活動參與率（名單）
- Numerator: `ops.roster.distinct_checkin_students`
- Denominator: 傳入學生人數
- Time Model: `TC-OPS-DATE-STRING`
- Evidence Level: VERIFIED
- Conflict: 不可與 `ops.reservation.checkin_row_rate` 同時叫出席率

### ops.roster.avg_checkin_count

- Display Name: 活動參與頻率
- Definition: 名單內簽到列次數加總／名單人數。一人一天可多筆（SQL GROUP BY 學號與日期再 COUNT）
- Numerator: 簽到次數加總
- Denominator: 名單人數，含零次的人
- Evidence Level: VERIFIED（`avgParticipationCount`）
- Known Limitations: 不是「每週」頻率，沒有持續週數

### ops.participation.streak

- Display Name: 活動持續參與
- Definition: NOT_IMPLEMENTED。程式沒有「連續場次或連續週仍出席」的指標
- Evidence Level: VERIFIED 為缺口
- Current Implementations: 無

### ops.capacity.reservation_over_seats

- Display Name: 資源利用率（名額）
- Definition: 預約列數／區間內活動 `maxCapacity` 加總
- Numerator: `ops.reservation.row_count`
- Denominator: 名額加總
- Evidence Level: VERIFIED
- Known Limitations: 超過名額時可大於 100%。不是教室時數，也不是快照裡的資源時數
- Conflict: `snapshot.resource_hours` 是另一種「資源」

---

## BESTEP 檔案與班級

### bestep.file.skill_score

- Display Name: BESTEP 各技能成績
- Definition: `bestep_exam_scores` 的 listening／reading／speaking／writing 分數。匯入範圍聽讀與說寫各有上下限，超出則整列不進表
- Analysis Unit: 學生 × 檔案學期 × 技能
- Population: 匯入時有報名成功紀錄者
- Numerator / Denominator: NOT_APPLICABLE
- Source: Excel → `bestep_exam_scores`
- Time Model: `TC-BESTEP-FILE-SEMESTER`
- Attempt Selection: 同學期同人後寫覆蓋（讀取時）。匯入是否先刪舊列：PARTIALLY_VERIFIED
- Missing Data: 空分數存 null。四科都空則整列拒絕
- Evidence Level: VERIFIED
- Known Limitations: 不是 `et_exam_attempts` 的分數

### bestep.file.skill_level

- Display Name: BESTEP 技能等級（正規化後）
- Definition: `normalizeCefrLevel` 之後的 A1–C2。`B2+` 存成 `B2`，`未達A1` 存成 `A1`
- Threshold: 字串，不是 GSE
- Evidence Level: VERIFIED（`bestepImportService.js` 87–93 行與測試）
- Known Limitations: 不能還原加號

### bestep.file.skill_reached_b2

- Display Name: 技能等級達標（單科，培力檔）
- Definition: 該科正規化等級 index ≥ B2
- Analysis Unit: 學生 × 技能 × 檔案學期
- Numerator / Denominator: 若做成率，分母必須另定（報考或有該科等級）。系統沒有單獨的「單科達標率」頁，班級主指標是四項聯合
- Evidence Level: VERIFIED 規則存在於 `isPassed` 的每一科；單科率 NOT 作為獨立 API 欄位（PARTIALLY_VERIFIED UI）
- Known Limitations: 加號已丟，B2 與 B2+ 不可分

### bestep.file.four_skill_cefr_b2

- Display Name: 四項達標（培力檔）
- Definition: 四科等級都存在且都 ≥ B2
- Numerator: `passed = true` 的人數
- Denominator: 班級統計的 `registeredCount`（S2）。不是出席人數
- Time Model: `TC-BESTEP-FILE-SEMESTER`
- Missing Data: 缺等級 → 不通過，與未達標相同
- Evidence Level: VERIFIED
- Current Implementations: `isPassed`、`buildClassBestepOverviewStatistics`

### ops.roster.bestep_pass_over_attendance

- Display Name: 培力通過率（行政 KPI）
- Definition: 名單中 `passed` 人數／`max(LR 出席人數, SW 出席人數)`
- Numerator: `score.passed` 人數（同一布林）
- Denominator: 出席人數的較大者，不是報考、不是四項都到
- Time Model: `TC-BESTEP-FILE-SEMESTER` 加上出席只認 LR／SW
- Evidence Level: VERIFIED
- Known Limitations: 與班級通過率同分子、不同分母。L／R 分開匯入時出席分子會變 0
- Current Implementations: `getBestepPassMetrics`、`getBestepAttendanceMetrics`

### bestep.file.attendance_lr_sw_avg

- Display Name: 培力出席率（行政，聽讀與說寫平均）
- Numerator: 各有 `examType` 為 LR 或 SW 且 attended 的人數
- Denominator: `status===success` 的報名人數
- Formula: 兩率再平均
- Evidence Level: VERIFIED
- Conflict: 班級頁可依 L/R/S/W 篩選，那是另一個畫面過濾，不是這個平均

### ops.registration.legacy_has_cefr_b2

- Display Name: 報名表 CEFR B2 標記率
- Definition: 該學期報名列中 `hasCEFRB2` 為 是／true／yes／1 的比例
- Numerator / Denominator: 標記列／報名列
- Evidence Level: VERIFIED
- Known Limitations: 函式註解禁止稱為學習歷程達標率。標記由誰填寫：UNVERIFIED
- Current Implementations: `getReservationOverview` 475–497 行

---

## 名冊與成對

### roster.pair_pass.listening_reading

- Display Name: 聽讀達標
- Definition: 政策 dimension `lr_pair`。內建兩種判定：同日或跨日；`both_cefr`（兩科 rank≥4）或工具合計（BESTEP ≥200，僅在 sumraw 政策）
- Analysis Unit: 名冊學生
- Population: 選定學期 active 名冊 ∩ 政策年級 ∩ 工作集
- Numerator: 至少一組場次通過的人數
- Denominator: 上述母體人數，含沒有任何嘗試的人
- Source: `et_exam_attempts` only
- Time Model: `TC-ROSTER-LIFETIME-DEFAULT`
- Attempt Selection: 見 S6 表。證明列取通過者中最高合計
- Deduplication: 一人一列
- Threshold: 隨政策。預設政策鍵是同日雙科 CEFR，不是 200
- Missing Data: 缺科不算通過，仍留在分母
- Version: `kpi-policy.v1`
- Evidence Level: VERIFIED
- Known Limitations: 終身窗會把別的學期的 et 嘗試算進來。看不到只存在 `bestep_exam_scores` 的列
- Current Implementations: `evaluateKpiPolicy`

### roster.pair_pass.speaking_writing

與聽讀相同，dimension `sw_pair`。BESTEP 合計門檻 560 只在 sumraw 政策。不可與聽讀加總成「四項達標」。

### roster.pair_pass.both_pairs

- Display Name: 聽讀且說寫都達標
- Definition: NOT_IMPLEMENTED 為單一 dimension。兩欄都過必須在讀取端自己 AND。本次未看到官方「兩組成對都過」的率
- Evidence Level: VERIFIED 為缺口

### roster.best_skill_rank_b2

- Display Name: 歷史最佳技能達 B2
- Definition: 該技能在所有 valid et 嘗試中的最高 rank ≥ 4
- Numerator: 該技能達標人數
- Denominator: 名冊人數
- Time Model: `TC-ROSTER-BEST-ASOF-NOW`
- Attempt Selection: 最高 rank。技能之間可來自不同考試
- Evidence Level: VERIFIED
- Known Limitations: 未來成績改寫此率。不是 B2+。不是成對。不是培力檔

### roster.best_skill_state

- Display Name: 歷史最佳技能（狀態，不是率）
- Definition: 每人四格 `{cefr, rank}`，無日期（Map 版）
- Numerator / Denominator: NOT_APPLICABLE
- Evidence Level: VERIFIED
- Known Limitations: 這是能力狀態的一種算法，不是批次成效

---

## 快照、成長、暴露

### snapshot.exam_cell_rank_b2

- Display Name: 快照考試格達 B2
- Definition: `lj_analytic_exams.isB2plus`，該格 rank ≥ 4
- Analysis Unit: 學生 × 工具 × 梯 × 技能
- Population: 該 `snapshot_version` 的考試列，不含學測
- Time Model: `TC-SNAPSHOT-VERSION`
- Evidence Level: VERIFIED
- Known Limitations: 欄名 isB2plus。總覽 headline `b2plusRate` 是學生層彙總，公式在 summary service，本次未重讀分子是否「任一技能」或「四技能」。標 PARTIALLY_VERIFIED 於學生層率，VERIFIED 於格子旗標（`analyticRebuildService.js` 140–141 行）

### snapshot.near_b2_gse

- Display Name: 接近 B2
- Definition: 尚未達 B2，且最佳能力 GSE 在 51–58。學測排除
- Threshold: GSE 51–58（`gseMappingDefaults.js`，版本字串 `2026-v1`）
- Time Model: `TC-SNAPSHOT-VERSION`
- Evidence Level: VERIFIED 規則；GSE 對照表是否覆蓋每一工具 PARTIALLY_VERIFIED
- Known Limitations: 不是 CEFR 字串 B1+

### snapshot.gse_raw_delta

- Display Name: 同工具前後梯原始分差（再換成 GSE 的成長描述）
- Definition: 同一工具相鄰梯、同一技能、兩邊都有可用原始分。GSE 由 `inferGse` 對照，不是第二個官方量尺
- Population: 有至少兩梯的人。只有一梯者排除
- Time Model: `TC-EXAM-SESSION`
- Evidence Level: PARTIALLY_VERIFIED（窗在 `examSessionService`；GSE 推斷未逐工具核對）
- Known Limitations: 不同工具的原始分不可直接相減。GSE 比較要標鈍化

### snapshot.gse_adjusted_delta

- Display Name: 校正後成長
- Definition: `baseline_adjusted_simplified` 或 `baseline_adjusted_regression_v2`（OLS，含考試間隔月數）。對照表寫 covariates 含起點 GSE、間隔、證據品質、起始 CEFR 帶、技能
- Numerator / Denominator: NOT_APPLICABLE（平均差，不是率）
- Evidence Level: VERIFIED 方法名與 `causalClaimAllowed: false`
- Known Limitations: 名稱容易讀成課程效果。只存在於有前後測的樣本
- Current Implementations: `lvaAdjustedGrowthService.js`、`lvaAnalyticsService.estimatePolicy`

### snapshot.skill_exposure

- Display Name: Skill Exposure
- Definition: 考試日前、上一梯結束後的課程／活動時數，寫在 `lj_analytic_exams` 的 `*HoursBeforeExam`。學生層另有累積時數
- Time Model: `TC-EXPOSURE-BEFORE-EXAM`
- Evidence Level: VERIFIED 欄位被寫入（135–184 行）；時數換算函式 `activityHours` 未逐式讀，PARTIALLY_VERIFIED
- Known Limitations: 這是考前窗的時數，不是全學期參與，也不是因果暴露

### snapshot.growth_episode

- Display Name: Growth Episodes
- Definition: 可計算成長的樣本段，出現在 LVA／匯出的 `growthEpisodeCount`。儲存表 `learning_growth_episodes` 由 model run 產生（腳本註解）
- Evidence Level: PARTIALLY_VERIFIED
- Known Limitations: 計數不是效果量

### snapshot.resource_effect

- Display Name: Resource Effectiveness
- Definition: `resource_effect_estimates.causal_effect` 與 LVA 回傳的描述性估計。API 同時給 `causalClaimAllowed: false` 與 `estimateType: descriptive`（或進階方法名）
- Evidence Level: VERIFIED 旗標與欄位並存
- Known Limitations: 欄名超過證據。資源頁文案寫「這頁不做資源成效排名」
- Current Implementations: `lvaAnalyticsService.js` 155–169 行；`ResourceEffectEstimate` model

### snapshot.evidence_quality

- Display Name: Evidence Quality
- Definition: `evidenceQualityForStudent` 把學生分成品質帶，供篩選與回歸共變項。分帶規則在 `learningAnalyticsFilterUtils.js` 34 行起，本次未逐條件展開
- Evidence Level: PARTIALLY_VERIFIED
- Known Limitations: 這是資料完整度分類，不是能力，也不是因果可信度的完整模型

### trace.micro_learning.30d

- Display Name: 微學習近 30 日參與
- Definition: `learning_trace_events` 依遊戲與 30 日窗。不進快照
- Time Model: `TC-TRACE-ROLLING-30D`
- Evidence Level: VERIFIED 前端參數；聚合 SQL PARTIALLY_VERIFIED
- Current Implementations: `MicroLearningEngagementPanel.jsx` 52 行

### etgroup.gse_snapshot

- Display Name: ET 分組當下 GSE 快照
- Definition: 分組指派列上的 `gse_snapshot`，由分析學生重算。腳本稱此為 CAPS 遷移後的欄位
- Evidence Level: VERIFIED 腳本意圖；與 `snapshot.gse_adjusted_delta` 不是同一指標
- Known Limitations: CAPS Growth 作為現行計算名稱 UNVERIFIED。不要把 CAPS 當成還在跑的成長模型

---

## 字典未覆蓋、且刻意不發 ID 的東西

未掛載的 `englishTestsRouter` 學期 CEFR 分布：無線上消費者，不發 ID。若日後掛載，必須新 ID，不可沿用 `roster.best_skill_rank_b2` 直到證明呼叫的是同一函式。

`englishTestTracking` 的報告服務仍可能被未掛載路由使用。底層 `rebuildSemesterBestSkills` 有線上呼叫者，那是 S5 的維護動作，不是另一個達標率。
