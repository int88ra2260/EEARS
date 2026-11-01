# 時間語意

九個既有 Temporal Contract 不改。本階段不新增 id。

| 時間來源 | 欄位 | 誰寫入 | 可套用的契約 | Gap |
|---|---|---|---|---|
| 場次表 | `bestep_exam_sessions.lrExamDate` / `swExamDate` | demo script，匯入不寫 | 沒有 | `TC-EXAM-SESSION` 的來源是 `lj_analytic_exams.examDate`，不是這張表 |
| 出席匯入日 | `bestep_attendance.examDate` | 匯入參數，DATEONLY | 沒有獨立 id | 與成績檔的 null 考試日不是同一件事 |
| 成績檔考試日 | `bestep_exam_scores.examDate` | 匯入固定 null | `TC-BESTEP-FILE-SEMESTER` | 契約已說匯入時間不是施測日 |
| 同步後考試日 | `exam_attempts.examDate` | `resolveBestepExamDate` 推出席、匯入日或 1970-01-01 | 確認投影上的 1970 才是哨兵 | 推斷日不是來源陳述 |
| 檔案學期 | 報名、出席、成績的 `semester` 字串 | 操作者或報名表 | `TC-BESTEP-FILE-SEMESTER` | 字串不是半開區間 |
| 行政學期 | `SEMESTER_RANGES` | 活動營運用 | `TC-OPS-DATE-SEMESTER` | 不可拿來補培力考試日 |
| 學習歷程學期 | LJ semester id | LJ 路由 | `TC-SNAPSHOT-VERSION` 管快照版本 | 與檔案學期字串不同鍵 |
| et 日期 | `testDate` 與 `examDate` | et 匯入 | `TC-ROSTER-BEST-ASOF-NOW` 用 `testDate` 再退 `examDate` | `buildCanonicalAttemptWhere` 用 `COALESCE(examDate, testDate)`，順序相反 |

## 日期品質

- 成績匯入刻意不填考試日。adapter 標 `MISSING_ASSESSMENT_DATE`，測試 A09。
- 學期字串不會被改寫成該學期第一天。`temporalContextBuilder` 測試已覆蓋。
- 同步程式會在分析寫入前推日期。那是另一段程式，不能當成成績檔已有日期。
- 1970-01-01 只在確認投影上當哨兵。沒有投影連結時它仍是陳述日期。測試 H12、H13。
- 時區：後端 process 設 `Asia/Taipei`。出席 `examDate` 是 DATEONLY。同步用 `toISOString().slice(0, 10)` 取 `importedAt` 的日期，這一步的曆日語意要在 Phase 4J 用合成時間驗證，不能假設它一定是台北曆日。
- 缺日期不得改成查詢當下或匯入當下。`TC-BESTEP-FILE-SEMESTER` 已寫這條限制。
