# 未決與差異

## 政策

D1–D11 仍全部 pending。內建成對政策在跑，只記成 `legacyActive`。正式成果宣稱一律拒絕。

## ID 與任務敘述的差異

任務要求成對 CEFR 與成對分數合計不要當成同一個 B2。Phase 2 字典讓兩者共用 `roster.pair_pass.listening_reading` 與 `roster.pair_pass.speaking_writing`。本階段不另造 ID。`disambiguators` 含 `policyKey`。缺鍵是 `undetermined`，鍵不同是 `incompatible`。

## CSV 短名與登錄顯示名

ID 相同。顯示名比 `metric_dictionary.csv` 稍長的有：

| ID | CSV | 登錄 |
|---|---|---|
| ops.reservation.checkin_row_rate | 出席率（列） | 出席率（預約列） |
| ops.participation.streak | 持續參與 | 活動持續參與 |
| bestep.file.skill_score | 培力技能分數 | 培力各技能分數 |
| bestep.file.skill_level | 培力技能等級 | 培力技能等級（正規化後） |
| roster.pair_pass.both_pairs | 兩組成對都過 | 聽讀且說寫都達標 |
| roster.best_skill_rank_b2 | 歷史最佳達 B2 | 歷史最佳技能達 B2 |
| roster.best_skill_state | 歷史最佳狀態 | 歷史最佳技能狀態 |
| snapshot.evidence_quality | 證據品質帶 | 快照證據品質帶 |
| trace.micro_learning.30d | 微學習 30 日 | 微學習近 30 日 |
| etgroup.gse_snapshot | 分組 GSE 快照 | ET 分組 GSE 快照 |

## 驗證欄與實作狀態

`bestep.file.skill_reached_b2` 在 CSV 是 VERIFIED。登錄是 `partial`，因為單科沒有獨立率欄，只是四項判斷裡的等級比較。VERIFIED 表示程式路徑讀過，不是「已有獨立指標」。

`snapshot.gse_raw_delta` 的 CSV 只列 `TC-EXAM-SESSION`。Phase 2 時間契約本文寫數值在快照列上，還受 `TC-SNAPSHOT-VERSION` 約束。登錄兩者都列。

`snapshot.gse_adjusted_delta` 的 CSV 只列快照版本。登錄另列 `TC-EXAM-SESSION`，因為校正使用的前後梯來自梯次窗。這是登錄比 CSV 多掛的契約，不是新 ID。

## 尚未完整映射

- 學生層快照 `b2plusRate` 的分子。
- 培力報名統計 SQL。
- 微學習聚合 SQL、分組頁公式、成長段模型執行。
- 問卷、週報、口說。
- 未掛載的 `englishTestsRouter`。

## 本階段不做

歷史截止日查詢、快照凍結、培力與 et 去重、B2+ 還原、發布版本、因果估計。這些在契約裡是限制或 `unsupported`，不是已完成的資料處理。
