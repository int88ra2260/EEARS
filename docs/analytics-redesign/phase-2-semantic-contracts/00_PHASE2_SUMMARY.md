# Phase 2 總結：分析語意契約

日期：2026-11-01。方法：讀 Phase 1 文件後，對照路由、服務、SQL 與測試。未查正式資料庫，未改既有功能。

狀態：`VERIFIED` 程式或測試已對上；`PARTIALLY_VERIFIED` 主路徑已讀、支線未讀完；`UNVERIFIED` 只有名稱或文件；`DATA_VALIDATION_REQUIRED` 邏輯已確認、影響量要看資料。

## 對 Phase 1 的修正

| Phase 1 說法 | Phase 2 修正 | 狀態 |
|---|---|---|
| KPI 分子一律是該生全部 valid 嘗試 | 內建八種政策的 `evidence.timeWindow` 是 `lifetime`（`kpiPolicyDefaults.js` 約 141–145 行），所以預設確實不切學期。政策若改成 `date_range` 或 `academic_year`，`resolveEvidenceDateRange` 會濾 `examDate`。通過與否是「任一組場次通過」；`pickBestCandidate` 只在**已通過**的候選裡挑證明列（最高合計，同分取較晚日期），不是「只取最近一次」。 | VERIFIED |
| 培力 Excel 與英檢嘗試是可能同一條或未知 | 不是同一張表。Excel 寫入 `bestep_exam_scores`。匯入成功後 `scheduleBestepScoreAnalyticsPromote` 非同步呼叫 `runSync({ sections: ['bestep_scores'] })`，寫入 **`exam_attempts`**（不是 `et_exam_attempts`），再排程快照重建。KPI 與歷史最佳只讀 `et_exam_attempts`。 | VERIFIED |
| 快照與成績表雙軌 | 快照投影同時讀 `et_exam_attempts` 與 `exam_attempts`，同學生＋工具＋日期＋技能時**保留 et、丟掉 canonical**（`eventProjectorService.projectExamEvents` 註解，約 230–232 行）。班級頁只讀 `bestep_exam_scores`。三條讀取路徑的母體不必相同。 | VERIFIED |
| 班級通過率與 KPI 只是規則不同 | 行政 KPI 還有第三個分母：`getBestepPassMetrics` 的分母是 `max(聽讀出席人數, 說寫出席人數)`，不是報考人數。出席只認 `examType === 'LR'` 或 `'SW'`，不認分開的 L／R／S／W。 | VERIFIED |
| `englishTestsRouter` 可能被腳本呼叫 | `reservation-backend` 內唯一引用是路由檔自己 require controller。`server.js` 未掛載。但它呼叫的 `semesterBestSkillService` 仍被學習歷程重建流程使用。路由未上線 ≠ 底層服務未使用。 | VERIFIED |
| 問卷、週報、口說、微學習是否進快照 | 事件投影來源是英檢嘗試、培力同步後的 `exam_attempts`、活動參與、預約、選課。沒有問卷、週報、口說診斷、微學習。微學習總覽面板讀 `learning_trace_events`，且前端固定 `days: 30`。 | VERIFIED（投影檔無這些來源）；口說是否另有聚合 API：PARTIALLY_VERIFIED |

未推翻的 Phase 1 結論：加號在培力匯入被剝掉；歷史最佳只看 rank、不限學期、會隨新成績改變；`causalClaimAllowed` 在 LVA 回傳裡設為 false；總覽前端篩選不含學期，但 overview API 仍會在 query 帶 `semester` 時呼叫歷史最佳報告。

## 本階段契約範圍

七套邏輯都追到計算函式，並把 S1、S2、S6 內部不同口徑拆開。候選 Metric ID 見 `02_METRIC_DICTIONARY.md`。時間契約見 `04`。快照的 `generatedAt`／`dataAsOf`／規則版本見 `05`。

## 尚未當事實的事

正式庫裡有多少 KPI 通過來自名冊學期以外的考試日、有多少培力列沒有對應的 `et_exam_attempts`、已匯入等級是否已無加號、快照時間是否晚於最近匯入。這些只在 `10_VALIDATION_PLAN.md` 給唯讀 SQL 草案，沒有執行。

## 交叉檢查

| 檢查 | 結果 |
|---|---|
| 字典是否涵蓋 Phase 1 主要資產 | 有。未掛載路由不發 Metric ID，只在邏輯追溯標成未上線。微學習另立 ID，不併進快照。 |
| 時間契約能否對到 Metric ID | 能。每個 ID 的 Time Model 指向一個 Temporal Contract。活動「持續參與」沒有實作，契約標 `NOT_IMPLEMENTED`。 |
| 譜系能否追到來源表 | 能，到表與函式。欄位級對照在投影函式內仍有 PARTIALLY_VERIFIED（預約列如何換成時數）。 |
| 決策清單是否蓋住未決規則 | 有。門檻數值（200／560、rank 4）標成已寫進程式的預設，不是已核准的政策。 |
| 架構含義是否有證據 | 有，且只寫「契約分裂」對設計的後果，不重寫三方案建議書。 |
| 是否把未追完的資產當成沒價值 | 沒有。問卷、週報、ET 分組 GSE 快照、口說診斷列為獨立能力，證據等級另標。 |
