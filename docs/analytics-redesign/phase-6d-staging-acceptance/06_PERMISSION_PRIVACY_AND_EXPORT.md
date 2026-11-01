# 權限、個資與匯出

## 角色矩陣（規劃；Staging 未測則 NOT_TESTED）

依 `adminRouteAccess.js` 語意（Hub：`allowAdminOrExecutive` **或** 下列 anyPermissions 之一）。

| 角色 | Hub | Overview | Classes／BESTEP | Learning | Operations 列表 |
|---|---|---|---|---|---|
| Admin | 可 | 可 | 可 | 可 | 可 |
| Executive | 可 | 可 | 依教師權限 | 依權限 | 依權限 |
| Class-only（有 classes、無 analytics） | 可（CAN_VIEW_CLASSES） | 否* | 可 | 否 | 視 events 權限 |
| Learning-only | 可（learning analytics） | 否* | 否 | 可 | 否 |
| Operations-only（有 analytics／events、無 classes） | 可 | 可（admin/exec）或否 | 否 | 否 | 可 |
| No Permission | 否 | 否 | 否 | 否 | 否 |
| Unauthenticated | 否 | 否 | 否 | 否 | 否 |

\* Overview 規則為 `allowAdminOrExecutive: true`（無 anyPermissions 後備）— Phase 6C 已對「僅 operations 教師」驗證不可進 overview。

若 Staging 缺少某角色帳號 → 該列標 `NOT_TESTED`，**不得**改正式 Staff 權限或冒充他人帳號。

## 個資

- Staging 優先合成／去識別化資料。
- 若含真實學生資料：禁止擅自匯出、下載、截圖、寫入外部日誌。
- 範圍須授權人確認。

## Excel Export

| 項目 | 規則 |
|---|---|
| 前置 | 帳號具匯出權限 + 授權允許下載 |
| 驗收 | 實際檔案可開、欄位符合既有契約、無權限時 403 |
| Staging 狀態 | NOT_TESTED |
| 禁止 | Production token、連 Production DB、為測試改權限 |

## 安全限制（本階段）

不得停用 JWT、放寬 Route Guard／Backend Permission、使用 Production Token、修改正式資料製造情境。
