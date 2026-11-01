# React `act(...)` warning 根因

## 警告出現位置

Phase 4G 測試 `U11 does not keep the previous semester numbers while the next request is loading`。

Vitest stderr 連續出現 4 次：

```text
Warning: An update to AdminAnalyticsPage inside a test was not wrapped in act(...)
    at AdminAnalyticsPage (AdminAnalyticsPage.jsx)
```

堆疊停在元件函式，沒有指出哪一行 `setState`。警告只出現在 U11，其他 13 項沒有。

## 根因

U11 只把 `fetchAnalyticsOverview` 改成手動 Promise。`beforeEach` 仍讓分項、趨勢、場次與班級四支請求用 `mockResolvedValue` 立刻完成。

測試在 `pending.length === 1` 時就離開 `waitFor`。這個條件在 overview mock 被呼叫時就成立，早於另外四支 Promise 的 microtask。那四次 `setState`（三份圖表資料與圖表 loading 結束）因此落在 `act` 外面。

這不是 timer、debounce，也不是卸載後更新。React 18 不會為卸載後的 `setState` 發出這個 warning。元件的 `loadSeq` 已忽略過期請求，問題出在測試沒有等齊同一輪請求。

## 修正

U11 改為五支請求都先懸置，在同一個 `act` 裡依序 resolve。切換學期後先斷言舊數字 777 已消失，再在 `act` 裡 resolve 下一輪，確認新值是 4 且 777 不再出現。

沒有關閉 `console.error`，沒有 mock `act`，沒有把測試 skip。

## 回歸

修正後連續 3 次：

`npx vitest run src/pages/admin/AdminAnalyticsPage.test.jsx`

每次都是 17 passed、0 failed。三次輸出都沒有 `not wrapped in act`。沒有未處理的 Promise rejection。

測試仍會在開發模式印出既有的 `[EEARS Analytics] reservation-capacity-breakdown response` debug。那是頁面的 `console.debug`，不是 React warning。
