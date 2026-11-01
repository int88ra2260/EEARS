# Git 基準報告

Branch：`analytics/phase-4b-temporal-context`

提交前 HEAD 是 `1f41dd5202c5672076ab3181e563effb172823fe`。`git diff` 與 `git diff --cached` 當時是空的，Phase 1–4C.1 是未追蹤檔案。

## Commit 1

`b65e1df01fa5584c69d8866331d13d9e1870d3fa`

`docs(analytics): establish analytics redesign research baseline`

35 個檔案。範圍是 `docs/analytics-redesign/` 的 Phase 1 十份文件、`phase-2-semantic-contracts/`、`phase-3-target-architecture/`。暫存清單沒有契約程式，也沒有 Phase 4 目錄。

## Commit 2

`6a4215a35ec082b6a13fbca20cd63eb261530d3b`

`feat(analytics): establish metric temporal and provenance contracts`

64 個檔案。範圍是 `reservation-backend/analytics-contracts/`、`reservation-backend/tests/analytics-contracts/`，以及 phase-4a、phase-4b、phase-4c、phase-4c1 文件。`index.js` 與 4C 模組放在同一提交，所以這一筆可以載入。

兩個提交前都先看過 `git diff --cached --name-only`。清單裡沒有 `.mysql-data/`、`.pem`、SQL dump、`presentation-build/`。

預定提交的 Markdown、CSV 與契約程式沒有連線字串、私鑰或 Email。CSV 是指標字典與遷移矩陣，不是學生名冊。

提交前 ESLint 通過，Jest 為 12 suites、97 tests。提交沒有改那些檔案的內容。加入 Phase 4D 之後的完整結果是 13 suites、112 tests。

## 仍未追蹤

- `.mysql-data/`
- `eears_2026-09-18_18-29.sql.gz`
- `presentation-build/`
- 本階段新增的試點程式、測試與 `phase-4d-first-vertical-slice/`

沒有 push、merge 或 rebase。Phase 4D 沒有提交。

若之後要提交試點，建議訊息是 `feat(analytics): describe reservation overview with shadow contracts`。那一步要另外授權。
