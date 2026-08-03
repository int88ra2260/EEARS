# 稽核紀錄 `entityType` / `entityId` 規範

`audit_logs` 每一筆必須能對應到「被操作的對象」或「摘要鍵」，便於管理端篩選與除錯。後端 `auditLogService.logAudit` / `logAuditAsync` 要求 **`entityType` 與 `entityId` 皆不可為 `undefined`**（可為字串或數字，會轉成字串寫入）。

## 單筆實體（最常見）

| 情境 | `entityType` | `entityId` |
|------|----------------|------------|
| 已存在資料列 | Sequelize 模型名稱慣例，如 `Event`、`Reservation`、`EnglishTestRegistration` | 該筆主鍵（數字或字串） |
| 建立成功後 | 同上 | **新建**資料的主鍵 |

## 無法指向單一列時

| 情境 | 建議 `entityType` | 建議 `entityId` | 補充 |
|------|-------------------|-----------------|------|
| 帳號不存在或無法解析 | `Teacher` | **`unresolved`** | 登入失敗等；勿使用 `null` 當 `entityId` |
| 同一請求內多筆批次（狀態批次更新等） | 業務實體名稱或 `AuditAggregate` | **`bulk`** 或 **`send-status-emails:${status}`** 等可讀複合鍵 | 細節放 `targetSummary`、`afterData`（含 `sampleIds`、筆數） |
| 登入失敗 **時間窗合併**（高頻摘要） | **`AuditAggregate`** | **`login_failure:{ip}:{minuteBucket}`**（截斷 64 字元內） | `afterData` 含 `aggregate: true`、`count`、`sampleUsernames`、`reasons` |

## 與 `requestId` 的關係

- 每一筆稽核仍會帶 **`requestId`**（來自 `req.requestId`），與 `entityId` 不同：前者追蹤 HTTP 請求，後者追蹤業務實體或摘要鍵。
- 前端請求請帶 **`x-request-id`**（可用 `fetchClient` / `axiosClient`），與後端 system_logs / audit 對齊。

## 新增模組時檢查清單

1. 是否為單筆 CRUD？→ 使用實體主鍵。
2. 是否為批次？→ 使用 `bulk` 或語意化複合鍵，並在 `afterData` 寫入筆數與前幾筆 id。
3. 是否無法對應主鍵？→ 使用 **`unresolved`** 或 **`AuditAggregate`** + 穩定可讀的複合鍵，並在文件中補充。
