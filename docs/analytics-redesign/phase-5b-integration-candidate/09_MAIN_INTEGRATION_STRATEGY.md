# main 整合策略

未執行。快轉可行不等於已經核准。

## 回答

1. 工程整合條件：有。Node 20 回歸、瀏覽器、ESLint、build 都在候選樹上通過，且沒有改公式。
2. 快轉：以目前 `main` 而言可以。`main` 是祖先，落後 0、超前 17。若 `main` 先收到別的提交，就要重算。
3. UX Consolidation 不需要排在 Analytics 前面。2a、2b、2c 的尖端已經在 `main` 裡。先合併它們不會改變 `main`。
4. 若兩邊都要進 `main`：UX 已在裡面。剩下的是 Analytics 這 17 個提交。不要把空狀態工作樹再合併一次。
5. 目前沒有必須先修的路徑衝突。依賴差異只有 Analytics 要帶進的 Playwright 與 user-event devDependency。
6. 不改統計政策也能做的：快轉或合併這 17 個提交、在目標環境重跑本文件的測試、維持 Shadow 關閉。旗標大小寫與匯出空白是已知差異，不是這次的修復項。
7. 必須等業務決策：F-BESTEP-01、D1–D11、DG-BESTEP-01–05、任何官方達標率或因果敘述。L3 也要等授權。
8. 合併後重跑：本文件 03、04、05 的同一組命令，Node 20，再加上部署前既有的 CI。
9. 回退：先記下合併前的 `main` `1f41dd5202c5672076ab3181e563effb172823fe`。尚未推送時，只有負責人明確要求才能把 `main` 指回該 SHA。已推送時，用 revert 這 17 個提交，不用 hard reset。Shadow 未設定就不會在正式環境執行。
10. 核准者：發布負責人核准 `main` 更新。英語中心業務負責人需要知道使用者會看到活動文案與出席「未確認」，但這次合併不是通過率政策的核准。

## Recommended Integration Order

1. 發布負責人核准後，把 `integration/analytics-phase5b-candidate`（`15974e0`）快轉到 `main`。
2. 在 Node 20 重跑本階段的後端、前端、Playwright、ESLint 與 build。
3. 確認三個 Shadow 環境變數在目標環境沒有設成啟用。
4. 官方數字與 L3 留在後續決策，不跟這次合併綁在一起。

## Required Approvals

- 發布負責人：允許更新 `main`。
- 不需要業務負責人事先選定 A/B/C 才能合併，因為公式沒有改。
- 沒有這個核准之前，不得更新 `main`。
