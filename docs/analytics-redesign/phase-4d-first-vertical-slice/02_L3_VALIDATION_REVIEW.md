# L3 唯讀驗證審查

審查對象是 `phase-4c1-contract-hardening/06_L3_READONLY_VALIDATION_PLAN.md`。本階段沒有執行這些語句，沒有讀 `.mysql-data/`，也沒有還原 SQL dump。

執行前的共同條件：唯讀帳號、複本或低峰、先 `EXPLAIN`、只取聚合、輸出不含學號與姓名。授權人是資料庫管理人，不是這次的自動作業。

先做的索引檢查，本身不讀業務列：

```sql
SHOW INDEX FROM exam_attempts;
SHOW INDEX FROM et_exam_attempts;
SHOW INDEX FROM bestep_exam_scores;
SHOW INDEX FROM events;
```

## V01 投影鍵完整率

- Hypothesis：培力同步列裡，`source_ref` 與 payload id 同時存在的比例可能不是 100%。
- Tables / columns：`exam_attempts.source_type`、`source_ref`、`raw_payload`。
- SQL：草案第 1 段的 `COUNT` / `SUM`。先跑不含 `JSON_EXTRACT` 的計數；衝突計數另跑。
- Interpretation：分母是 attempt 列數。`source_ref_linked` 低，只表示鍵不完整，不表示哪一列才是正式成績。
- Privacy：只有數量。
- Performance：`source_ref` 沒有索引，預期掃表。JSON 判斷更貴，資料量大時不要和第一個計數綁在一起。
- Impacted metrics：跨來源投影，不是活動營運指標。
- Next decision：D11 仍 pending。比例只供以後決定是否抽樣，不授權合併。

## V02 同源成績與 CEFR 衝突

- Hypothesis：已確認投影的技能列裡，原始分或正規化 CEFR 不同的比例大於零。
- Tables / columns：`exam_attempts.source_ref`、`exam_attempt_skill_scores.skill`、`raw_score`、`cefr_level`，以及 `bestep_exam_scores` 的四個分數與等級欄。
- SQL：草案沒有這一段。建議在 V01 的連結列數可接受之後，再按技能做聚合。第一版只輸出 `skill`、`compared_rows`、`score_conflicts`、`cefr_conflicts`，不輸出學號。CEFR 比較前要沿用匯入已去掉加號的規則，否則 `B2+` 與 `B2` 會被算成衝突。
- Interpretation：衝突筆數支持「投影存在但內容不一致」。它不決定保留哪一個分數。
- Privacy：禁止把學生鍵放進 SELECT。
- Performance：技能子表連接可能是這組裡最重的查詢之一。沒有 V01 的量級之前不要跑。
- Impacted metrics：培力分數與等級，不是本試點的預約列數。
- Next decision：D10、D11。

## V03 testDate 與 examDate

- Hypothesis：兩欄同時有值且不相等的列佔一定比例，所以不能把其中一欄宣佈為正式測驗日。
- Tables / columns：`et_exam_attempts.testDate`、`examDate`。
- SQL：草案第 2 段。
- Interpretation：`both_differ` 是欄位衝突列數。它不指出哪一欄正確。
- Privacy：只有數量。
- Performance：唯一索引用不上這組條件，預期掃表。
- Impacted metrics：英檢日期語意。活動營運試點不讀這張表。
- Next decision：正式測驗日仍是 UNKNOWN。

## V04 哨兵與缺日期

- Hypothesis：`1970-01-01` 主要出現在已寫入培力 `source_ref` 的 `exam_attempts`；英檢表不應由同步程式寫入這個日期，但是否為零仍未知。
- Tables / columns：`exam_attempts.exam_date`、`source_type`、`source_ref`；`et_exam_attempts.testDate`、`examDate`；`bestep_exam_scores.examDate`。
- SQL：草案第 3 段，另加：

