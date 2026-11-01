# Phase 4J 工作包

本檔只規劃。Phase 4I 不實作這包。

1. **Pilot ID**：`bestep-file-quality`。
2. **Business Question**：指定的檔案學期裡，成績匯入結果能否被描述成一次 BESTEP 施測，而日期、技能完整度與來源投影仍可追溯。
3. **Existing Entry Point**：`POST /api/admin/bestep/scores/import` 的回應計數，以及 `bestep_exam_scores` adapter。不新增管理頁。
4. **Data Source**：合成的成績列與匯入結果物件。不連正式庫。真實覆蓋率留到 L3。
5. **Metric Mapping**：
   - 成績列數對應學號乘學期，不使用技能 observation 數當分子。
   - 四科不齊對應任一技能等級為 null。
   - 單科 B2 只引用 `bestep.file.skill_reached_b2` 的定義，不算學生達標。
   - 不計算 `passRate`。
6. **Temporal Mapping**：檔案學期用 `TC-BESTEP-FILE-SEMESTER`。缺 `examDate` 維持缺失。不套 `TC-OPS-DATE-SEMESTER`。不把 `exam_attempts.examDate` 回寫成來源日期。
7. **Source Provenance**：每列 observation 的 namespace 是 `bestep_exam_scores`。`exam_attempts` 只有 `sourceRef` 符合時才是投影。`et_exam_attempts` 沒有該連結時維持另一來源。
8. **Contract Gaps**：出席匯入日沒有 temporal id。場次表沒有被 `TC-EXAM-SESSION` 描述。這兩項在本 pilot 只標 Gap，不新建 id。
9. **Shadow Validation**：比照活動營運 shadow 的失敗不影響主回應。輸入是合成列，輸出只含品質旗標與計數。不寫入現有 overview。
10. **API Compatibility**：不改 `bestepRouter`、匯入 controller、成績 upsert。shadow 函式不被現有路由呼叫，直到另一次驗收允許掛上。
11. **Frontend Impact**：無。不改 `ClassBestepOverview`、匯入中心或成效分析頁。
12. **Test Fixtures**：
    - 一列四技能，observation 數為 4，學號數為 1。
    - `examDate` null，旗標為缺失，學期不被補成日期。
    - 儲存值 `B2` 不還原成 `B2+`。
    - 沒有 success 報名的跳過列不進入成績母體。
    - `exam_attempts` 的推斷日與來源 null 同時保留，不合併。
13. **Acceptance Criteria**：
    - 既有匯入與班級測試仍過。
    - 新 shadow 測試不連資料庫。
    - 回應若將來掛載，預設不出現在現有 JSON。
    - `officialUseAllowed` 與 `causalClaimAllowed` 仍是 false。
14. **Rollback**：不掛路由、不改 schema。移除 shadow 模組即回到 Phase 4H 行為。
15. **L3 Dependencies**：真實檔的 null 考試日比例、跳過原因分布、重匯覆蓋次數、et 補寫是否已跑。未跑 L3 前不得把 shadow 計數寫進正式頁。
