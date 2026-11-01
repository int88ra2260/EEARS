# 07 證據與宣稱治理

宣稱天花板由 EvidencePolicy 固定，不由指標英文名稱決定。Adjusted、Effectiveness、Growth、Impact 都不會自動升到 Causal。

| 天花板 | 允許的句子 | 不允許的句子 |
|---|---|---|
| Descriptive | 人數、比率、分布、狀態 | 誰比較好、誰進步、方案有效 |
| Comparative | 與門檻比，或同一規則下兩群的差 | 差是因為參加了方案 |
| Longitudinal | 同一人、同一工具、兩次觀測的差 | 差是課程造成的 |
| Adjusted | 在列明的共變項下，剩餘差是多少 | 共變項已去掉所有偏差 |
| Associational | 兩件事同時出現，樣本是誰 | 其中一件導致另一件 |
| Causal | 僅在另案寫明設計與核准後 | 預設永不出現 |

DOM-GOV 要求每個 Metric Result 帶：

| 標籤 | 內容 |
|---|---|
| Evidence Level | 上表之一，取該 ID 的天花板，不可由前端提高 |
| Sample / Coverage | 分母、分子、被排除人數與原因 |
| Missing Data | 政策版本：留在分母或移出 |
| Time Eligibility | 契約 ID 與 bound。不符合的人是 ineligible，不是 0 |
| Comparability | 可與哪些 ID 並排；預設空 |
| Source Freshness | 監測：來源最大時間與計算時間。正式：manifest，沒有 stale |
| Calculation Version | Metric Version、政策鍵、GSE 表版本、RULE_VERSION |
| Claim Restrictions | 固定短句，見下 |

## 五個容易被誤讀的指標

### snapshot.resource_effect

- 天花板：Associational。若結果來自回歸或配對，標 Adjusted，仍不是 Causal。
- 覆蓋：模型樣本，不是全體名冊。
- 缺漏：沒有暴露或沒有結果的人不在估計裡，必須計數。
- 時間：快照版本＋模型執行，不是學期成果。
- 可比：只與同一 estimateType、同一模型執行。
- 新鮮度：快照延遲要顯示。
- 版本：LVA 方法名（descriptive、regression_v2 等）。
- 限制句：「這是描述或統計調整，不是方案造成的效果。」`causalClaimAllowed` 必須仍為 false 才可顯示；若資料列為 true，探索頁改顯示「旗標與政策衝突」，不顯示效果句。Phase 2：API 組裝寫死 false，資料列是否有人改過仍待 V-05。

### snapshot.gse_adjusted_delta

- 天花板：Adjusted。
- 覆蓋：有兩梯且進入回歸的人。覆蓋率用「有兩梯人數／選定母體」。
- 缺漏：單梯不補 0。
- 時間：相鄰梯，不是行政學期。
- 可比：同工具、同方法版本。
- 限制句：「已依起點與間隔調整，沒有隨機分派，不能說課程導致進步。」
- 共變項以 Phase 2 讀到的清單為準：起點 GSE、間隔、證據品質、起始 CEFR 帶、技能。未控制動機與選課自選。

### partner.score_gap

- 天花板：Associational。
- 覆蓋：有 BESTEP 成績者。無成績的有伴成員另行計數（現有 API 已有）。
- 缺漏：不把無成績當成 0 分。
- 時間：檔案學期。
- 可比：不可與成對達標率相減。
- 限制句：沿用現有 caveat，不改弱。自選偏誤與先備沒有被控制。

### 活動參與與英檢（沒有單一現成 ID）

架構**不新增**「參與導致成績」指標。若探索頁把 DOM-PART 的時數與 DOM-ATTAIN 的分數放在同一畫面，必須是兩個 Metric ID、兩段限制，中間沒有箭頭。考前窗時數只用 `snapshot.skill_exposure`，並說明窗是上一梯到這次考試，不是所有考前活動。宣稱停在 Descriptive。要做關聯，另開探索定義，預設不進任何工作流。

### roster.best_skill_state 與 rank 率

- 天花板：Descriptive state。
- 覆蓋：名冊全員。沒考的人留在分母（率的那個 ID）。
- 時間：現況是查詢當下；指定 as-of 在做不到時回 not_supported。
- 可比：不可與去年的同率畫成趨勢。
- 限制句：「這是截至計算時各技能的最高等級，技能可以來自不同考試，之後的新成績會改變這個數。這不是該學期的考試成果，也不是 B2+。」

## 防止誤讀的機制

1. 天花板寫在 registry，畫面不能覆寫。
2. 限制句是契約的一部分。缺句子的探索 API 在契約測試裡失敗。
3. Official 槽拒絕天花板低於「該次核准所要求」的 ID；在沒有核准時，達標與探索 ID 都進不了 Official。
4. 圖表規格禁止雙軸把「時數」與「達標率」畫成一條因果。這條寫進 WP 的驗收，不在本階段做元件。
5. 既有限制句（有伴 caveat、課師頁「非因果」、洞察頁「不用來宣稱」）視為下限。遷移不得刪掉它們，即使頁面改掛。

快照的 `snapshot.evidence_quality` 只描述快照學生的資料完整度。它不提高宣稱天花板，也不適用於活動列與培力布林。
