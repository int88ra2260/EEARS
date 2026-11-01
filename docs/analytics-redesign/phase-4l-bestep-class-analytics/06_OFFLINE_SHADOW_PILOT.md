# 離線 Pilot

`evaluateBestepClassAnalytics` 讀 `response`、`queryContext`、`claims` 與 `sourceNotes`。

它檢查路徑、型別、契約對應、出席三態有沒有出現、以及時間或來源主張是否越界。輸出有 classified count、unknown paths、unmapped、proposed、warnings、attendanceEvidence、`examSittings: null`、governance。

它不會：

- 重算到考率或通過率。
- 把 null 出席計成缺考。
- 查資料庫或 Sequelize。
- 改輸入物件。
- 把學號、姓名、email 放進診斷。
- 接上 `getBestepOverview`。

`recalculated` 固定 false。`officialUseAllowed`、`causalClaimAllowed`、`sourcePriorityApplied`、`mergePerformed` 固定 false。
