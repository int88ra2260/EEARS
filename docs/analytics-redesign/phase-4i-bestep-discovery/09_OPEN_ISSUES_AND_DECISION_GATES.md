# 未決事項

D1–D11 維持 Pending。這裡只記錄 BESTEP 盤點新看到的閘門，不代替決定。

| Gate | 問題 | 程式現況 | 在決定前不能做的事 |
|---|---|---|---|
| D1 | 單科 B2 是否等於學生達標 | `skill_reached_b2` 與 `four_skill_cefr_b2` 分開 | 把任一科 B2 顯示成學生通過 |
| D10 | CEFR 加號 | 匯入時刪除加號 | 把欄位裡的 B2 還原成 B2+ |
| D11 | 三個來源誰優先 | 班級頁讀成績檔；KPI 讀 et；同步寫 exam_attempts | 跨表相加或去重 |
| DG-BESTEP-01 | 一次測驗的日期是檔案學期、LR 日還是 SW 日 | 場次表有兩個日，匯入不寫場次表；成績日是 null | 用學期第一天或出席日填成績日 |
| DG-BESTEP-02 | 沒有出席列算不算缺考 | 讀取時是 null；舊模板非出席字會存成 false | 把 null 計入缺考分子 |
| DG-BESTEP-03 | 班級通過率分母能否當中心母體 | 分母是班級本國生且報名成功 | 把班級 passRate 加成中心達標率 |
| DG-BESTEP-04 | 同步推斷日能否當分析日 | `resolveBestepExamDate` 會寫出席日、匯入日或 1970 | 把 `exam_attempts.examDate` 說成成績檔原值 |
| DG-BESTEP-05 | et 補寫是否為成績進入 KPI 的必要步驟 | 成績匯入只排程 `bestep_scores` sync，hint 指向另一支 promote script | 用 KPI 數字代表成績檔 |

沿用限制：

- `officialUseAllowed=false`
- `causalClaimAllowed=false`
- 報名表 `hasCEFRB2` 不是成績檔結果
- 不同試次的最佳技能不是同一次測驗
- 同日紀錄不自動合併
- 測驗變化不宣稱由中心活動造成