```sql
SELECT
  COUNT(*) AS bestep_rows,
  SUM(examDate IS NULL) AS exam_date_null
FROM bestep_exam_scores;
```

- Interpretation：`exam_attempts.exam_date` 在 schema 是 NOT NULL，所以缺日期會變成哨兵而不是 SQL NULL。英檢兩欄可空，NULL 與 `1970-01-01` 要分開數。
- Privacy：只有數量。
- Performance：日期等值可能走到 `student_id + exam_date` 索引的日期端。英檢與培力的 IS NULL 預期掃表。
- Impacted metrics：任何把考試日當活動日或學期日的指標。
- Next decision：若哨兵列都帶已確認 `source_ref`，目前 adapter 規則與程式一致。若有不帶鍵的哨兵，要另開資料問題，不在契約裡改成真實日期。

## V05 學期表與程式設定

- Hypothesis：`et_semesters` 的起迄可能空著，或與 `shared/semesterConfig.js` 的含尾日不同。
- Tables / columns：`et_semesters.id`、`code`、`startDate`、`endDate`、`snapshotDate`。
- SQL：草案第 5 段。對照 `114-2` 的程式值 `2026-02-01` 至 `2026-07-31`。
- Interpretation：活動營運 API 讀的是程式設定，不是這張表。兩者不同時，不要改 SQL 去遷就表。
- Privacy：學期代碼與日期，沒有學生欄。
- Performance：表很小。
- Impacted metrics：`TC-OPS-DATE-SEMESTER` 的活動營運指標。
- Next decision：若要讓學期表成為邊界來源，那是以後的契約變更，不是這次試點。

## V06 字串、CAST 與半開區間

- Hypothesis：`events.date` 的字串 `BETWEEN` 與 `CAST AS DATE` 的筆數可能不同。半開區間的筆數尚未測量。
- Tables / columns：`events.date`。
- SQL：草案第 6 段，使用 `114-2` 的含尾日 `2026-02-01` 至 `2026-07-31`。尾日當天可另計 `SUM(CAST(TRIM(e.date) AS DATE) = CAST('2026-07-31' AS DATE))`。
- Interpretation：兩個數字不同，只代表兩種寫法的筆數不同。活動總覽實際用的是 CAST 含尾日。契約半開終點是 `2026-08-01T00:00:00+08:00`。這條查詢沒有證明兩者等價。
- Privacy：只有數量。
- Performance：`events.date` 是字串，CAST 與 TRIM 使索引難用，預期掃表。先看表大小再跑。
- Impacted metrics：`ops.reservation.row_count`、`ops.reservation.checkin_row_rate`、`ops.capacity.reservation_over_seats`。
- Next decision：等筆數出來再決定要不要在文件上加「尾日列數」。不因此改 SQL。

## V07 培力與英檢同日候選

- Hypothesis：同一學號、培力 `examDate` 等於英檢任一日期欄的嘗試列配對大於零。
- Tables / columns：`bestep_exam_scores.studentId`、`examDate`；`et_exam_attempts.studentId`、`testDate`、`examDate`。
- SQL：草案第 4 段。
- Interpretation：這是候選配對數，不是確認重複，也不是可合併列。
- Privacy：語句沒有選出學號，但連接鍵是學號。執行紀錄與慢查詢日誌也不要留下樣本列。
- Performance：這是目前風險最高的查詢。每個培力列可能配到多筆英檢。必須先 `EXPLAIN`，並排在 V01 之後。
- Impacted metrics：D11 相關的成績來源，不是活動預約列。
- Next decision：候選數只決定要不要抽樣複核。不建立自動合併。

## 審查後的順序

1. `SHOW INDEX`
2. V01 不含 JSON
3. V03、V04、V05
4. V06
5. V01 的 JSON 衝突計數
6. V02、V07 只在前面的量級可接受時進行

最高風險是 V07 的學號連接，其次是 V02 的技能連接與 V01 的 JSON 掃描。
