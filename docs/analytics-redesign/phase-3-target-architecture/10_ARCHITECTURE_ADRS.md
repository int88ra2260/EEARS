# 10 架構決策紀錄

狀態一律 `PROPOSED`。核准前不得當成實作指令以外的「已定案政策」。業務決策 D1–D11 不在這裡被核准。

## ADR-1 語意層用程式 registry，政策實例留在既有資料表

- Context: 32 個 ID 裡，同名衝突比公式重複更危險。KPI 政策已經在資料庫，而且會變。
- Alternatives: 全部程式碼；全部資料庫；混合。
- Trade-offs: 純資料庫方便改門檻，也方便改錯且沒有 PR。純程式碼讓政策鍵的切換也要發版，和現況的八種政策不符。
- Proposed Decision: ID、契約、缺漏、宣稱天花板在 Git。AssessmentPolicy 的選擇沿用 KPI 政策表。發布時把政策 JSON 複製進 Run，之後不回讀活的政策列。
- Consequences: 改四項 `isPassed` 或成對門檻常數仍要發版與契約測試。行政仍可在已存在的政策之間切換，這不等於核准其中一個為正式成果。
- Open Questions: registry 檔放後端哪一層，留到 WP-1，不在本 ADR 綁目錄。
- Status: PROPOSED

## ADR-2 指標版本與政策版本分開

- Context: `kpi-policy.v1`、`lj-analytics-2026-v1`、GSE `2026-v1` 已經是不同生命週期。
- Alternatives: 一個總版本號；各管各的。
- Trade-offs: 總版本號會讓只改 GSE 對照表的發版看起來像達標規則變了。
- Proposed Decision: Metric Result 同時記錄 metricVersion、policyKey（可空）、transformVersion（CEFR 正規化、GSE 表）。比較時三者都要相同才可並排。
- Consequences: 舊結果沒有這些欄位。補不出來的歷史比較標 Traceable，不重算。
- Open Questions: 無。
- Status: PROPOSED

## ADR-3 雙軌成績先標註，不合併

- Context: 培力表、`exam_attempts`、`et_exam_attempts` 服務不同指標。快照在同鍵上留 et，這不是已核准的優先序。D11 Pending。
- Alternatives: 立即建成事實表並去重；維持現況但不命名；Adapter 輸出帶來源的 Observation，候選鍵只警告。
- Trade-offs: 事實表會把未決優先序寫進資料。完全不命名會讓下一次開發再默默合併。
- Proposed Decision: Option C。不搬表、不改 prefer et、不把 CEFR 當分數互換。`possibleSameSitting` 只在有觀察到的考試日時出現。
- Consequences: 班級數字與 KPI 可以繼續不同。測試要鎖定這個不同，而不是把它修掉。
- Open Questions: D11 核准後，警告才可能變成某一指標的 SourcePolicy。不會自動改其他指標。
- Status: PROPOSED

## ADR-4 時間用具名 bound，不用單一學期參數

- Context: 至少有 CAST 日期學期、字串日期、檔案學期、名冊學期、終身嘗試、快照版本。
- Alternatives: 所有 API 收 `semester`；Query Context 帶契約與 bound。
- Trade-offs: 單一參數短，也是現在誤讀的來源。具名 bound 讓呼叫端多寫欄位。
- Proposed Decision: 新查詢收 Query Context。舊 API 在套 metadata 時把原來的學期欄位對應到該 ID 已登記的契約，不擴大它的意義。指定 as-of 若程式不支援，回 not_supported。
- Consequences: 前端不能只用一個下拉驅動 OPS 與 KPI。遷移期允許頁面上仍是一個字串，但請求裡要分成兩個欄位。
- Open Questions: 無。
- Status: PROPOSED

## ADR-5 正式成果與監測分離，且達標槽預設空

- Context: 沒有發布表。快照不是 Data As Of，同日會覆蓋。D1、D3 Pending。
- Alternatives: 把最新 KPI 叫正式；把快照升級成正式；另建 Frozen Result，未核准的 ID 不能發布。
- Trade-offs: 前兩個會把現況的終身窗或投影快取變成對外成果。凍結表要儲存與權限，但不改計算。
- Proposed Decision: Report Run 與快照分開。published 不可覆蓋。第一個可走完流程的內容是營運五 ID。達標 ID 在 D1 核准前不能進入 in_review。過去學期不提供重算按鈕。
- Consequences: 主任首頁在核准前看不到「本學期正式達標率」。這是安全預設，不是功能缺失。
- Open Questions: 第二核准人的角色等單位決定，不在程式寫死主任帳號。
- Status: PROPOSED

## ADR-6 宣稱天花板高於指標名稱

- Context: `causal_effect`、校正成長、有伴差距、歷史最佳的「認證」用詞都強於證據。現有 caveat 與 `causalClaimAllowed: false` 是下限。
- Alternatives: 靠頁面文案；把天花板放進 registry，缺句子即測試失敗。
- Trade-offs: registry 較嚴，文案改字也要改契約。只靠頁面會在下一次改版消失。
- Proposed Decision: 天花板與限制句進 EvidencePolicy。Official 拒絕探索 ID。資源效果不進營運域。歷史最佳不進達標域。
- Consequences: 不刪模型欄位。顯示層不得把欄名翻成「因果效果」。
- Open Questions: V-05 若發現資料列旗標為 true，顯示衝突而不是相信該列。
- Status: PROPOSED
