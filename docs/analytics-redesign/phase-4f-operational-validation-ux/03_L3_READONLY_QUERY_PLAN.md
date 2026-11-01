# L3 唯讀查詢草案

本文件只給 DBA 審查。這次沒有連線、沒有執行、沒有讀 `.mysql-data/`，也沒有還原 SQL dump。

範圍固定在 114-2 的設定檔日期：`2026-02-01` 到 `2026-07-31`。所有業務查詢都只回傳筆數或日期。不要把內層改成輸出學號、姓名、email 或活動名稱。

執行前要有中心主任同意分析目的，並由 DBA 在維護時段跑。結果只留彙總數字。若 `EXPLAIN` 顯示會掃完整張大表，就停下來改期，不要先跑完。

`CAST(TRIM(events.date) AS DATE)` 通常用不到 `date` 字串欄上的普通索引。下面不建議在這階段新建索引。

## 審查順序

1. 先看欄位型別、索引與外鍵（V-OPS-01）。
2. 對 V-OPS-02 的語句做 `EXPLAIN`，確認掃描範圍後再決定是否取數。
3. 其餘查詢沿用同一日期條件，一次只跑一條。

## V-OPS-01 欄位、索引與外鍵

- Hypothesis: `events.date` 是字串；預約到活動的外鍵刪除規則可能與模型宣告的 CASCADE 不同。
- Business Impact: 決定日期比較會不會漏列，以及強制刪除活動後預約還在不在。
- Tables: `information_schema` 只讀目錄。
- Load Risk: 低。不掃業務大表。
- Privacy Risk: 低。沒有個資欄位。
- Authorization: DBA 可單獨審查目錄。不必先看學生資料。
- Decision: 若 `date` 不是字串，回報實際型別，總覽文件要改寫，但仍不要改 SQL。若 `reservations.eventId` 沒有外鍵或 `DELETE_RULE` 不是 `CASCADE`，強制刪除的實際效果標成與模型不一致。

```sql
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'events' AND COLUMN_NAME IN ('date', 'maxCapacity', 'hidden_from_students', 'semesterId', 'eventType'))
    OR (TABLE_NAME = 'reservations' AND COLUMN_NAME IN ('checkinStatus', 'eventId', 'studentId', 'userId', 'cancellationCode'))
    OR (TABLE_NAME = 'event_violations' AND COLUMN_NAME IN ('eventId', 'userId', 'recordedAt', 'violationType'))
    OR (TABLE_NAME = 'english_test_registrations' AND COLUMN_NAME IN ('semester', 'hasCEFRB2', 'studentId'))
    OR (TABLE_NAME = 'semesters' AND COLUMN_NAME IN ('code', 'startDate', 'endDate'))
    OR (TABLE_NAME = 'et_semesters' AND COLUMN_NAME IN ('id', 'code', 'startDate', 'endDate'))
  );

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('events', 'reservations', 'event_violations')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
 AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
 AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = DATABASE()
  AND kcu.TABLE_NAME = 'reservations'
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL;
```

`EXPLAIN` 只對下一條的日期條件做，不必取回活動列：

```sql
EXPLAIN
SELECT COUNT(*) AS event_rows
FROM events e
WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31');
```

## V-OPS-02 時間邊界差幾筆

- Hypothesis: 含尾日 `CAST BETWEEN`、半開區間，以及未 CAST 的字串比較，數到的活動列不同。設定檔、`semesters`、`et_semesters` 的 114-2 起迄也可能不同。
- Business Impact: 總預約、名額與簽到率的母體。
- Tables: `events`, `semesters`, `et_semesters`
- Expected Result: 三個活動筆數相等，且三個來源的起迄都是 2026-02-01 與 2026-07-31，才算這組邊界在這批資料上沒有落差。任一不同就保留 F-OPS-03，不要改正式 SQL。
- Load Risk: 中。外層用字串粗限在 2026 上半年附近，避免無條件全表；無法被 CAST 的奇怪格式可能落在粗限外，那本身就是要另記的資料品質問題。
- Privacy Risk: 低。只回日期與筆數。
- Authorization: 主任同意後，由 DBA 執行。
- Decision: 筆數不同時，先記錄哪一種比較多，不選邊當正式口徑。

