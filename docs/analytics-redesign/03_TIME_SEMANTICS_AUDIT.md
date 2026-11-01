# 03 時間語意稽核

## 5.1 實際存在的時間 vs 尚未成為全系統概念

| 時間類型 | 實際欄位或規則 | 狀態 |
|---|---|---|
| Event Time | `events.date`（字串，分析時 CAST 成日期，對 `SEMESTER_RANGES`） | 已實作於 `analyticsService.js` |
| Reservation Time | 預約建立時間是否進入成效頁：本次未追預約模型全文 | UNKNOWN |
| Attendance Time | `bestep_attendance.examDate`；活動簽到時間在營運分析 | 培力出席已見；活動簽到欄位名 PARTIAL |
| Assessment Time | `EtExamAttempt.testDate`；培力成績列綁 `semester` 字串，精確日期是否每列都有：PARTIAL | 嘗試有考試日；培力成績主時間是學期 |
| Import Time | `bestep_exam_scores.importedAt`、`sourceFile` | 有欄位。分析 API 是否對外暴露：UNKNOWN |
| Academic Semester | `SEMESTER_RANGES` 日期區間；名冊 `semesterId`；培力 `semester` 字串 | 三套並存，見下節 |
| Reporting Period | 未找到獨立於學期的「成果報告期間」實體 | 概念未實作 |
| Observation Window | 技能成長用梯次：非 BESTEP 14 日內合併，BESTEP 同學期合併（`examSessionService.js`） | 只在歷程／LVA 聚合，不是全站篩選器 |
| Baseline / Follow-up | 學測 GSAT 標成入學分級、不可當前測（同檔 `PLACEMENT_BASELINE_INSTRUMENTS`）。英檢前後測是第一梯／後一梯 | 已實作於考試聚合，不是行政學期 |
| Data Version Time | `snapshot_version`；總覽預設最新版 | 已實作。與匯入時間無自動等式 |

## 5.2 「學期」不是同一個詞（F-02）

1. **日期學期**：活動日是否落在 `utils/semesterConstants` 的區間。跨日活動、補資料改日期，會改屬於哪一學期。
2. **名冊學期**：`et_enrollment_snapshots.semesterId` 且 `isActive`。KPI 與 B2 報告的分母。
3. **培力檔案學期**：匯入時指定的 `semester`，出席與成績查詢都帶這個字串（`bestepClassService`）。
4. **快照版本**：`lj_analytic_*` 的 `snapshot_version`。總覽篩選刻意拿掉學期（`OVERVIEW_FILTER_KEYS`）。快照裡的人可以跨很多學期累積。

`semesterIdFromDate` 另用於把 BESTEP 考試日收成同一梯。若日期對不上區間表，會落到 `_unmapped:` 鍵（`clusterExamDatesBySemester`）。這是第五種、僅存在於聚合函式內的時間桶。

## 5.3 八種衝突情境

