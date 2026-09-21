# EEARS 開發者權限指南（Phase 2.6 封版）

最後更新：2026-04-01

本文件給未來維護者使用，目標是讓新 API 在第一時間就走對授權模型。

---

## 1) 新 API 要怎麼加 permission

## 步驟

1. 先確認是否已有對應權限鍵（優先沿用，避免同義重複）  
2. 若沒有，再新增到：
   - 後端：`reservation-backend/auth/permissions.js`
   - 前端：`reservation-frontend/src/constants/permissions.js`
3. 同步 base mapping：
   - 後端：`reservation-backend/auth/accessProfile.js`
   - 前端：`reservation-frontend/src/utils/accessControl.js`
4. Route 必須實際使用 `requirePermission(...)` 或其組合 helper
5. 前端按鈕/入口根據 `finalPermissions` 顯示，不要只靠 UI 隱藏當作安全控制

---

## 2) 怎麼用 `requirePermission`

常見模式：

- 只看權限：
  - `authMiddleware, requirePermission(P.CAN_XXX)`
- 需要至少一個權限：
  - `authMiddleware, requireAnyPermission([P.A, P.B])`
- 權限 + scope（事件類型）：
  - `authMiddleware, loadEventForAccess, requirePermissionAndEventAccess(P.CAN_XXX, getEventType)`

---

## 3) 怎麼做 event access（重點）

活動後台 API（含預約、簽到、違規）原則上都要加 event access。

### 建議寫法

1. 先載入 event（或由 reservation 反查 event）
2. 取得 `eventType`
3. 用 `canAccessEventType(req.user, eventType)` 判斷

### 可重用 helper（建議）

- `loadEventForAccess(req,res,next)`
- `accessEventType(req)` 或 `eventTypeByParam(req)`
- `requirePermissionAndEventAccess(permission, getter)`

---

## 4) 哪些權限不能亂用

以下是常見誤用，請避免：

1. `can_view_reservations`  
   - 只能看，不代表可刪、可改、可批次處置

2. `can_export_reservations` / `can_export_reports`  
   - 只能匯出，不代表可做現場簽到或違規處置

3. `can_checkin_students`  
   - 可簽到，不代表可刪預約或執行黑名單同步

4. `can_manage_blacklist`  
   - 屬高風險權限，不要拿來當一般管理萬用鍵

5. `adminMiddleware`（舊相容）
   - 新功能優先改用語意化 permission，避免模糊擴權

---

## 5) 動作對應建議權限（封版基準）

| 動作 | 權限 |
|---|---|
| view reservations | `can_view_reservations` |
| export reservations | `can_export_reservations` |
| checkin | `can_checkin_students` |
| supplemental checkin | `can_checkin_students` + `can_manage_events` |
| manage violations | `can_manage_violations` |
| auto-check | `can_manage_blacklist` |
| delete reservation（後台） | `can_manage_events` |

全部活動相關後台動作都要再加 event access/scope 驗證。

---

## 6) 前台自助 vs 後台管理（務必分清）

同一功能若同時存在兩種語意：

- 前台自助（例如：驗證碼取消）
- 後台管理（例如：直接刪除預約）

必須分流，不可混成「只要帶 token 就萬能」或「有驗證碼就可繞過後台規則」。

---

## 7) Phase 3 才做的事（先不要提前混入）

- JWT 即時權限刷新
- permission table
- 更細緻的 scope table
- 更完整 audit 規格化

目前 Phase 2.6 封版維持「最小可行重構 + 明確授權邊界」。

---

## 8) Phase 3.1（雙寫過渡）補充

- 3.1 仍以 JSON 為 source of truth。
- 帳號權限變更時，`teacherController` 會做 dual-write：
  - JSON (`teachers.permissions/scopes`)
  - table (`user_permission_overrides/user_scopes`)
- accessVersion 遞增規則見：
  - `docs/PHASE_3_1_IMPLEMENTATION_NOTES.md`
- Flag 說明：
  - `ACCESS_PROFILE_ENABLE_TABLE_READ`
  - `ACCESS_PROFILE_TABLE_FIRST`
  - `ACCESS_VERSION_CHECK_ENABLED`（3.2 可進入 enforce）
  - `ACCESS_VERSION_ENFORCE_ROLES`
  - `ACCESS_VERSION_ENFORCE_PATH_PREFIXES`
- 3.2 stale token 流程見：
  - `docs/PHASE_3_2_VERSION_GATE.md`

## 9) Phase 3.3（table-first 收斂）補充

- 權限來源改為 table-first：
  - `role_permissions`（base）
  - `user_permission_overrides`
  - `user_scopes`
- teacher role key 改為：
  - `teacher:executive/et_manager/if_manager/jt_manager/regular`
- JSON 僅保險 fallback，可用旗標關閉：
  - `ACCESS_PROFILE_JSON_FALLBACK_ENABLED`
- JSON mirror write 預設關閉：
  - `ACCESS_PROFILE_JSON_MIRROR_WRITE=false`
- table vs JSON 一致性改為**語意比對**（忽略 key 順序）：
  - `npm run access:check-consistency`
  - 等價殘留可清：`npm run access:clear-stale-json`（dry-run）／`npm run access:clear-stale-json:apply`
- 角色權限 seed：
  - `npm run access:seed-role-permissions`
- 切換與回滾說明：
  - `docs/PHASE_3_3_TABLE_FIRST_CUTOVER.md`
  - `docs/PHASE_3_3_AUDIT_MODEL.md`

