---
name: eears-testing
description: EEARS 測試策略（後端 Jest + 權限/安全測試 + 缺口提醒）
license: MIT
---

# eears-testing（測試策略與補測護欄）

## When to Use This Skill

- 你要修 bug、加功能、或重構會影響：
  - 預約/取消（2hr 截止、候補、blacklist 檢查）
  - 問卷 Gate（ET/EC、409 + redirectUrl）
  - 權限（RBAC/scope）
  - 匯入（Excel 去重、import-runs 狀態/刪除）
- 你需要決定「該補哪些測試」來降低 regression risk

## Current Test Landscape（以 repo 為準）

- 後端：`reservation-backend/tests/**/*.test.js`
  - Jest config：`reservation-backend/jest.config.js`（testMatch 與 coverage 範圍）
  - Setup：`reservation-backend/tests/setup.js`
    - 測試環境會設 `GLOBAL_RATE_LIMIT_ENABLED=false`（避免影響整合）
- CI：
  - backend：`npm test -- --runInBand` + `npm run lint`
  - frontend：`npm test -- --watchAll=false` + `npm run lint` + `npm run build`
- 前端：目前主要是 CRA smoke（`reservation-frontend/src/App.test.js`），E2E（Playwright/Cypress）未建立

## Hard Constraints（重要）

1. 權限/安全變更必補測試
   - 覆蓋 401（未登入）與 403（權限不足/Scope 不匹配）
   - 測試檔通常在：
     - `reservation-backend/tests/security/`
     - 或符合 `*Auth*`、`*ScopeGuard*` 命名模式的測試

2. Excel 匯入與 LJ v3 變更要補去重/衝突/錯誤回報
   - 去重鍵與 quarantine（若存在）要覆蓋
   - 不要只測「有沒有成功」，要測「錯的情況」與狀態呈現

3. 不要為了測試引入真實 DB 依賴
   - Jest 對大部分 service/util 可 mock
   - 只有確定需要 integration 的測試再走 DB / supertest

## Suggested Workflow（選測試的順序）

1. 先找現有測試是否已涵蓋同類規則
2. 若缺口：
   - 對規則最核心的一層補測試（service/util > middleware > router）
   - 若前端依賴特定 error code/redirectUrl，請加檢查
3. 最後才做 refactor/樣式調整，避免測試成本膨脹

## Suggested Workflow Prompt

> 我做的這個改動會影響哪些規則契約（例如：409 + redirectUrl、2hr cutoff、401/403、import-runs 刪除）。請先列出「應該新增/更新哪些測試檔類型」，再給出建議測試案例（至少 2 個正向 + 2 個負向）。

