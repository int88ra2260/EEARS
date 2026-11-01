# 未決決策與風險

狀態來源：`analytics-contracts/decisionGateRegistry.js` 十一項皆 `pending`；Phase 4I `DG-BESTEP-01` 到 `05`；Phase 4N `F-BESTEP-01`。決策負責人寫角色，不寫人名。本階段沒有代選。

## 風險

| 等級 | 項目 | 性質 |
|---|---|---|
| P0 | 無 | 三個 Shadow 預設關、失敗不改回應、不寫資料庫。本階段沒有發現憑證或個資寫進診斷 |
| P1 | 班級 `passRate` 母體不一致，合成案例可超過 100%，或分母 0 時顯示 0 | 程式已證實。正式班級出現次數未知，要 L3 |
| P1 | 若有人把班級 `passRate` 或 `englishPassRate` 說成中心達標率或活動提升 | 業務選項尚未核准。畫面文案已把後者移出核心 KPI |
| P2 | 出席 `null` 在未合併的正式環境仍可能顯示成缺席 | 分支已修。瀏覽器驗收不是部署 |
| P2 | 匯出空白與畫面「未確認」不一致 | 程式差異，本階段未改匯出 |
| P2 | B2+ 存成 B2；確認投影上的 `1970-01-01` | 既有行為。頻率要 L3。D10、DG-BESTEP-04 未決 |
| P2 | 活動旗標大小寫與 BESTEP 旗標不同 | 工程一致性。production 皆關閉 |
| P3 | 班級 ID 錯誤訊息亂碼、`getBestepOverview` 未使用的 `next`、Browserslist 資料過期 | 既有。不在本階段修 |

## F-BESTEP-01

- Affected Features: 班級 BESTEP `passRate`、`passedCount`、`registeredCount`
- Current Behavior: 分子是全體成員中 `score.passed`；分母是本國生且報名成功。分母大於 0 才做百分比，否則 0
- Available Evidence: `bestepClassService.js` 公式；決策測試的 100%、150%、0% 與對齊案例
- Missing Evidence: 正式班級的分布；業務選定的分母
- Options: 維持 Legacy，或未核准的 A/B/C。三者不可互換，也都不是官方 KPI
- Decision Owner Role: 英語中心業務負責人
- Required Approval: 書面選定分母與分子，工程才可改公式
- Risk if Deferred: 畫面繼續顯示可能超過 100% 或與分子矛盾的 0%
- Blocking Scope: 官方班級達標報告。不阻擋出席顯示修正

## F-BESTEP-02

- Current Behavior: 本分支嚴格區分出席、缺席、未確認、未匯入；總分 0 顯示 0
- Available Evidence: 單元測試 8 項中的出席與零分；Playwright 5 項
- Missing Evidence: Staging 與正式環境
- Decision Owner Role: 工程可維持已實作的顯示；若要改成「不適用／抵免」需業務負責人
- Blocking Scope: 無公式變更。部署仍要整合核准

## D1–D11

共同欄位：Current Behavior 是舊程式繼續跑；Available Evidence 是契約登錄 `status: pending`；Missing Evidence 是核准紀錄與 L3；Decision Owner Role 是英語中心業務負責人；Required Approval 是書面決策；Risk if Deferred 是不能把指標標成官方或因果；Blocking Scope 是官方報告，不是 Shadow 關閉狀態。

- D1 正式成果用哪一種達標定義。Options: 維持多個並存定義並標母體，或指定一個。Affected: 所有達標指標。
- D2 名冊達標是否納入名冊學期以外的嘗試。Options: 只算當學期，或納入學期外嘗試。Affected: 名冊達標。
- D3 正式成果是否凍結。Options: 可隨新成績變，或凍結版本。Affected: 歷史最佳與報告。
- D4 單次培力是否獨立於名冊。Options: 分開報告，或併入名冊。Affected: BESTEP 與名冊。
- D5 跨日或跨工具成績能否拼成達標。Options: 禁止拼，或允許並標來源。Affected: 技能達標。
- D6 缺考與缺等級是否留在分母。Options: 留在分母當未達標，或排除。Affected: 通過率。與 F-BESTEP-01 相關但不是同一個公式。
- D7 監測、正式成果與研究各看哪些指標。Options: 三份清單。Affected: 發布範圍。
- D8 成長是否必須有可比前後測。Options: 沒有前後測就不報成長。Affected: 成長敘述。`causalClaimAllowed` 目前全 false。
- D9 歷史最佳是能力狀態還是學期成果。Options: 擇一並在標題寫明。Affected: 歷史最佳。
- D10 以後是否另存原始 CEFR 加號。Options: 繼續只存 B2，或另存加號。Affected: B2+ 資訊損失。不能從已存的 B2 還原。
- D11 培力成績表與 et 嘗試衝突時誰優先。Options: 維持分開，或指定優先。Affected: `bestep_exam_scores` 與 `et_exam_attempts`。本階段不合併來源。

## DG-BESTEP-01–05

來源是 `docs/analytics-redesign/phase-4i-bestep-discovery/09_OPEN_ISSUES_AND_DECISION_GATES.md`。狀態仍是未決。

- DG-BESTEP-01 測驗日是檔案學期、LR 日還是 SW 日。現況匯入不寫場次表，成績日是 null。Owner: 業務負責人加資料管理角色。Blocking: 任何把檔案學期當成考試日的報告。
- DG-BESTEP-02 沒有出席列算不算缺考。現況讀取是 null；畫面在本分支是未確認或未匯入。Owner: 業務負責人。Blocking: 缺考率。不阻擋「未確認」這次顯示。
- DG-BESTEP-03 班級通過率分母能否當中心母體。現況分母是班級本國生且報名成功。Owner: 業務負責人。Blocking: 與 F-BESTEP-01 相同。
- DG-BESTEP-04 同步推斷日能否當分析日。現況 `resolveBestepExamDate` 可寫出席日、匯入日或 1970。Owner: 資料管理角色。Blocking: 使用 `exam_attempts.examDate` 的時間序列。
- DG-BESTEP-05 et 補寫是否為成績進入 KPI 的必要步驟。現況 KPI 讀 `et_exam_attempts`，不是成績檔，也不是班級 `passRate`。Owner: 業務負責人。Blocking: 用 KPI 代表成績檔。

## L3 與上線

- Activity Operations L3 與 BESTEP L3 都沒有做。Owner: 資料驗證角色，在業務負責人授權的唯讀範圍內。
- Staging / Production：無驗收、無核准、無部署。Owner: 發布負責人。Browser Accepted 不計入這兩關。
