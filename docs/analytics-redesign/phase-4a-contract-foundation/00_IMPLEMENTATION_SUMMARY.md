# Phase 4A 實作摘要

狀態：已落地的契約登錄，不是查詢引擎，也不是新的 KPI。

## 完成範圍

在 `reservation-backend/analytics-contracts/` 建立只讀登錄：

- 32 個 Phase 2 Metric ID，ID 未改名、未合併。
- 9 個 Phase 2 Temporal Contract ID。
- 7 個領域（DOM-OPS、DOM-PART、DOM-ATTAIN、DOM-STATE、DOM-LONG、DOM-EXPLORE、DOM-GOV）。
- D1–D11，每一項 `status` 都是 `pending`。
- 17 筆既有入口映射。
- 契約驗證、比較拒絕、As-of 拒絕、正式成果宣稱拒絕。
- G01–G15 合成情境。情境只檢查契約，不計算分數。

沒有 HTTP API。`server.js` 沒有載入這個目錄。

## 設計選擇

- CommonJS，與後端其他服務相同。沒有新的套件。
- 實作狀態與治理狀態分開。`legacyActive: true` 只表示舊程式還在跑，不是 `approved`。
- 沒有任何指標的 `officialUseAllowed` 或 `causalClaimAllowed` 為 true。
- 沒有任何契約的 `asOfQuerySupported` 為 true。`TC-ROSTER-BEST-ASOF-NOW` 的名稱沿用 Phase 2，但查詢截止日的能力標成不支援。
- 成對 CEFR 與成對分數合計仍共用 `roster.pair_pass.listening_reading` 與 `roster.pair_pass.speaking_writing`。比較時若缺少相同 `policyKey`，結果是 `undetermined` 或 `incompatible`，不會被當成同一口徑。
- 三種出席率維持三個 ID，衝突組 `attendance_rate`。不同 ID 的比較是 `incompatible`。
- 查不到 Metric 或時間契約時丟 `ContractRegistryError`（`METRIC_NOT_FOUND`、`TEMPORAL_CONTRACT_NOT_FOUND`）。領域與決策門查不到時回 `null`，由驗證器視為錯誤。

## 刻意不做

- 不重算 B2、出席、成長、去重或快照凍結。
- 不新增事實表、發布 API、儀表板、權限、排程或匯入。
- 不改既有 SQL、路由、schema、前端。
- 不把內建 KPI 政策升格成全系統標準。內建鍵 `pair-bothcefr-samedate-g24` 只出現在測試夾具與映射備註，表示 legacy 行為。

## 數量（由登錄程式讀出）

| 項目 | 數量 |
|---|---|
| Metric | 32 |
| 已實作 / 部分 / 未實作 | 22 / 8 / 2 |
| 治理 proposed / pending_decision / deprecated_candidate / approved | 18 / 13 / 1 / 0 |
| Temporal Contract | 9 |
| Domain | 7 |
| Decision Gate | 11，全部 pending |
| Legacy mapping | 17（verified 7、partial 7、unmapped 3、ambiguous 0） |
