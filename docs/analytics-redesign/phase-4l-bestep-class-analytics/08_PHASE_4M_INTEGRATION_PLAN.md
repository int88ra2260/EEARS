# Phase 4M 接入草案

本階段沒有接 hook。若下一階段要接，位置是 `getBestepOverview` 已經拿到 `result`、尚未 `res.json` 的地方。不要放進 `buildClassBestepOverviewStatistics`，否則會碰到計算。

條件：

- Flag `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED` 只有字串 `true`。
- `NODE_ENV` 只允許 test、development、staging。production 不跑。
- Validator throw 時吃掉，原 JSON 與 status 不變。
- 不把診斷塞進 response。
- 不再查 SQL。只用這次已經組好的物件。
- Log 只留 warning code 與筆數，不印學生列。
- 學生表的 search 結果不能拿來解釋卡片母體。
- 測試要比較 flag 開與關的 HTTP body。關閉 flag 就是回滾。

在 L3 量過 null 出席、重複成績列與 passRate 分子分母落差之前，不把診斷給管理員。
