# Operations Report Export Spec

`/api/reports/overview` exports an operations workbook. It is not a learning-outcome workbook.

## Overview Workbook

Sheets:

1. `報表摘要`
   - report name
   - semester
   - generatedAt
   - note that official learning outcomes belong to `學習成效分析`

2. `活動預約營運`
   - total reservations
   - capacity utilization rate
   - check-in attendance rate
   - reservation violation rate

3. `班級行政追蹤`
   - distinct class-membership students
   - participation rate
   - average check-in count
   - survey completion rate
   - violation rate
   - class-membership high-risk student count

## High-Risk Workbook

`/api/reports/high-risk` exports only `riskLevel=high` rows from the class-membership administrative population.

## Out Of Scope

The operations export must not include:

- B2 KPI
- Learning Journey canonical attainment
- skill growth
- official student ability status
- legacy `hasCEFRB2` ratios
- teacher-impact or teaching-effect proxy scores