```sql
SELECT
  SUM(CASE
    WHEN CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31') THEN 1
    ELSE 0
  END) AS cast_inclusive_rows,
  SUM(CASE
    WHEN CAST(TRIM(e.date) AS DATE) >= DATE('2026-02-01')
     AND CAST(TRIM(e.date) AS DATE) < DATE('2026-08-01') THEN 1
    ELSE 0
  END) AS cast_half_open_rows,
  SUM(CASE
    WHEN TRIM(e.date) >= '2026-02-01' AND TRIM(e.date) <= '2026-07-31' THEN 1
    ELSE 0
  END) AS raw_string_rows
FROM events e
WHERE TRIM(e.date) >= '2026-01-01'
  AND TRIM(e.date) < '2026-09-01';

SELECT 'semester_config' AS source_name, '2026-02-01' AS start_date, '2026-07-31' AS end_date
UNION ALL
SELECT 'semesters', DATE_FORMAT(startDate, '%Y-%m-%d'), DATE_FORMAT(endDate, '%Y-%m-%d')
FROM semesters
WHERE code = '114-2'
UNION ALL
SELECT 'et_semesters', CAST(startDate AS CHAR), CAST(endDate AS CHAR)
FROM et_semesters
WHERE id = '114-2' OR code = '114-2';
```

## V-OPS-03 隱藏場次佔多少名額

- Hypothesis: 隱藏場次的名額大於 0，因此目前供給大於學生看得到的供給。資料庫沒有停辦狀態欄。
- Business Impact: `totalEventCapacity` 與預約名額比。
- Tables: `events`, `information_schema.COLUMNS`
- Expected Result: 隱藏場次筆數與名額。若沒有 `hidden_from_students` 欄，先回到 V-OPS-01。
- Load Risk: 中。與 V-OPS-02 相同的日期條件。
- Privacy Risk: 低。
- Authorization: 與 V-OPS-02 一起核准即可。
- Decision: 隱藏名額為 0 時，F-OPS-05 對目前資料沒有數量影響，但程式仍會納入未來的隱藏場次。是否改口徑仍要主任決定，不由這條查詢自動改。

```sql
SELECT
  COUNT(*) AS events_in_window,
  COALESCE(SUM(e.maxCapacity), 0) AS capacity_in_window,
  SUM(CASE WHEN e.hidden_from_students = 1 THEN 1 ELSE 0 END) AS hidden_events,
  COALESCE(SUM(CASE WHEN e.hidden_from_students = 1 THEN e.maxCapacity ELSE 0 END), 0) AS hidden_capacity
FROM events e
WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31');
```

## V-OPS-04 預約列與不重複學生

- Hypothesis: 預約列多於不重複學號；同一活動也可能有重複列。
- Business Impact: 畫面不能把總預約說成學生人數。
- Tables: `reservations`, `events`
- Expected Result: 兩個計數，以及重複組數、多出來的列數。結果不得列出學號。
- Load Risk: 中。`COUNT(DISTINCT studentId)` 需要聚合，仍受日期條件限制。
- Privacy Risk: 中低。陳述式裡會用到學號做聚合，輸出只有數字。審查時禁止改成列出學號。
- Authorization: 主任與 DBA。執行人不得把暫存結果另存成明細。
- Decision: 列數大於人數只確認文案必須寫「筆數」。不因此新增正式的學生數 API。

```sql
SELECT
  COUNT(*) AS reservation_rows,
  COUNT(DISTINCT r.studentId) AS distinct_students
FROM reservations r
INNER JOIN events e ON e.id = r.eventId
WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31');

SELECT
  COUNT(*) AS duplicate_groups,
  COALESCE(SUM(extra_rows), 0) AS extra_rows
FROM (
  SELECT COUNT(*) - 1 AS extra_rows
  FROM reservations r
  INNER JOIN events e ON e.id = r.eventId
  WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31')
  GROUP BY r.eventId, r.studentId
  HAVING COUNT(*) > 1
) grouped;
```

## V-OPS-05 預約違規狀態與違規表

- Hypothesis: 標成已登記違規的預約列數，不等於同一日期窗裡的 `event_violations` 列數。
- Business Impact: 違規率能否被說成全部違規事件的比率。
- Tables: `reservations`, `events`, `event_violations`
- Expected Result: 狀態筆數、違規表筆數、有狀態但沒有違規列的筆數、有違規列但狀態不是已登記違規的筆數。
- Load Risk: 中。違規表先依活動與使用者聚合，不輸出姓名。
- Privacy Risk: 中低。對照使用 `userId`，輸出只有筆數。
- Authorization: 主任與 DBA。這條最接近個資，仍禁止改成明細。
- Decision: 先看 V-OPS-01。`reservations` 模型檔沒有宣告 `userId`，但登記與清除違規的程式會用這個欄位。目錄裡沒有該欄時，不要跑下面的對照，只記錄這個落差。欄位存在且四個數字不全相等時，維持「總覽只代表預約列狀態」。不改 SQL，也不把提案指標升成正式指標。

