# Learning Journey Analytics 衍生層規格

版本：`lj-analytics-2026-v1`（對應 `cefrScoreMapping` `2026-v1`）

## 架構

- **寫入模型**：`lj_student_events`（append-only 事件長表，唯一真相源契約）
- **讀取模型**：`lj_analytic_students`（一生一列）、`lj_analytic_exams`（一考一列×技能）
- **重建公式**：`analytic_* = f(events @ cutoffAt, ruleVersion R, buildVersion X)`

## snapshot_version 格式

```
{semesterOrGlobal}-{cutoffYYYYMMDD}-v{n}|rules:{ruleVersion}|build:{packageVersion}
```

範例：`114-2-20260615-v1|rules:lj-analytics-2026-v1|build:1.0.0`

## 事件類型

| event_type | 說明 |
|------------|------|
| `baseline_score` | 入學基礎（學測英文等），`timing=entry` |
| `exam_event` | 英檢紀錄（每技能一列） |
| `course_event` | 修課紀錄 |
| `activity_event` | 英語活動紀錄 |

## 狀態

`valid` | `registered_no_score` | `void` | `excluded`

## reason_code

`overseas` | `duplicate` | `invalid_score` | `withdrawn` | `registered_no_score` | `manual_review` | `import_rollback` | `other`

分析層可 include/exclude，不在資料層全域隱藏。

## sem_index

```
sem_index = (eventYear - enrollmentYear) * 2 + (eventTerm - enrollmentTerm)
```

- 由 `enrollment_term`（預設 `{enrollment_year}-1`）與事件 `academic_term` 計算
- 不得為負，除非 `timing = entry`（baseline）

## 考前暴露

一律 `event_date < exam_date`（嚴格小於，同日不算）。

## 研究操作型定義

| 指標 | 定義 | 適用 |
|------|------|------|
| 達標 B2+ | 指定技能 CEFR rank ≥ 4 | 全體 |
| true gain | 同工具×同技能連續兩次 raw_score 差 | retest 子群 |
| value-added | 學測起點作分層，不與英檢直接相減 | 全體 |
| delta | 僅同 instrument × skill | retest 子群 |

## 品質斷言

見 `utils/eventQualityAssertions.js` 與 `GET .../quality/assertions`。