| # | 情境 | 系統現況 | 可能誤差 | 架構要解的問題 |
|---|---|---|---|---|
| 1 | 114-1 參加活動，114-2 才考英檢 | 活動在日期學期；成績在培力學期或嘗試日。快照可把兩邊都投影到同一學生 | 若用「同學期」當關聯條件，這段參與不會算進 114-2 成績；若用快照累積時數，則會算進、但無法說是考前 | 關聯分析必須明示觀察窗：考前／當學期／累積 |
| 2 | 112-1 成績在 114-2 才匯入 | `importedAt` 是 114-2，成績列的 `semester` 仍是檔案上的學期（若匯入者填對） | 用匯入日當考試學期會錯；用檔案學期則對，但沒有強制與考試日一致的檢查（本次未見） | 分開 exam semester、import time、file label |
| 3 | 同一學期多次測驗 | KPI 載入該生**全部** valid 嘗試，排序 `testDate ASC`（`loadAttemptsForStudents`）。政策如何在多筆中取用：未逐行讀完 `kpiPolicyEngine` 的選筆規則，標 PARTIAL | 可能把另一次考試算進本學期達標 | 達標必須宣告「哪一次嘗試」 |
| 4 | 多來源英檢 | 快照與 KPI 都可含多工具。KPI 註解禁止混工具湊成對（`kpiPolicyDefaults.js` 文案）。技能成長依工具分梯，優先序 BESTEP、TOEIC、IELTS、TOEFL、GEPT | GSE 讓不同工具可比較，但不是同一量尺的原始分 | 呈現用 CEFR／GSE 時標工具；原始分不可跨工具加總 |
| 5 | 跨學期持續參與 | 快照資源時數是累積語意（接近 B2 服務註解：「活動仍用分析快照累積時數」） | 與「本學期參與」的營運數字不可比 | 行為時鐘與累積時鐘分欄 |
| 6 | 有學期、無精確日期 | 培力成績以 `semester` 過濾；嘗試表有 `testDate`。缺日期時 14 日窗會變成無窮大距離（`daysBetween` 無法解析則 `POSITIVE_INFINITY`），無法與其他日合併 | 無日期的非 BESTEP 考試各自成梯或被排除：需讀 `cluster` 呼叫端才能斷言，標 PARTIAL | 缺日期必須標「僅學期」，禁止假裝有日 |
| 7 | 第一次被觀測 ≠ 學習起點 | 前後測取第一梯有效英檢；GSAT 不當前測。名冊學期不是學習起點 | 把名冊學期當 baseline 會把更早的 BESTEP 當成「本學期進步」 | 起點只能是指定工具的第一個有效觀測 |
| 8 | 學期篩選 vs 測驗批次 | 名冊是行政名單；BESTEP 批次是匯入列；快照是版本。三個篩選的人數不必相等 | 同一張簡報並排會被讀成同一群人 | 每張圖標母體 id，而不是只寫「114-2」 |

## 5.4 時間比較可行性

| 分析 | 同期間 | 跨期間 | 條件 | 不建議 | 證據 |
|---|---|---|---|---|---|
| 活動營運 KPI（預約、名額、簽到） | 可以，若兩段都用 `SEMESTER_RANGES` | 可以比速率，不可把未建活動的學期當成參與下降 | 活動供給量要一起看 | 與英檢達標率直接相減 | 程式已見日期規則；供給量是否進同一 API：PARTIAL |
| 培力班級出席／四項 B2 | 同一 `semester` 字串內可以 | 僅當每學期匯入欄位與 `isPassed` 規則沒變 | 加號已被剝除，不能回比簡報 B2+ 堆疊 | 與 KPI 成對達標比 | 高 |
| KPI 成對達標 | 同一政策＋同一名冊定義下，學期之間可並排 | 分子含該生更早或更晚的 valid 嘗試，**跨學期數列不是「當學期考試」** | 必須改成「名冊學期結束前的嘗試」或「指定批次」後才可當官方趨勢 | 現況直接當「該學期考試成果」 | 高（載入範圍）；選筆規則 PARTIAL |
| 歷史最佳技能 B2 率 | 同名冊定義可算 | 率會隨日後更好的成績改寫**過去學期**的歷史最佳 | 若要趨勢，應凍結「截至該學期結束」 | 把重算後的歷史最佳當成當年成果 | 高 |
| 快照 CEFR／GSE 分布 | 同一 `snapshot_version` 內可以比系所 | 不同版本可串，但是重建規則變更會斷裂 | 版本號與規則變更紀錄 | 把快照版本差說成學生進步 | 中 |
| 技能成長（前後梯） | 同一工具、同一窗規則內 | 跨工具只用 GSE 並標示 | 樣本須有兩梯；學測排除 | 沒有第二梯仍畫成長 | 高（窗規則）；樣本流失率需資料驗證 |
| 學習有伴 vs 非有伴 | 同學期 BESTEP 成績可以描述差距 | 跨學期只有在組隊定義不變時 | API 已寫自選偏誤 | 寫成參加導致進步 | 高 |
| 校正後成長、資源效果 | 同一模型執行內可描述 | 跨模型執行不可比，除非係數定義相同 | `causalClaimAllowed` 預設 false | 對外說因果成效 | 高（旗標）；實際列值需資料驗證 |
| 未掛載 `englishTestsRouter` | — | — | — | 不要當成已上線的跨學期英檢 | 高（未掛載） |

## 5.5 比較限制（不可為了統一圖表而假設）

歷史最佳會被未來成績改寫。快照是版本，不是學期。培力加號已無法從現庫還原。這三件事足以禁止「一條學期軸＋一個 B2 線」的總圖。