```sql
SELECT
  SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) AS marked_reservation_rows,
  SUM(CASE WHEN r.checkinStatus = '已登記違規' AND IFNULL(v.violation_rows, 0) = 0 THEN 1 ELSE 0 END) AS status_without_violation_row,
  SUM(CASE WHEN r.checkinStatus <> '已登記違規' AND IFNULL(v.violation_rows, 0) > 0 THEN 1 ELSE 0 END) AS violation_row_without_status
FROM reservations r
INNER JOIN events e ON e.id = r.eventId
LEFT JOIN (
  SELECT eventId, userId, COUNT(*) AS violation_rows
  FROM event_violations
  GROUP BY eventId, userId
) v ON v.eventId = r.eventId AND v.userId = r.userId
WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31');

SELECT COUNT(*) AS violation_rows_on_in_range_events
FROM event_violations v
INNER JOIN events e ON e.id = v.eventId
WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31');
```

## V-OPS-06 頂層與分項是否同一批數

- Hypothesis: 內連接的預約列數等於分項按場次加總的預約列數；名額總和等於各場名額相加。
- Business Impact: 畫面上的總計與類型表會不會對不上。
- Tables: `events`, `reservations`
- Expected Result: 三個數字。前兩個預約數相同、名額與各場名額和相同，才表示這批資料與程式推論一致。
- Load Risk: 中。同一日期條件掃描三次，可分成三次執行。
- Privacy Risk: 低。
- Authorization: 與 V-OPS-02 一起。
- Decision: 不相同時記錄差多少，不要為了對齊而改任一段 SQL。

```sql
SELECT
  (
    SELECT COUNT(*)
    FROM reservations r
    INNER JOIN events e ON e.id = r.eventId
    WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31')
  ) AS inner_join_reservation_rows,
  (
    SELECT COALESCE(SUM(e.maxCapacity), 0)
    FROM events e
    WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31')
  ) AS event_capacity_sum,
  (
    SELECT COALESCE(SUM(per_event.reservation_rows), 0)
    FROM (
      SELECT COUNT(r.id) AS reservation_rows
      FROM events e
      LEFT JOIN reservations r ON r.eventId = e.id
      WHERE CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31')
      GROUP BY e.id
    ) per_event
  ) AS left_join_reservation_rows;
```

## V-OPS-07 報名 B2 標記與活動預約分開

- Hypothesis: 報名列的肯定標記比例可以獨立算出。它與區間內有預約的人數不是同一個母體。
- Business Impact: 避免把這個比率放進活動成效。
- Tables: `english_test_registrations`；重疊計數才碰到 `reservations` 與 `events`
- Expected Result: 報名列數與肯定標記列數。可選的第三個數字只表示「報名列之中，學號也出現在區間內預約」的列數，不是成效。
- Load Risk: 報名計數低到中。重疊計數用 `EXISTS`，仍受日期限制。
- Privacy Risk: 重疊計數中低。沒有第三個數字也可以完成主要判斷。
- Authorization: 只跑第一段時，DBA 即可。要跑重疊計數時，需主任同意。
- Decision: 不論重疊多少，`englishPassRate` 都維持跨領域補充，不升成活動 KPI。

```sql
SELECT
  COUNT(*) AS registration_rows,
  SUM(CASE WHEN hasCEFRB2 IN ('是', 'true', 'yes', '1') THEN 1 ELSE 0 END) AS flagged_rows
FROM english_test_registrations
WHERE semester = '114-2';
```

只有在 V-OPS-01 確認報名表有 `studentId` 時才審查下一段：

```sql
SELECT COUNT(*) AS registrations_with_any_in_range_reservation
FROM english_test_registrations et
WHERE et.semester = '114-2'
  AND EXISTS (
    SELECT 1
    FROM reservations r
    INNER JOIN events e ON e.id = r.eventId
    WHERE r.studentId = et.studentId
      AND CAST(TRIM(e.date) AS DATE) BETWEEN DATE('2026-02-01') AND DATE('2026-07-31')
  );
```

## 本階段執行結果

查詢數：7 組草案，含目錄、`EXPLAIN` 與一條可選重疊計數。優先順序就是 V-OPS-01 到 V-OPS-07。沒有任何一條被執行。
