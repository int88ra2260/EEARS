# Authentication Acceptance

**`STAGING_EXECUTION_NOT_AUTHORIZED`**  
所有 Staging 案例：**`NOT_EXECUTED`**

本機合成 harness ≠ 本文件。本機結果標籤僅可為 `LOCAL_APPLICATION_INTEGRATION_PASSED`。

## Planned cases（授權後）

| ID | Scenario | Expected | Staging |
|---|---|---|---|
| AUTH-01 | Staff Login | 後端簽章 JWT／session | NOT_EXECUTED |
| AUTH-02 | Token／profile 載入 | AdminLayout＋權限 | NOT_EXECUTED |
| AUTH-03 | Sidebar | 與角色一致 | NOT_EXECUTED |
| AUTH-04 | Logout | 無法再進 admin | NOT_EXECUTED |
| AUTH-05 | Expired／invalid token | 401／導向登入 | NOT_EXECUTED |
| AUTH-06 | Unauthenticated deep link | 擋下 | NOT_EXECUTED |
| AUTH-07 | Forbidden deep link | Guard／403 | NOT_EXECUTED |
| AUTH-08 | Backend 401／403 | JSON，非 HTML | NOT_EXECUTED |

禁止：Production Token、停用 JWT、放寬 Guard。

證據欄不得寫入密碼、token、學生個資。
