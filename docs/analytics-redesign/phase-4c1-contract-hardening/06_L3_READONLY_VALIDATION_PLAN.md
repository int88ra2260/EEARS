# L3 唯讀驗證草案

以下 SQL 只是草案。本階段沒有連線、沒有執行。正式執行前應在複本或低峰進行，先 `EXPLAIN`，並只取聚合數字。語句不含 `SELECT *`、不含寫入、不含暫存表。

輸出欄不要加學號、姓名、Email。下面的查詢都只回數量，或只回學期表本身的日期。

## 1. 投影鍵覆蓋

`exam_attempts` 沒有 `source_ref` 索引。`COUNT` 會掃描該表。`raw_payload` 的 JSON 判斷更貴，資料量大時分開跑。

```sql
SELECT
  COUNT(*) AS attempt_rows,
  SUM(source_type = 'BESTEP') AS bestep_typed,
  SUM(source_ref LIKE 'bestep_exam_scores:%') AS source_ref_linked,
  SUM(
    source_ref LIKE 'bestep_exam_scores:%'
    AND JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.bestepExamScoreId')) IS NOT NULL
  ) AS both_links_present
FROM exam_attempts;
```

兩邊鍵都在但數字不同的筆數：

```sql
SELECT COUNT(*) AS link_conflicts
FROM exam_attempts
WHERE source_ref LIKE 'bestep_exam_scores:%'
  AND JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.bestepExamScoreId')) IS NOT NULL
  AND source_ref <> CONCAT(
    'bestep_exam_scores:',
    JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.bestepExamScoreId'))
  );
```

## 2. testDate 與 examDate

`et_exam_attempts` 的計數。有 `studentId + testType + testDate` 索引，但這個條件用不上該索引，預期是表掃描。

```sql
SELECT
  COUNT(*) AS rows_total,
  SUM(testDate IS NULL) AS test_date_null,
  SUM(examDate IS NULL) AS exam_date_null,
  SUM(testDate IS NOT NULL AND examDate IS NOT NULL AND testDate = examDate) AS both_equal,
  SUM(testDate IS NOT NULL AND examDate IS NOT NULL AND testDate <> examDate) AS both_differ
FROM et_exam_attempts;
```

## 3. 1970-01-01 的來源

只統計，不列出列內容。

```sql
SELECT
  COUNT(*) AS rows_on_sentinel,
  SUM(source_type = 'BESTEP') AS bestep_typed,
  SUM(source_ref LIKE 'bestep_exam_scores:%') AS with_source_ref
FROM exam_attempts
WHERE exam_date = '1970-01-01';
```

```sql
SELECT
  SUM(testDate = '1970-01-01') AS test_date_sentinel,
  SUM(examDate = '1970-01-01') AS exam_date_sentinel
FROM et_exam_attempts;
```

`exam_date` 有 `student_id + exam_date` 索引。單欄等值仍可能掃到索引的日期端，實際走勢以 `EXPLAIN` 為準。英檢兩欄查詢預期掃表。

## 4. 培力與英檢同日疑似重複

這是候選筆數，不是確認重複。以培力 `examDate` 對上英檢任一日期欄，且只算列數。

```sql
SELECT COUNT(*) AS candidate_attempt_pairs
FROM bestep_exam_scores AS b
INNER JOIN et_exam_attempts AS e
  ON e.studentId = b.studentId
 AND b.examDate IS NOT NULL
 AND (e.testDate = b.examDate OR e.examDate = b.examDate);
```

學號等值連接可用培力的 `uk_student_semester` 左端，英檢端仍可能每個學號回多列。先在複本看 `EXPLAIN`，不要在尖峰對正式庫跑。

技能是否也相同要再接兩張子表，成本更高。第一輪只跑上面的嘗試列筆數。

## 5. et_semesters 與程式設定

學期表很小。只取學期代碼與三個日期，拿去和 `shared/semesterConfig.js` 的含尾日區間對照。不要在這張查詢加學生欄。

```sql
SELECT id, code, startDate, endDate, snapshotDate
FROM et_semesters
ORDER BY id;
```

## 6. 字串日期與 DATE 條件的筆數差

`events.date` 在 `analyticsService` 被當成字串。下面用 `114-2` 的設定區間當例子。這是全表條件，執行前要看表大小。

```sql
SELECT
  SUM(e.date BETWEEN '2026-02-01' AND '2026-07-31') AS string_between_inclusive,
  SUM(
    CAST(TRIM(e.date) AS DATE) BETWEEN CAST('2026-02-01' AS DATE)
    AND CAST('2026-07-31' AS DATE)
  ) AS cast_date_between_inclusive
FROM events AS e;
```

兩個數字不同，只表示這兩種寫法在該表上的筆數不同。它不自動證明半開區間的正確筆數。尾日當天的列數可另計 `e.date = '2026-07-31'`，仍只輸出數量。
