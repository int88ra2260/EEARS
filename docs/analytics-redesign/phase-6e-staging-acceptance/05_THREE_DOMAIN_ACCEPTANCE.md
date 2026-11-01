# Three Domain Acceptance（Staging）

**`STAGING_EXECUTION_NOT_AUTHORIZED`** — F3–F5 全部 **`NOT_EXECUTED`**

Application Candidate：`610495c5…`

## Operations — Hub → Overview → Activities

| 焦點 | Staging |
|---|---|
| 資料母體／學期／預約列／營運觀察／KPI／Drill-down／Error／Empty／權限 | NOT_EXECUTED |

本機旁證：`LOCAL_APPLICATION_INTEGRATION_PASSED`（合成 JWT）。

## BESTEP — Hub → Classes → Class BESTEP → Student

| 焦點 | Staging |
|---|---|
| classId、報名、出席、未匯入、成績 0、Legacy Pass Rate、明細、返回、Export | NOT_EXECUTED |

缺特殊資料時標 `NOT_OBSERVED`；**禁止**改正式資料湊案。

## Learning — Hub → Resources → Skills

| 焦點 | Staging |
|---|---|
| 人數≠事件、學期、Evidence Quality、Missing／Zero、非因果、權限、返回 Hub | NOT_EXECUTED |

## 標籤規則

不得將本機通過寫成 `STAGING_E2E_PASSED`。
