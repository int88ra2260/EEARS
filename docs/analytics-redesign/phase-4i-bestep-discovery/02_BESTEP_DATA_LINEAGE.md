# 資料流程

假設中的單線 `Exam → ExamSession → ExamRegistration → Attendance → Score` 和程式不符。實際是三條平行流程，只用學號與學期字串對齊。

```text
個人報名 POST /api/english-test/register
  → english_test_registrations
      唯一索引 studentId + semester
      管理端 DELETE 會 destroy 該列

出席匯入 POST /api/admin/bestep/attendance/import
  → 必須先有同學期 status=success 的報名
  → bestep_attendance
      唯一鍵 studentId + semester + examType
      examDate 來自這次匯入參數，不是 bestep_exam_sessions

成績匯入 POST /api/admin/bestep/scores/import
  → 同樣要求 success 報名
  → bestep_exam_scores
      唯一鍵 studentId + semester
      examDate 固定寫 null
  → setImmediate
      runSync(sections: bestep_scores) → exam_attempts
      scheduleGlobalAnalyticsRebuild
  → et_exam_attempts 不在這條自動路徑
      另執行 scripts/promote-bestep-to-learning-analytics.js

bestep_exam_sessions
  → 只在 demo script 被 findOrCreate
  → 匯入服務沒有引用
```

## 十二個核對點

1. **報名、到考、成績沒有共用 ExamSession 外鍵。** 出席與成績都呼叫 `findRegistrationForSemester`。`BestepExamSession` 的唯一鍵是學期，欄位只有 `lrExamDate` 與 `swExamDate`。證據：`BestepExamSession.js`；`bestepImportService.js` 沒有引用該 model。
2. **成績以學號識別。** `importScoreData` 把學號 trim 後轉大寫，再找同學期 success 報名。找不到就記 `STUDENT_NOT_FOUND` 並跳過。證據：`bestepImportService.js` `importScoreData` 445 行起、502 行；出席約 376 行。
3. **檔案學期與考試日分開。** 成績學期來自 request body。成績列的 `examDate` 被寫成 null，註解寫「LR 和 SW 可能不同日期」。出席的 `examDate` 來自匯入參數。證據：`importScoreData` 612–615 行；`importAttendanceData` 的參數。
4. **缺考與未匯入可以在班級讀取時分開。** `resolveComponentAttended` 沒有列時回傳 `null`；`attended===false` 才是缺席。匯出空白與「缺席」不同。證據：`bestepClassService.js` 340–361、364–374 行。舊模板若有「出席狀態」欄但值不在出席字清單，`parseAttendanceStatus` 會寫成 false。那是匯入當下的解釋，不是事後的未知。
5. **團體報名沒有在 learning partner service 裡為每位成員 `create` 報名列。** 個人報名建立報名表一列。資料庫唯一索引是 `studentId + semester`。抵免清單註解寫歷史資料仍可能一人多列，並用 `pickLatestRegistrationPerStudent`。證據：`EnglishTestRegistration.js` 320 行；`englishTestRegistrationRouter.js` 1546 行。
6. **管理端取消是刪列。** `DELETE /english-test/registrations/:id` 呼叫 `registration.destroy()`。狀態註解是 pending、approved、revision、success、failed，沒有把取消留成狀態。證據：router 3096–3156 行；model 248–252 行。
7. **成績重匯是 upsert。** 同一學號加學期覆蓋該列，並寫入新的 `importBatchId`。沒有保留前一版成績。證據：`BestepExamScore.upsert` 612 行；唯一索引 `uk_student_semester`。
8. **CEFR 會正規化。** `normalizeCefrLevel` 用正則去掉加號，只留 A1–C2 基底。`未達A1` 存成 A1。證據：87–93 行。
9. **B2+ 被壓成 B2，原始加號沒有另欄。** 存進 `listeningLevel` 等欄位的已是折疊後字串。adapter 若讀到的輸入仍是 `B2+` 會分開放 original 與 normalized；匯入後的資料庫列通常已經沒有加號。
10. **出席與成績有 importBatchId。** `newBestepImportBatchId` 產生 `bestep-scores-` 或 `bestep-attendance-` 前綴。audit log 記 `import_scores`。錯誤列寫成 xlsx，不是成績表的一列。同步到 `exam_attempts` 的 `sourceRef` 是 `bestep_exam_scores:{id}`。證據：migration `20260601120000-add-import-batch-id-to-bestep-tables.js`；`bestepImportController.js` 207–228 行。
11. **學習歷程對人用學號。** `syncBestepScoresToExamAttempts` 以學號找或準備 student，寫 `studentPk` 與 `studentId`。`registrationId` 設為 null。證據：`syncService.js` 380–393 行。
12. **同一測驗有平行紀錄。** 成績檔一列、同步後的 `exam_attempts` 一筆加四個 skill 子列、以及可另匯的 `et_exam_attempts`。三者主键不同。KPI 讀 et 表。班級頁讀成績檔。這不是已核准的同一來源。
