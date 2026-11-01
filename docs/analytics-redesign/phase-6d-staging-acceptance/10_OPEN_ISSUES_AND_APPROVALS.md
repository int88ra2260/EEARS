# 未決事項與所需授權

## 外部阻擋（BLOCKED／PENDING）

| 項目 | 狀態 | 說明 |
|---|---|---|
| Staging 環境 URL | 未提供 | 無法部署／實測 |
| Staging 部署授權 | 未取得 | Runbook 僅文件 |
| 測試 Staff 帳號 | 未核發 | Auth E2E pending |
| 匯出授權 | 未確認 | Export NOT_TESTED |
| 資料集性質 | 未確認 | 真實個資則需額外限制 |
| 回退責任人 | 未指定 | — |
| Screen Reader | SCREEN_READER_PENDING | 需輔助科技實測 |
| Official Reporting | Pending | 政策未放行 |
| Production 部署 | NOT_APPROVED | 另行核准 |

## 工程已完成、不依賴 Staging 的項目

- Phase 6C commit + Staging Candidate SHA freeze
- IIS／Node SPA／API JSON 程式與設定盤點
- Harness／Production build 隔離
- Staging 驗收計畫與三流程／權限矩陣文件
- 本機關鍵回歸（見 07）

## 明確未做

- Push／Merge／Rebase／Tag
- 遠端部署、IIS 變更、DB／Migration／L3
- 真實登入、Staging 三流程、Excel 實測
- 提交 Phase 6D 文件或 isolation 測試

## 建議簽核順序

1. Staging 環境與帳號授權  
2. 部署 `610495c5…` + IIS／API smoke  
3. Auth E2E + 三流程 + 權限／匯出  
4. 更新 Gate → 再議 Product／Production／Official Reporting  
