# Staging Authorization Gate

**`STAGING_EXECUTION_NOT_AUTHORIZED`**

| 項目 | 狀態 | 備註 |
|---|---|---|
| Staging URL | MISSING | 需明確非正式環境 URL |
| Environment Owner | MISSING | 核准負責人 |
| Deployment Authorization | PENDING_APPROVAL／MISSING | 未取得可核對指示 |
| Candidate SHA 指定為 `610495c5…` | PENDING_APPROVAL | 文件已固定；部署授權須明文引用此 SHA |
| Test Accounts | MISSING | 專用測試 Staff，非個人正式帳號 |
| Test Data | MISSING | 合成／允許使用之資料集聲明 |
| Allowed Operations | MISSING | 登入／查詢／是否允許匯出 |
| Rollback Owner | MISSING | 具名 |
| Backup／Restore | PENDING_APPROVAL | 程序見 6D runbook；環境側未確認 |
| Acceptance Owner | MISSING | 簽核人 |

## 不等於授權（已排除）

Branch 名稱含 release、本機測試全綠、README／`.env` 出現帳密或 URL、歷史曾部署、DB 內可能有帳號 — **皆不構成授權**。

## 執行政策

任一必要項為 `MISSING` 或未確認的 `PENDING_APPROVAL` → **停止遠端操作**（不登入、不部署、不匯出、不掃描）。
