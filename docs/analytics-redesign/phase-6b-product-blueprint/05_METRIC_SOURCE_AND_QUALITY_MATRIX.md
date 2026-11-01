# 指標、來源與品質

分類只描述現況，不升格官方成效。

| 指標 | 分類 | 來源 | 注意 |
|---|---|---|---|
| 活動數、預約列、簽到列、名額比 | `EXISTING_SAFE_OPERATIONAL` | 活動總覽 API | 列與人不混用 |
| distinct 出席學生、人均簽到 | `EXISTING_SAFE_OPERATIONAL` | 同一 API 的另一組欄位 | 與列數分開顯示 |
| `englishPassRate` | `EXISTING_BUT_SEMANTICALLY_LIMITED` | 報名表 B2 標記 | 不是活動成效 |
| 班級四技能分數、CEFR、出席三態 | `EXISTING_BUT_SEMANTICALLY_LIMITED` | 班級 overview | B2+ 已損失；未知不是 0 |
| 班級 `passRate` | `POLICY_PENDING` | 現公式 | F-BESTEP-01 |
| 學習資源接觸、技能暴露 | `EXPLORATORY_NONCAUSAL` | learning analytics | `causalClaimAllowed` 仍 false |
| 調整後成長 | `POLICY_PENDING` | 尚未核准 | D8 |
| 來源誰優先、加號要不要另存 | `POLICY_PENDING` | D10、D11 | 不自動合併、不還原 |
| 正式庫的缺值比例 | `DATA_VALIDATION_PENDING` | 尚未 L3 | 不可用合成測試代替 |
| 連續參與、兩組成績都過 | `NOT_IMPLEMENTED` | `ops.participation.streak`、`roster.pair_pass.both_pairs` | 不要在 UI 顯示假的 0 |
| Shadow 即時品質分 | `NOT_IMPLEMENTED` 於正式環境 | 三個 runtime 預設關 | 產品不能假設有這份報表 |
