# 03 B2 與達標口徑

門檻數字是程式裡的預設，不是本文件核定的政策。需要中心決定的標 `BUSINESS_DECISION_REQUIRED`。

## 規則一覽

| 規則 ID | 對象 | 通過條件 | 分母 | 成績從哪來 | 時間 | 狀態 |
|---|---|---|---|---|---|---|
| R-FILE-4SKILL | 一筆培力成績列 | 四科正規化 CEFR 都 ≥ B2 | 班級：registeredCount | `bestep_exam_scores.passed` | 檔案學期 | VERIFIED |
| R-OPS-PASS-ATT | 行政名單上的人 | 同一 `passed` | max(LR 出席, SW 出席) | 同上 | 檔案學期；出席只認 LR／SW | VERIFIED |
| R-REG-FLAG | 報名列 | `hasCEFRB2` 肯定值 | 該學期報名列 | 報名表欄位 | 報名學期 | VERIFIED。欄位語意 UNVERIFIED |
| R-PAIR-CEFR | 名冊學生 | 聽讀或說寫兩科 rank≥4，同工具 | 名冊 | `et_exam_attempts` | 預設終身；組場同日或跨日 | VERIFIED |
| R-PAIR-SUM | 名冊學生 | 同工具成對原始分 ≥ 工具門檻 | 名冊 | 同上 | 同上 | VERIFIED。BESTEP 200／560 只是其中一種工具規則 |
| R-BEST-SKILL | 名冊學生 × 技能 | 該技能歷史最高 rank≥4 | 名冊 | 同上，不限同一筆 attempt | 查詢當下為止的所有 valid | VERIFIED |
| R-CELL | 快照考試格 | 該格 rank≥4 | 視頁面 | 投影後的考試事件 | 快照版本 | VERIFIED |
| R-NEAR | 快照學生 | 未達 B2 且 GSE 51–58 | 快照可換算者 | 快照分數→GSE | 快照版本 | VERIFIED |

沒有「單次培力場次達標率」這個已掛載指標。R-FILE-4SKILL 是檔案學期的列，不是「2026-04-12 這一場、出席者為分母」。

## A. 單次測驗

若「單次」指同一考試日、同一工具：

- 只有 S6 的 `same_date` 組場接近這個意思，而且只在 `et_exam_attempts`。
- 培力 Excel 路徑沒有「這一場」的達標率。出席匯入可以帶 `examDate`，成績列的時間鍵是 `semester`。
- 缺考：成績匯入要求至少一個分數，且要求報名成功。沒被匯入的人不在 `bestep_exam_scores`。他們在班級頁是沒有 score，在 `passedCount` 裡不會被算成通過，是否留在 `registeredCount` 要看統計函式怎麼數報名。PARTIALLY_VERIFIED：`buildClassBestepOverviewStatistics` 用班級成員與名冊，不是「有分數的人」。
- 缺等級：`isPassed` 要求四個等級都在列表，否則 false。缺等級與四科都低於 B2 在布林上相同。
- 多筆：成績 map 後寫覆蓋，不是取最高，也不是取指定場次。
- 四技能聯合：只有 R-FILE-4SKILL。KPI 沒有「四科同時」dimension。
- 技能門檻：培力檔用 CEFR 序位。KPI 的 BESTEP 成對用分數和（200／560），`both_cefr` 政策則不用這兩個數。

`BUSINESS_DECISION_REQUIRED`：單次場次的分母是報名成功、有到該科、還是四項都到。

## B. 學期名冊累積

名冊來源：`et_enrollment_snapshots`，`semesterId` + `isActive: true`。誰寫入名冊、何時凍結：本階段未讀 enrollment import 全文。PARTIALLY_VERIFIED。

| 問題 | R-PAIR（內建預設） | R-BEST-SKILL |
|---|---|---|
| 成績截止日 | 無。`timeWindow=lifetime` | 無。查詢當下 |
| 納入歷史測驗 | 會，只要在 et 表且 valid | 會 |
| 未來測驗改寫過去學期的率 | 會。明年的 attempt 仍算進今年名冊的「通過」 | 會。更高 rank 取代舊的最佳 |
| 歷史最佳 | 成對不是歷史最佳；`cross_date` 是各技能最佳再組合，接近最佳但不跨工具 | 是 |
| 跨考試組合技能 | `same_date` 不可跨日。`cross_date` 可跨日、不可跨工具。預設政策是 same_date＋both_cefr | 可跨工具、跨日 |
| 沒參加任何 et 嘗試 | 留在分母，算未通過 | 各技能未通過，仍在分母 |

