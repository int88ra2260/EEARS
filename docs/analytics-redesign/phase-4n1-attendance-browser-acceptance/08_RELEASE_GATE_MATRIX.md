# Release Gate

出席顯示與官方通過率是兩個發布範圍。

## 出席 UX Release Candidate

| Gate | 狀態 | 依據 |
|---|---|---|
| Engineering | 通過 | 未知出席不再顯示缺席；總分 0 不再變成缺值；單元與瀏覽器回歸通過 |
| Browser | 通過 | 真實 `ClassBestepOverview`、五種 viewport、合成資料 |
| Accessibility | 部分通過 | 文字與對比已量測。螢幕報讀器 Pending |
| Data | 未做 | 沒有正式出席列 |
| Business Policy | 不適用 | 這項修正不依賴通過率母體決策 |
| Staging | Pending | 沒有上 staging |
| Production | 未就緒 | 還沒有部署核准 |

這個範圍可以進入後續部署審查。它還沒有上線。

## BESTEP 官方報表

| Gate | 狀態 |
|---|---|
| F-BESTEP-01 政策 | Pending，`decision_pending` |
| L3 真實資料 | 未做 |
| 官方指標與治理核准 | 未核准。`officialUseAllowed` 與 `causalClaimAllowed` 仍是 false |
| Staging / Production | 未就緒 |

瀏覽器測試通過，不能解讀成官方通過率已經核准。
