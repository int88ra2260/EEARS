# EEARS Phase 3.3 Table-first Cutover

最後更新：2026-09-21

## Source of Truth
- 主來源：`role_permissions` + `user_permission_overrides` + `user_scopes`
- JSON (`teachers.permissions/scopes`)：
  - 非主讀
  - 僅 fallback（可關閉）
  - 用於短期回滾保險
  - **帳號寫入預設不再 mirror**（見下方旗標）

## 讀取模式與旗標
- `ACCESS_PROFILE_ENABLE_TABLE_READ`（預設 `true`）
- `ACCESS_PROFILE_TABLE_FIRST`（預設 `true`）
- `ACCESS_PROFILE_JSON_FALLBACK_ENABLED`（預設 `true`，可逐步關閉）

## 寫入模式與旗標
- `ACCESS_PROFILE_JSON_MIRROR_WRITE`（預設 `false`）
  - `false`：停寫 JSON（3.3 建議）；新建／更新帳號會把 JSON 欄位寫成 `null`
  - `true`：保留 mirror write（回滾觀察期用）

## RolePermissions 接管
- role key 規則：
  - `admin`
  - `worker`（實際為 `worker:{workerLevel}`，預設 `worker:event_ops`）
  - `office_staff:{staffLevel}`
  - `teacher:executive`
  - `teacher:et_manager`
  - `teacher:if_manager`
  - `teacher:jt_manager`
  - `teacher:regular`
- 初始化腳本：
  - `npm run access:seed-role-permissions`

## 一致性檢查（語意比對）
- `npm run access:check-consistency`
- 比對改為**語意等價**（忽略 object key／陣列順序），避免假陽性。
- 會輸出：
  - `semanticDiffUsers`：table vs JSON 真漂移
  - `effectiveDiffUsers`：table_first vs json_first 有效結果差異
  - `staleJsonEqualUsers`：語意相同但仍殘留 JSON（可清）
- 清除等價殘留 JSON（預設 dry-run）：
  - `npm run access:clear-stale-json`
  - `npm run access:clear-stale-json:apply`（實際寫入；Windows 請用此指令）
- 實作：`services/accessControl/sourceConsistency.js`

## Runtime WARN
- `access_profile_source_mismatch` **只在語意不一致時**發出。
- `table_first` 下實際授權仍以 table 為準；WARN 是為了提示 fallback 殘留不可信。

## JSON 退場（3.3 採保守策略）
- 本階段不刪 schema（避免回滾成本過高）
- 建議順序：
  1. table-first 主讀 + JSON 停寫（已完成）
  2. `access:check-consistency` 確認 `semanticDiffUsers` 可接受
  3. `access:clear-stale-json -- --apply` 清掉等價殘留
  4. 觀察期後關閉 `ACCESS_PROFILE_JSON_FALLBACK_ENABLED`
  5. 下一 release 再評估刪 `permissions`／`scopes` 欄位 migration
