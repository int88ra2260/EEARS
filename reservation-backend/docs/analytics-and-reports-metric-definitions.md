# Analytics and Reports Metric Boundaries

This document defines the product boundary between EEARS learning analytics and operations reports.

## Learning Analytics

Use `學習成效分析` and `/api/admin/learning-analytics` for official learning-outcome analysis:

- B2 KPI and gap reports
- Learning Journey canonical attainment
- student skill growth and personal trajectories
- cohort, department, resource, course, teacher, and activity outcome analysis
- raw learning analytics exports

These metrics may use Learning Journey snapshots, effective exam records, CEFR/GSE mappings, and learning analytics policies.

## Operations Analytics and Reports

Use `營運分析與報表` and legacy `/api/analytics` or `/api/reports` only for operational decisions:

- activity reservations
- capacity utilization
- check-in attendance
- reservation violations
- class-membership based administrative follow-up
- high-risk administrative tracking lists

Operations pages must not present official B2 attainment, student ability, or causal teacher impact.

## Removed From Operations UI

The following concepts are intentionally not shown in `營運分析與報表`:

- `learningJourneyCoreKpi`
- Learning Journey canonical attainment rate
- legacy `english_test_registrations.hasCEFRB2` pass ratio
- `teacherImpact` proxy trend pages
- class or teacher proxy report downloads

Old URLs may redirect for compatibility, but they should not reintroduce these concepts in navigation.

