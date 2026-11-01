# 10 資料驗證計畫

本檔只放草案。不要在正式庫執行，除非另有明確指示。草案使用聚合與計數，不選姓名、email、分數明細。學號只在「衝突筆數」必要時以計數出現，不列出名單。

負載：每題都加學期參數，避免全表掃描當日常報告。若 `et_exam_attempts` 很大，先在複本或低峰執行，並用 `EXPLAIN` 看過再跑。不要包在會寫入的交易裡。帳號用唯讀。

## V-01 名冊學期與嘗試日

假設：內建 lifetime 政策下，不少通過證明的 `testDate` 不在該名冊學期的日期區間內。

表：`et_enrollment_snapshots`、`et_exam_attempts`。不需技能分即可看日期；若要「會不會因此通過」才要技能分，那一題另開，先不要拉分數。

```sql
-- 草案。把 :semester 換成一個名冊學期。start/end 用程式 SEMESTER_RANGES，不要在 SQL 裡猜。
SELECT
  CASE
    WHEN a.testDate IS NULL THEN 'no_date'
    WHEN a.testDate < :start THEN 'before_semester'
    WHEN a.testDate > :end THEN 'after_semester'
    ELSE 'inside_semester'
  END AS bucket,
  COUNT(*) AS attempt_rows,
  COUNT(DISTINCT a.studentId) AS students
FROM et_enrollment_snapshots s
JOIN et_exam_attempts a
  ON UPPER(TRIM(a.studentId)) = UPPER(TRIM(s.studentId))
WHERE s.semesterId = :semester
  AND s.isActive = 1
  AND a.status = 'valid'
GROUP BY bucket;
```

解讀：`before_semester` 或 `after_semester` 的學生數大於 0，表示 D2 的選項 B 會改分子候選。這不直接等於達標人數變化，因為還要過成對規則。若幾乎全是 `inside_semester`，lifetime 與學期窗在這個學期差異小。

對架構：差異大則標題不能寫本學期考試。差異小仍不代表政策可以含糊，只代表這個學期的數字碰巧接近。

風險：JOIN 用函式包欄位可能無法走索引。可改成先正規化的暫存，但暫存不要寫進正式庫；用工作階段暫存表或不做。人數級查詢通常可接受。

## V-02 歷史最佳是否晚於名冊學期

假設：部分名冊學生的最高 rank 來自學期結束之後的嘗試。

```sql
SELECT
  SUM(CASE WHEN best_date > :end THEN 1 ELSE 0 END) AS students_best_after,
  SUM(CASE WHEN best_date IS NULL THEN 1 ELSE 0 END) AS students_no_date,
  COUNT(*) AS students_with_any_score
FROM (
  SELECT a.studentId, MAX(a.testDate) AS best_date
  FROM et_enrollment_snapshots s
  JOIN et_exam_attempts a
    ON UPPER(TRIM(a.studentId)) = UPPER(TRIM(s.studentId))
  JOIN et_exam_attempt_skill_scores sc ON sc.attemptId = a.id
  WHERE s.semesterId = :semester
    AND s.isActive = 1
    AND a.status = 'valid'
    AND sc.cefrRank IS NOT NULL
  GROUP BY a.studentId
) t;
```

限制：這裡用 MAX(testDate) 當代理，不是「最高 rank 那一天」。最高 rank 與最晚日期可能不同。這題只能證明「有人在學期之後還有分數」。精確的「最佳等級來自學期之後」需要在應用層比對 rank，或再寫一層子查詢。不要用這題單獨宣佈歷史最佳已被改寫的人數。

對架構：只要 `students_best_after > 0`，就不能把歷年 R-BEST 當凍結趨勢。

## V-03 快照是否落後培力匯入

假設：`bestep_exam_scores.importedAt` 的最大值晚於最新分析列的 `derivedAt`。

```sql
SELECT
  (SELECT MAX(importedAt) FROM bestep_exam_scores) AS latest_bestep_import,
  (SELECT MAX(derivedAt) FROM lj_analytic_students) AS latest_snapshot_derived;
```

解讀：匯入較晚只表示快照可能舊，不表示每一筆都沒投影。若要看「這次匯入的人是否出現在快照」，用 sourceRef 對 `exam_attempts`，再對事件的 sourceRecordId。那是第二步，仍不要輸出學號清單到報表，只輸出缺少的筆數。

```sql
SELECT COUNT(*) AS bestep_rows_without_canonical_attempt
FROM bestep_exam_scores b
LEFT JOIN exam_attempts a
  ON a.sourceRef = CONCAT('bestep_exam_scores:', b.id)
WHERE a.id IS NULL;
```

對架構：筆數大表示非同步 promote 有失敗或尚未跑。筆數為 0 只表示 canonical 表有列，不表示 KPI 看得到（KPI 讀 et）。

