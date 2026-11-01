# 時間查詢上下文

業務時區是 `Asia/Taipei`。呼叫端若傳別的時區名稱，上下文會被拒絕。時間戳上的 `Z` 或數值偏移會先被換成同一個瞬間的 `+08:00`，這個換算不讀取作業系統時區。

## 上下文

`buildTemporalContext` 成功時回傳凍結物件：

| 欄位 | 內容 |
|---|---|
| temporalContractId | 九個既有 ID 之一 |
| metricId | 32 個既有 ID 之一，且該指標的 `temporalContractIds` 必須包含這個契約 |
| contextType | 由契約決定，不是新的契約 ID |
| comparisonMode | 只有活動日兩種契約有：`cast_date` 或 `string_between` |
| boundaries | 具名邊界 |
| precision.assessment | `date`、`timestamp`、`semester`、`unknown` 或 `not_applicable` |
| claims | `asOf`、`dataAsOf`、`assessmentDateInvented`、`officialUseAllowed` 目前都是 false |
| validationStatus | 成功才是 `valid` |

失敗丟 `ContractRegistryError`，`code` 見驗證文件。

## 契約與 contextType

| 契約 | contextType | 必要邊界 |
|---|---|---|
| TC-OPS-DATE-SEMESTER | event_period | eventSemesterRange |
| TC-OPS-DATE-STRING | event_period | eventSemesterRange |
| TC-BESTEP-FILE-SEMESTER | cohort_semester | fileSemester。assessmentDate、importTime 可另給 |
| TC-ROSTER-LIFETIME-DEFAULT | cohort_semester | rosterSemester。policyKey、dateRange、academicYear 可另給 |
| TC-ROSTER-BEST-ASOF-NOW | cohort_semester | rosterSemester。不接受 asOfDate |
| TC-EXAM-SESSION | exam_session | instrument、snapshotVersion。沒有日期就不產生考試日 |
| TC-EXPOSURE-BEFORE-EXAM | baseline_follow_up | snapshotVersion |
| TC-SNAPSHOT-VERSION | snapshot_generation | snapshotVersion。snapshotGeneratedAt 只能是產生時間 |
| TC-TRACE-ROLLING-30D | reporting_period | rollingDays 必須是 30，而且要有 windowEnd |

`semesterId`、`eventDate`、`assessmentDate`、`importedAt`、`generatedAt`、`cutoffAt`、`asOfDate`、`dataAsOf` 不能當通用別名。契約沒有列出的鍵會被拒絕。

## 既有欄位對應

`adaptLegacyTimeFields` 只接受明確列出的欄位，例如 `events.date`、`bestep_exam_scores.importedAt`、`bestep_attendance.examDate`、`lj_analytic_students.derivedAt`。`cutoffAt` 沒有對應。匯入時間的語意是 `import_time`，不會被放進 `assessment_date`。

這個對應只產生具名值，不建立查詢。
