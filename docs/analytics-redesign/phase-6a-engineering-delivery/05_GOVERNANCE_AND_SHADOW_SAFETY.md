# 治理與 Shadow

本次沒有改 registry 或公式。Phase 5B 在 Node 20 載入的結果仍適用：32 個指標、7 個領域、9 個時間契約、2 個未實作、D1–D11 pending、`officialUseAllowed` 與 `causalClaimAllowed` 皆 false。

F-BESTEP-01 仍是 `decision_pending`。`bestepClassService.js` 的 `passRate` 不在這次程式差異裡。

三個 Shadow 的掛點與 Phase 5A 相同：活動總覽、成績匯入提交後、班級總覽送出前。預設關、production 關、失敗不改 API、不寫資料庫。`.env.example` 沒有把它們打開。

L3 沒有做。
