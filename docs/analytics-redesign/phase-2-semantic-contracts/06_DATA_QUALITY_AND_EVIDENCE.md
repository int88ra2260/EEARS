# 06 資料品質與證據可信度

每一項都標：影響哪些 Metric ID、偏差、程式是否已證實、要不要看資料、怎麼查、改的時候會碰到什麼既有需求。查詢草案在 `10`，這裡不執行。

## 風險表

| ID | 問題 | 影響指標 | 偏差 | 程式 | 要資料？ | 驗證 | 改動時會碰到的需求 |
|---|---|---|---|---|---|---|---|
| Q1 | 學號正規化不一致（大小寫、全形） | 全部以學號接合的指標 | 同一人變兩人，或快照合併時留下時數較高的那筆、丟掉另一筆身分 | VERIFIED 快照 `collapseWidthDuplicateStudents`；KPI `normalizeStudentId` 只 trim+upper | 要。全形學號是否存在 | 計數 NFKC 後碰撞 | 合併規則若改，歷史快照人數會變 |
| Q2 | 培力成績與 et 嘗試雙寫 | `bestep.file.*` 與 `roster.pair_pass.*` | 班級有達標、KPI 沒有；或快照採用 et 而丟棄 sync 列，兩邊分數不同仍只留一邊 | VERIFIED 寫入目標不同；重疊量 DATA_VALIDATION_REQUIRED | 要 | 學號+學期交集 | 不能把兩條匯入收成一條而不先定誰優先 |
| Q3 | 同鍵後寫覆蓋 | `bestep.file.skill_score`、S1-B 的 score map | 不是最高分，也不是指定場次，是迴圈最後一筆 | VERIFIED 班級 map；匯入是否先刪 PARTIALLY_VERIFIED | 要。同學期多列 | 計數重複學號 | 老師若依賴「後匯入改正」，改成取最高會改數字 |
| Q4 | 缺等級與未達標同一布林 | `bestep.file.four_skill_cefr_b2` | 缺考或漏填等級被算進未通過 | VERIFIED `isPassed` 長度必須為 4 | 要。四科 null 的比例 | 列舉 null 等級且 passed=false | 若把缺考移出分母，通過率上升，與現在班級卡片不同 |
| Q5 | 分數 0 與缺分 | `bestep.file.skill_score` | `parseNullableScore` 空字串是 null，數字 0 是 0。0 會通過「有分數」檢查，若低於下限才拒絕 | VERIFIED 空與 0 不同；0 是否在合法區間內看 SCORE_RANGES，未抄表 | 部分要 | 計數分數為 0 | 不要把 0 改成 null |
| Q6 | 跨工具直接比原始分 | 若有人把 KPI 不同工具的 combined 拿去平均 | 引擎不把不同工具合成一對。頁面若只顯示「達標人數」則沒有比分。技能成長的原始差只在同工具 | VERIFIED 成對不跨工具 | 否（規則）；頁面有沒有並列原始分 PARTIALLY_VERIFIED | 看技能頁工具篩選 | GSE 比較是另一步，不能拿來當達標 |
| Q7 | 學期母體不同仍放在相鄰頁 | 活動率、班級通過率、名冊 KPI、快照覆蓋 | 讀者當成同一群人 | VERIFIED 四套 WHERE | 要。同一學期四個分母的人數 | 只算人數、不輸出姓名 | 導覽已分組，數字仍未標母體 id |
| Q8 | 成績更新後分析未同步 | `snapshot.*` | 匯入已成功但重建失敗或尚未跑完 | VERIFIED 非同步且失敗只 log | 要。importedAt vs derivedAt | 時間差 | 班級頁即時、快照頁延遲，兩邊都有人用 |
| Q9 | 正規化丟掉加號 | 所有 CEFR 達標與分布 | B2 與 B2+ 不可分；`未達A1` 變成 A1 | VERIFIED | 要。現值是否還有加號 | DISTINCT level | 不能靠重算恢復。新欄位才影響以後的匯入 |
| Q10 | 歷史最佳的選擇 | `roster.best_skill_rank_b2` | 只留下最好的一次，平均能力被高估；跨工具挑最高 | VERIFIED | 要。最佳日期是否晚於名冊學期 | 日期分布 | 這是能力狀態就保留；當批次成效就會誤用 |
| Q11 | 沒有凍結截止日 | `roster.pair_pass.*`、`roster.best_skill_rank_b2` | 補資料後舊學期變好 | VERIFIED | 要。見 V-01 | 唯讀聚合 | 若業務要「最新」就不要改；若要「發布日」就要 as-of |
| Q12 | 工作集與權限 | 快照頁、KPI | 分母變小但標題仍像全校。工作集有橫幅。活動 scope 是否每圖都有句子：PARTIALLY_VERIFIED | VERIFIED 機制存在 | 用兩個角色看同一 URL 即可，不必掃全表 | 測試帳號 | 教師本來就該看自己的班。要標示，不是拿掉範圍 |
| Q13 | 培力出席只認 LR／SW | `bestep.file.attendance_lr_sw_avg`、行政通過率分母 | 若實際匯入的是 L／R／S／W，出席率變 0，通過率分母變 0 | VERIFIED `kpiService.js` 158–159 行 | 要。examType 分布 | DISTINCT examType | 班級頁看分項；行政 KPI 看合併碼。兩邊都有使用習慣 |
| Q14 | 活動日期兩種比較 | 營運列計數 vs 名單參與率 | 同一學期人數對不上 | VERIFIED CAST vs 字串 BETWEEN | 要。帶時間尾碼的 date 有多少 | 計數無法 CAST 或字串區間不一致的列 | 統一解析會改其中一邊的歷史數字 |
| Q15 | 預約列含未排除狀態 | `ops.reservation.row_count` | 取消或草稿若仍在表內會進分母 | VERIFIED SQL 無狀態過濾；有哪些狀態 UNVERIFIED | 要 | group by 狀態 | 現場若用「全部列」當工作量，過濾會讓利用率下降 |

## 候選 Evidence Quality Model（不實作）

現有 `snapshot.evidence_quality` 只服務快照學生篩選與回歸共變項。它沒有覆蓋培力檔、名冊 KPI、活動列。

建議以後每一個對外數字帶同一組標籤，而不是再做一個分數：

| 標籤 | 值從哪裡來 | 現在有沒有 |
|---|---|---|
| population_id | 名冊學期、班級、預約日期區間、快照 version、工作集 hash | 分散在各 API，沒有共同欄位 |
| rule_id | 本字典的 Metric ID＋政策鍵或 RULE_VERSION | 沒有統一 |
| as_of | 查詢時間、derivedAt、或業務截止日 | 快照有 derivedAt；KPI 沒有 |
| missing_policy | 缺等級算未過、或移出分母 | 隱含在程式，沒有隨數字送出 |
| identity_confidence | 學號是否經過 NFKC、是否發生合併 | 只有快照內部做了，沒有輸出 |
| source_lag | 來源最大時間減顯示時間 | 沒有 |
| claim_level | descriptive／comparative／longitudinal／associational。禁止在標籤以外使用因果句 | LVA 有 `causalClaimAllowed`，其他 API 沒有 |

這組標籤是契約，不是新的儀表板。沒有標籤的數字不應進主任的「要交的結果」。現階段不要計算一個 0–100 的品質分，因為那會把不同偏差加成一個假精確的數。
