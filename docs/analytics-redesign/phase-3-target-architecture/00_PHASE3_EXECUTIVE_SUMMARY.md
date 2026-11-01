# Phase 3 執行摘要

狀態：`PROPOSED`。日期：2026-11-01。依據是 Phase 2 契約與已讀程式，不是新一輪稽核。未核准 D1–D11。未改程式、未查正式庫。

## 架構一句話

EEARS 下一代成效分析是一層**指標契約**加上三條使用方式：監測（可重算）、正式發布（數值凍結）、探索（另標宣稱等級）。計算可以繼續分散在現有 SQL。不可以再把不同 Metric ID 顯示成同一個「達標率」或「出席率」。

## 與現況最大的差異

| 現況 | 目標 |
|---|---|
| 選單按開發任務分組 | 工作流按主任監測、行政場次、正式發布、教師班級、研究探索 |
| 五種 B2 規則都能被叫達標 | 每種保留自己的 ID。沒有 `official.attainment`，直到 D1 核准 |
| KPI 預設終身嘗試，標題像學期成果 | 結果必須帶時間契約。終身窗不得標成該學期考試 |
| 培力 Excel 與 `et_exam_attempts` 默默以 et 優先進快照 | 讀取層保留兩條來源身分。無法證明是同一場則不合併。優先序等 D11 |
| 快照版本被當成分析截止 | 快照仍是投影快取。正式成果是另一份凍結的 Metric Result |
| `causal_effect` 欄名 | 探索域最高宣稱到統計調整或關聯。因果需另案核准，預設關閉 |

## 安全預設（政策未核准時）

- 監測頁可以繼續算既有數字，但回應與畫面要能帶上 Metric ID（實作在後續工作包，本階段不改 API）。
- 任何新的「正式成果」入口在 D1 核准前是空的，不從 KPI、歷史最佳或班級 `passed` 自動挑一個填進去。
- 不新增跨來源合併，不改 `projectExamEvents` 的 et 優先行為，直到 D11 與並行驗證完成。
- `ops.participation.streak` 與 `roster.pair_pass.both_pairs` 維持 Proposed，不當成已上線。

## 覆蓋矩陣

| 驗收項 | 狀態 | 說明 |
|---|---|---|
| 1. 32 個候選指標都有歸屬 | Covered | `02` 與 `migration_matrix.csv`。2 個是 Proposed |
| 2. 未實作狀態保留 | Covered | streak、both_pairs 標 Proposed |
| 3. 指標對到時間契約 | Covered | 沿用 Phase 2 的 9 個契約，查詢時包進 Query Context |
| 4. B2 不混 | Covered | 沒有統一 B2 指標 |
| 5. 能力狀態與單次成果分開 | Covered | DOM-STATE 與 DOM-ATTAIN |
| 6. 雙軌與衝突 | Partially Covered | 契約與流程有了。誰優先被 D11 擋住，不在本設計裡決定 |
| 7. 監測／正式／探索 | Covered | 三種 Usage Mode |
| 8. 舊快照的限制 | Covered | 快照 ≠ Data As Of ≠ 正式發布。同日覆蓋問題留在遷移，不把快照升級成正式報告 |
| 9. 追溯 | Partially Covered | 目標模型區分 Reproducible／Traceable／Frozen。舊資料多數只能 Traceable 或 Frozen，不能假裝可重算 |
| 10. 既有業務能力 | Covered | 遷移矩陣不刪頁。未追完的問卷、週報、口說標 Unverified，不標成無價值 |
| 11. 遷移與測試 | Covered | 並行比對、合成黃金資料、契約測試、回滾 |
| 12. 未核准決策 | Covered | 全部 Pending。見 `08` |

沒有 Not Covered 的驗收項。Partially Covered 的兩項都是因為業務或歷史資料還不存在，不是因為領域漏畫。

## 文件地圖

領域邊界 `01`，語意層 `02`，時間 `03`，成績來源 `04`，發布 `05`，角色流程 `06`，宣稱 `07`，決策閘 `08`，遷移 `09`，ADR `10`，工作包 `11`。
