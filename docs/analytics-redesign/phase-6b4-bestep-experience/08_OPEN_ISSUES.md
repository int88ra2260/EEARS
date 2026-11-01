# 後續

- F-BESTEP-01 仍是 decision pending。沒有核定新的通過率口徑。
- bestep_lead 能開已知班級的 BESTEP 網址，但不能從班級列表進來。Hub 不為他們另做入口。
- 明細的「達標：是／否」是該筆成績的儲存旗標，不是班級官方達標率。
- 錯誤訊息仍走既有 `handleAPIError`。沒有 response 時會顯示連線異常，而不是後端原文。
- 報名沒有 `updatedAt` 時，明細仍可能顯示 Invalid Date。這次沒有改那一行。
- 瀏覽器驗收停在 harness。正式登入與 route guard 尚未走完。
- 螢幕報讀器未測。
- Phase 6B.4 已收斂為本機 commit。尚未併入 `main`，也尚未 push。學習歷程整合不在這次提交。
