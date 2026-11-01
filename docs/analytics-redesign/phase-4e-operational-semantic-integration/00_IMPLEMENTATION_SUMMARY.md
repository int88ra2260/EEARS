# Phase 4E 實作摘要

本階段把 `GET /api/analytics/overview?kind=reservation` 的既有回應做成欄位層級語意契約，並在受控環境用 shadow validation 檢查這份契約。統計公式、SQL、回應形狀與前端都沒有改。

## 已完成

- 以本機 commit `640b2e0` 固定 Phase 4D pilot。訊息是 `feat(analytics): add activity operations semantic pilot`。沒有 push。
- 沿 `analyticsRouter` → `getOverview` → `getReservationOverview` → `getReservationCapacityBreakdown` 對過實際程式。前端只作閱讀，用來確認哪些欄位有被顯示。
- 34 個欄位路徑（頂層 8 個、`capacityBreakdown` 底下 26 個）都有語意類型。沒有為了補滿覆蓋率而新增正式 Metric ID。
- Shadow validator 只讀已經拿到的 legacy 物件與靜態契約。預設不執行。
- `kind=reservation` 在 `getOverview` 多了一段失敗隔離的 hook。其他 `kind` 沒有掛。

## 明確沒做

- 沒有改 `getReservationOverview`、`safePct`、日期條件或名額分項 SQL。
- 沒有把診斷結果放進 HTTP 回應。
- 沒有改權限、其他 analytics 路由、匯入、快照、資料庫或前端。
- 沒有把建議中的 `ops.reservation.violation_row_rate` 寫進 32 個 Metric ID。
- 沒有執行 L3 唯讀 SQL，也沒有連正式資料庫。
- Phase 4E 本身沒有 commit。

## 閱讀順序

1. `01_FIELD_SEMANTIC_INVENTORY.md`：每個回應欄位在數什麼。
2. `02_FIELD_CONTRACT_DESIGN.md`：哪些是指標、哪些只是上下文或切片。
3. `03_SHADOW_VALIDATOR_DESIGN.md` 與 `04_RUNTIME_INTEGRATION.md`：檢查怎麼跑、怎麼失敗才不會影響舊 API。
4. `05_TEST_REPORT.md`：這次實際跑過的測試。
5. `06_UX_INFORMATION_ARCHITECTURE.md`：以後畫面可以怎麼分，這次不改 UI。
6. `07_OPEN_ISSUES.md`：還沒用資料庫證明的口徑。
