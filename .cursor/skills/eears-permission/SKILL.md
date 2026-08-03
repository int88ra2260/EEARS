---
name: eears-permission
description: EEARS RBAC / 權限 / scope 變更護欄（後後端同步 + 測試）
license: MIT
---

# eears-permission（權限與存取控制）

## When to Use This Skill

- 新增/修改後台功能的權限鍵（`P.CAN_*`）
- 調整角色/層級映射或 scope guard 行為
- 修改 front-end 的 `adminRouteAccess.js` / navigation 可見性
- 看到「權限不一致」「403/404 異常」「stale profile」等問題

## Background You Need（EEARS 的既有架構）

- 後端權限鍵：`reservation-backend/auth/permissions.js`（`P.*`）
- 後端 middleware：`reservation-backend/middlewares/auth.js`
- 前端權限常數：`reservation-frontend/src/constants/permissions.js`
- 前端後台 route access：`reservation-frontend/src/constants/adminRouteAccess.js`
- 前端後台側欄：`reservation-frontend/src/constants/adminNavigation.js`

此外可能涉及：
- access scope guard（路徑/事件/類別範圍）：`reservation-backend/services/accessControl/**`
- token/stale 機制：`reservation-backend/docs/PHASE_3_2_VERSION_GATE.md`

## Hard Constraints（不可違背）

1. 後端必須驗證
   - 前端「隱藏 UI」不可視為權限策略本身
   - 所有敏感 endpoint 必須有 `authMiddleware` + `requirePermission(P.XXX)` 或 scope guard

2. 權限鍵語意不可混用
   - `teacherLevel / staffLevel / role / permission` 不得混用（請對照既有 mapping）

3. 對應前後端同步不可漏
   - 新增權限鍵至少要同步：
     - 後端：`permissions.js` +（可能）`accessProfile.js`、assignment policy、seed（如有）
     - 前端：`permissions.js` + `adminRouteAccess.js` + `adminNavigation.js`
     - 測試：補 `tests/security/*Auth*.test.js` 或對應 `*ScopeGuard*.test.js`

## Suggested Steps（做權限變更時的工作順序）

1. 分析影響面
   - 需要保護的 endpoint / route path 是什麼？
   - 需要哪些角色/哪些 scope 條件？
2. 後端先行
   - 在 router 加上 `authMiddleware` 與 `requirePermission(P.XXX)`
   - 若涉及範圍，使用對應 scope guard（例如 eventScopeGuard 類）
3. 前端同步
   - 更新 `adminRouteAccess.js` 與 `adminNavigation.js`
   - 切記不要改路徑 path（除非需求明確）
4. 測試補齊
   - 覆蓋 401（未登入）與 403（權限不足）
   - 若 scope guard：覆蓋「有權但 scope 不匹配」的行為

## Avoid（常見錯誤）

- 只改前端不改後端，導致越權 endpoint 仍可呼叫
- 只新增 `P.*` 常數，忘了更新 `accessProfile.js` mapping
- 把 teacher/staff level 當成 role 直接放進 permission 判斷
- 在 session/accessVersion stale 機制存在時，改了 payload 卻沒處理前端 `ACCESS_PROFILE_STALE`

## Suggested Workflow Prompt

> 你要我加的這個權限鍵/角色映射，請先指出應該落在哪些檔案（後端+前端），並列出至少兩個安全測試案例（401/403，以及若有 scope guard 再加 scope mismatch）。確認後再開始提出改動建議。

