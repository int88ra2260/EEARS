# Phase 5B 執行摘要

日期：2026-11-01。候選版本在獨立工作樹用 Node v20.20.2 跑完既定回歸。沒有改 KPI、沒有改 main、沒有合併 UX 分支、沒有 push、沒有部署。

## 候選版本

- 分支：`integration/analytics-phase5b-candidate`
- HEAD：`15974e04a6c02bcb145048c626dd2aa137a1a513`
- 工作樹：`D:/EEARS-phase5b`
- 這個提交就是 Phase 5A 稽核文件。它在 Analytics 分支上，比 `main`（`1f41dd5`）超前 17、落後 0。

## Node 20 結果

本機預設 Node 仍是 v24.15.0。CI（`.github/workflows/ci.yml`）指定 Node 20。這次用官方 zip 的 v20.20.2 與 npm 10.8.2，只放在使用者目錄，沒有改系統 PATH，也沒有改全域 Node。

在候選工作樹重新 `npm ci` 之後：

- 後端 26 suites、256 tests 通過，16.149 秒。
- 前端 3 files、25 tests 通過。
- Playwright 1.64.1：15 passed，43.2 秒。
- 相關 ESLint exit 0。
- 前端 production build：6878 modules，41.24 秒，exit 0。

數量與 Phase 5A 的 Node 24 基準相同，但是這次是 Node 20 的新執行，不是沿用舊報告。

## 主要阻擋

工程整合條件已滿足。main 仍可快轉，這次沒有執行。

三條 UX 分支的尖端都已經是 `main` 與本候選的祖先。它們沒有尚未併入的提交，也沒有與 Analytics 自 `main` 以來的 284 個路徑重疊。

尚未通過的是 L3、F-BESTEP-01、D1–D11、Staging 與 Production。這些不阻擋「把現有提交送進整合分支」的工程判斷，但阻擋官方達標報告。
