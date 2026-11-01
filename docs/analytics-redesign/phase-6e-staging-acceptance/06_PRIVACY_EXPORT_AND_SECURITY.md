# Privacy, Export & Security

**`STAGING_EXECUTION_NOT_AUTHORIZED`**

## 個資

- Staging 優先合成／去識別化（資料集授權：MISSING）。
- 含真實學生資料時：禁止擅自匯出、截圖外流、把個資寫入驗收文件。
- 本階段：無遠端資料接觸 → 無外洩事件可記錄。

## Export

| 項目 | 狀態 |
|---|---|
| 匯出操作授權 | MISSING |
| Staging Export 實測 | NOT_EXECUTED |

## 安全阻擋（觸發即停）

非預期正式資料流出、驗證／授權繞過、連到 Production、API 回 HTML、無法回退的部署失敗、Shadow 意外啟用、未授權寫入。

## 角色矩陣執行

Admin／Executive／Class-only／Learning-only／Operations-only／None／Unauth — Staging：**NOT_EXECUTED**（規劃見 Phase 6D `06`）。
