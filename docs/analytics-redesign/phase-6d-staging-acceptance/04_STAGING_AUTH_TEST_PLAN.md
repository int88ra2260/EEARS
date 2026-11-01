# Staging 真實登入驗收計畫

狀態：**STAGING_AUTH_E2E_PENDING**（無 Staging URL／帳號／操作授權，禁止自行登入）。

## 授權前置條件（全部滿足才可執行）

| 項目 | 要求 |
|---|---|
| Staging URL | 書面指定 |
| 測試帳號 | 專用測試 Staff（非正式個人帳號冒充） |
| 允許操作 | 登入、導覽、唯讀 API、是否允許匯出 |
| 資料範圍 | 合成／去識別化優先；真實個資則禁止截圖／擅自匯出 |
| 回退責任人 | 具名 |
| 禁止 | 把 `.env` 裡的密鑰當成「操作授權」 |

## 驗收步驟（授權後）

1. 開啟 Staging 登入頁（正式 Login UI，非 harness）。
2. 正確帳密登入 → 取得後端簽章 JWT。
3. 確認權限／`buildAccessProfile` 載入後進入 AdminLayout。
4. Sidebar 顯示與角色一致。
5. 登出 → token／localStorage 清除 → 無法進 `/admin/*`。
6. Token 過期／無效 → 導向登入或 401。
7. 未登入直接 deep link（下表）→ 擋下／導向登入。
8. 權限不足 deep link → Guard 拒絕（非空白洩漏）。
9. 對應 Backend API 以瀏覽器／devtools 確認 401／403（非 HTML）。
10. 不得停用 JWT、放寬 Guard／permission、連 Production DB。

## Deep link 矩陣（Auth）

| URL | Unauthenticated | No permission | Allowed role |
|---|---|---|---|
| `/admin/analytics` | 擋 | 擋 | Hub |
| `/admin/analytics/overview` | 擋 | 擋（非 admin/executive） | Overview |
| `/admin/classes` | 擋 | 擋 | Classes |
| `/admin/classes/:id/bestep` | 擋 | 擋 | BESTEP |
| `/admin/learning-analytics/resources` | 擋 | 擋 | Learning |
| `/admin/learning-analytics/skills` | 擋 | 擋 | Learning |

## 角色需求（測試帳號申請清單）

見 `06_PERMISSION_PRIVACY_AND_EXPORT.md`。至少準備：Admin、Executive、Class-only、Learning-only、Operations-only、No Permission、Unauthenticated。

## 明確排除

- Synthetic JWT／`appAuth.js` **不可**取代本計畫。
- Phase 6C Application Integration **不可**標記本 Gate 為 PASSED。