`BUSINESS_DECISION_REQUIRED`：名冊達標是否允許歷史與未來嘗試。程式現在允許。這不是資料錯誤，是預設政策。

## C. 能力變化

| 項目 | 程式 |
|---|---|
| Baseline | 同一工具的前一梯。學測 GSAT 標成入學分級，不進入分析考試列，也不能當英檢前測（`examSessionService.js` 11–16 行） |
| Follow-up | 下一梯。BESTEP 以 `semesterIdFromDate(考試日)` 合併同學期分日。其他工具 14 日內合併 |
| 工具相同 | 前後 delta 只在同一 `instrument` 的相鄰梯。跨工具不產生 `deltaRawScore` |
| 量尺 | 原始分差僅同工具。GSE 用來把不同工具放上比較尺，技能頁應標鈍化（產品 skill 的規則；頁面是否每格都標：PARTIALLY_VERIFIED） |
| CEFR | 序位 1–6。差一個 rank 不是等距。校正回歸另有 CEFR 帶序位，含 `BELOW_A1: 0.5`、`UNKNOWN: 2.5`（`lvaAdjustedGrowthService.js` 23–31 行） |
| 沒有前後測 | 不產生 delta，`improvedFlag` 為 null。他們不在成長平均的分子，是否仍在頁面分母要看該頁。技能成長服務會收「有成長對」的人。PARTIALLY_VERIFIED 頁面是否把排除人數寫出來 |
| 觀測偏差 | 考前時數窗是上一梯結束到這次考試日。沒有上一梯則窗起點 null，`sumResourceInExposureWindow` 的 null 起點行為未在本檔讀完。PARTIALLY_VERIFIED |

歷史最佳不是變化。把兩次 R-BEST-SKILL 相減，會把「後來考更好」說成「該學期的成長」，而且中間沒有固定截止日。

## D. B2+ 是否還在

| 問題 | 結論 | 狀態 |
|---|---|---|
| Excel 原檔是否留在磁碟 | 上傳檔存在 `uploads/bestep/`，檔名是時間戳加亂數，不是原始檔名。是否長期保留、是否可對回 `sourceFile`：UNVERIFIED | 程式只證明有寫檔 |
| 資料庫是否有原始等級欄 | `listeningLevel` 等存的是正規化結果。沒有 `listeningLevelRaw`。`exam_attempts.rawPayload` 在 BESTEP sync 只寫 `{ bestepExamScoreId, sync: true }`，不含原始等級字串 | VERIFIED |
| 清洗前後是否都留 | 沒有。只留清洗後 | VERIFIED |
| 匯入可否追溯 | 列上有 `importedAt`、`sourceFile`。同步列有 `sourceRef = bestep_exam_scores:{id}` | VERIFIED 欄位；正式檔是否還在 DATA_VALIDATION_REQUIRED |
| 能否用分數重建 B2+ | 不可以。B2 與 B2+ 在 CEFR 字串上被折成同一級，分數門檻不能反推加號，除非另有官方分數對照且業務承認。本文件不建立這種對照 | VERIFIED 資訊已丟；重建不可靠 |
| 其他管線是否同樣去加號 | 學習歷程 `normalizeCefr` 去掉結尾加號（`cefr.js` 36–42 行）。KPI `skillMapFromAttempt` 又呼叫它。英檢嘗試匯入 `examAttemptImportService.normalizeCefr` 存在，本次未比對是否與培力同一規則 | 培力與 LJ：VERIFIED 都去加號；et 匯入函式本體 PARTIALLY_VERIFIED |

因此現庫的 `B2` 不能解讀成「不含 B2+」，也不能解讀成「含 B2+」。它是摺疊後的基底等級。

## 尚未由業務選定的規則

1. 對外年度成果用 R-PAIR 的哪一種組場與 passMode，還是用 R-FILE-4SKILL。`BUSINESS_DECISION_REQUIRED`。
2. 分母用名冊、報名成功、到考、還是四項都到。`BUSINESS_DECISION_REQUIRED`。
3. 200／560 與「兩科 CEFR≥B2」哪一個是培力官方成對。程式兩者都有，預設政策鍵是後者。`BUSINESS_DECISION_REQUIRED`。
4. 歷史最佳要不要繼續叫達標。程式可以留著當能力狀態。`BUSINESS_DECISION_REQUIRED`。