## V-04 等級欄是否還有加號

假設：現存等級欄已沒有 `+`。

```sql
SELECT 'bestep' AS src, listeningLevel AS lvl, COUNT(*) AS n
FROM bestep_exam_scores
WHERE listeningLevel LIKE '%+%'
   OR readingLevel LIKE '%+%'
   OR speakingLevel LIKE '%+%'
   OR writingLevel LIKE '%+%'
GROUP BY listeningLevel
LIMIT 20;
```

技能欄要分開查，不要用一個 WHERE 混計。et 技能表的 `cefr` 同樣 `LIKE '%+%'` 計數即可。

解讀：計數 0 支持「現庫不能還原加號」。計數大於 0 則 Phase 2「所有列都已摺疊」要改成「匯入函式會摺疊，但庫內仍有未走過該函式的列」。不要把 `B2` 的筆數當成 B2+。

個資：只回等級與筆數。

## V-05 因果旗標

```sql
SELECT
  SUM(CASE WHEN causal_claim_allowed = 1 THEN 1 ELSE 0 END) AS allowed_true,
  COUNT(*) AS n
FROM resource_effect_estimates;
```

若表不存在或欄位名不同，先 `SHOW COLUMNS`，不要 ALTER。`allowed_true > 0` 表示有列被標成可做因果宣稱，與 API 組裝時寫死的 false 可能不是同一條讀取路徑。等於 0 只表示這張表沒有打開旗標。

## V-06 培力表與 et 表的重疊

假設：不少 `bestep_exam_scores` 學生在同學期沒有 `et_exam_attempts`。

學期對齊方式未在 et 表上驗證是否有 `semesterId`。若 et 只有 `testDate`，用 V-01 的 start/end，不要假設欄位。

```sql
SELECT
  SUM(CASE WHEN t.studentId IS NULL THEN 1 ELSE 0 END) AS bestep_students_without_et_in_window,
  COUNT(*) AS bestep_students
FROM (
  SELECT DISTINCT UPPER(TRIM(studentId)) AS studentId
  FROM bestep_exam_scores
  WHERE semester = :semester
) b
LEFT JOIN (
  SELECT DISTINCT UPPER(TRIM(studentId)) AS studentId
  FROM et_exam_attempts
  WHERE status = 'valid'
    AND testDate BETWEEN :start AND :end
) t ON t.studentId = b.studentId;
```

解讀：左邊大表示班級達標與 KPI 在這個學期幾乎不是同一批成績。這支持 D11 選項 B（刻意分軌），也支持「不要對帳」。它不證明誰對誰錯。

## V-07 出席代碼

```sql
SELECT examType, COUNT(*) AS n
FROM bestep_attendance
WHERE semester = :semester
GROUP BY examType;
```

解讀：若只有 L／R／S／W 而沒有 LR／SW，行政 KPI 的出席率會接近 0，班級頁仍可能有分項。這解釋兩個「出席率」為何不能互核。

## V-08 活動日期形態

```sql
SELECT
  SUM(CASE WHEN date IS NULL OR TRIM(date) = '' THEN 1 ELSE 0 END) AS blank_date,
  SUM(CASE WHEN CHAR_LENGTH(TRIM(date)) > 10 THEN 1 ELSE 0 END) AS longer_than_date,
  COUNT(*) AS n
FROM events;
```

解讀：`longer_than_date` 高則字串 BETWEEN 與 CAST 的差異值得認真看。低則 Q14 的實務影響小，契約差異仍在。

## 個資

所有草案都是計數。不要加 `SELECT studentId, name`。若除錯必須看例，限制 5 筆、遮罩學號後四碼、不要寫進本目錄、不要貼進聊天紀錄的長清單。

## 結果如何回頭改契約

| 結果 | 契約動作 |
|---|---|
| V-01 幾乎都在學期內 | D2 的數字風險降低。契約仍寫 lifetime，直到政策改掉 |
| V-01 很多在學期外 | 禁止任何文件把 KPI 叫做該學期考試成果 |
| V-04 沒有加號 | 維持「不可恢復」 |
| V-04 仍有加號 | 回頭把正規化標成「匯入路徑會摺疊，庫內不完全」 |
| V-06 幾乎不重疊 | 兩套達標都保留，禁止自動對帳 |
| V-06 高度重疊且分數常衝突 | D11 變成必須先決定優先序，否則快照的 et 優先是一種默認政策 |
| V-03 快照較舊 | 頁面需要來源延遲標籤，不是再加一個達標率 |
| V-07 只有分項碼 | 行政出席率標成可能失真，直到程式認 L／R／S／W |

未做的驗證保持 `DATA_VALIDATION_REQUIRED`，不要在架構文件裡寫成已觀察到的比例。
