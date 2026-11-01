# 04 指標口徑、母體與重複實作

## Q1 有幾套邏輯

以**計算母體與達標規則**區分，不是以頁面數。已掛載且規則不同的至少六套：

| 套 | 入口 | 母體 | 達標或主指標 | 重複？ |
|---|---|---|---|---|
| S1 活動營運 | `/admin/analytics`、`/admin/reports` | 日期落入學期的活動與預約 | 名額、簽到、違規 | 與英檢無指標重複 |
| S2 培力班級 | 班級 BESTEP | 該班該學期成員 | `score.passed`＝四項等級 ≥ B2 | 與 S4 表面都叫達標 |
| S3 培力報名分析 | 英檢管理數據分析 | 報名列 | 消息來源、系所、年級。不含分數 | 不是成效，是行政描述 |
| S4 學習有伴 | funnel、outcome、ranking | 隊伍或「有成績的有伴 vs 非有伴」 | 流程轉換；成績是描述差距 | outcome 與 S2 共用 BESTEP 列，問題不同 |
| S5 名冊歷史最佳 | `b2-report` | 學期名冊 | 各技能歷史最佳 rank ≥ 4 | 與 S6 分母相似、分子不同 |
| S6 KPI 成對 | `/learning-analytics/kpi` | 學期名冊，可再套政策與工作集 | 聽讀／說寫成對門檻；不混工具 | 與 S5 不可對帳 |
| S7 快照能力 | 總覽、探索、系所、接近 B2、技能、資源 | `lj_analytic_*` 某版本 | 覆蓋、CEFR、GSE、前後梯、曝光 | 與 S5／S6 不同母體 |

S5 與 S6 是**指標不重複、分母來源相同**。S2 與 S6 是**名稱相似**。S7 內部多頁共用快照，是技術共用，不是六個獨立真相。

未掛載路由檔不計入線上套數。

## 分母對照

| 指標 | 分子 | 分母 | 檔案 |
|---|---|---|---|
| 班級通過率 | `score.passed` 人數 | 該班 `registeredCount`（統計函式註解：全班、名冊本國生口徑） | `buildClassBestepOverviewStatistics` |
| 學期技能 B2 率 | 該技能歷史最佳 rank≥4 | 名冊 `isActive` 人數（可被 `allowedStudentIds` 縮小） | `getSemesterB2Report` |
| KPI | 政策判定通過 | 政策人口後的名冊（含工作集） | `runKpiReport` |
| 有伴通過率差 | 兩群 `passRatePct` 之差 | 各群「有 BESTEP 成績」的人，不是全體隊員 | `learningPartnerOutcomeService` 的 `partnerWithoutScoreCount` 另計 |
| 快照 b2plusRate | `totals.b2plusCount` | 快照篩選後學生 | `getLearningAnalyticsOverview` headline。總覽 UI 已不顯示此卡，API 仍回 |
| 接近 B2 | GSE 51–58 且未達 B2 | 快照中可換算者；學測排除 | `b1PlusWatch.js` |

`registeredCount` 與名冊人數是否同一批人：班級統計會 `loadSemesterRosterMap`，註解主張與匯出一致。本次未逐行對「沒有名冊列的班級成員是否排除」，標 PARTIAL，需資料驗證。

## 同一名稱不同意義

- **B2+**：註解與 `certification.note` 使用此詞；等級正規化後 rank 4＝B2，加號不存在。簡報「B2 以上含 B2+／C1／C2」若在匯入前的檔案成立，匯入後 B2+ 與 B2 不可分。
- **達標**：班級四技能 CEFR；KPI 成對分數；學習有伴沿用成績列 `passed`。三個「達標率」不能放進同一圖例。
- **學期**：見 `03`。
- **前測**：第一梯有效英檢，不是名冊學期，不是學測。

## 權限造成的隱形母體（F-09）

活動分析與報表依角色縮小班級或教師範圍。學習成效工作集用 `studentIds` 縮小，橫幅寫「目前只分析這個群體」。兩套縮小機制互不相通。沒有工作集時，學習成效仍可能受後端 scope 限制；本次未逐一路由核對 `requirePermission` 與資料範圍中介層，標 PARTIAL。

## 匯入更新後分析是否跟著變

| 讀取點 | 匯入後 |
|---|---|
| 班級 BESTEP、有伴 outcome | 讀 `bestep_exam_scores`，下次請求即新資料（在同一學期鍵下） |
| KPI、B2 報告 | 讀嘗試表與名冊，不經快照。嘗試若由另一條匯入寫入，與培力 Excel 不一定同一筆 |
| 總覽、技能、資源、探索 | 讀快照。未重建則仍是舊投影 |

培力 Excel 與 `EtExamAttempt` 是否為同一匯入管線：本次未追完，**UNKNOWN**。若是兩條管線，S2 與 S6 連來源列都不同。

## 舊資料與新資料混用

已證實的混用：

1. KPI 分母是某一學期名冊，分子是該生所有時期的 valid 嘗試。
2. B2 報告分母是某一學期名冊，分子是截至**查詢當下**的歷史最佳，日後更好的成績會改寫該學期比率。
3. 快照累積活動時數可含多學期，旁邊的 KPI 卻是單一學期名冊。

未證實：正式庫裡這三種混用各佔多少人。列為資料驗證項 V-01、V-02、V-03（見 `07`）。
