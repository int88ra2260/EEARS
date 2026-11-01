# Phase 5A 執行摘要

日期：2026-11-01。方法：讀 Git、契約程式、掛載點與本階段重新執行的測試。未連資料庫、未改 KPI、未部署、未 push。

## 目前位置

Analytics Redesign 在 `analytics/phase-4b-temporal-context`，HEAD `1a005991685d0e05c4d119092064d97cdac77b52`。這條分支比 `main`（`1f41dd5`）超前 16 個提交，且 `main` 是它的祖先，所以相對 `main` 可以快轉。它尚未追蹤遠端，也尚未合併。

Phase 4N.1 已在本階段開始時提交：`test(bestep): add browser acceptance for attendance UX`。Phase 5A 文件留在工作樹，未提交。

## 哪些成果已經在這條分支上

- 32 個 Metric ID、7 個領域、9 個時間契約、D1–D11 全部 `pending`。`officialUseAllowed` 與 `causalClaimAllowed` 皆為 false。兩個指標維持 `not_implemented`：`ops.participation.streak`、`roster.pair_pass.both_pairs`。
- 三個 Shadow 都掛在正式流程之後、回應送出之前或匯入提交之後。預設關閉，`NODE_ENV=production` 一律不執行。它們不改回應、不寫資料庫。
- 活動營運總覽的文案與版面已在 `AdminAnalyticsPage`。`englishPassRate` 留在「報名資料」補充區，標題是「報名資料 B2 標記比例」。
- 班級 BESTEP 出席：`true` 出席、`false` 缺席、其餘在有出席結構時顯示「未確認」。空出席物件仍是「未匯入」。總分 `0` 顯示為 0。
- 班級 `passRate` 公式沒有改。F-BESTEP-01 仍是 `decision_pending`。

## 哪些還不是正式發布

瀏覽器驗收使用合成資料與隔離 harness，不是正式環境。沒有 L3 真實資料驗證，沒有 Staging 驗收，沒有 Production 核准，也沒有部署。D1–D11 與 DG-BESTEP-01–05 都還沒有業務決定。

## 最高優先風險

沒有發現新的 P0（Shadow 寫入、回應被改寫、憑證進入測試）。

P1 是既有班級通過率母體不一致：程式在 `registeredCount > 0` 且 `passedCount` 更大時可以算出超過 100%；分母為 0 時公式回 0，即使分子大於 0。這在合成測試已重現，正式班級的出現次數要等 L3。在業務選定分母之前，這個數字不能當中心達標率。

下一個工程動作是把這 16 個提交整條快轉進整合分支之前的核准，而不是再改公式。Phase 5A 沒有執行合併。
