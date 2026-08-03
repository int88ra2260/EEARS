---
name: eears-data-import-excel
description: EEARS Excel 匯入（資料去重/一致性/稽核/import-runs）工作護欄
license: MIT
---

# eears-data-import-excel（Excel 匯入）

## When to Use This Skill

- 修改任何 Excel 匯入欄位映射、驗證、去重、匯入狀態流轉
- 修改 Import Center 卡片描述/入口導流（但仍遵守「不新增統一上傳 API」）
- 修改 import-runs（匯入紀錄查詢/刪除）
- 修改 LJ v3 / BESTEP / 英檢等匯入流程（通常都會連動 rebuild / audit）

## Key Files（常見落點）

Import Center（前端導流）：
- `reservation-frontend/src/pages/admin/ImportCenterPage.jsx`
- `reservation-frontend/src/constants/importCenterCards.js`

Import Runs（後端紀錄彙整與維運）：
- Router：`reservation-backend/routes/importRunHistoryRouter.js`
- Service：`reservation-backend/services/importRunHistoryService.js`
- 刪除：`reservation-backend/services/importRunDeleteService.js`

其他匯入模組（依需求選擇）：
- Learning Journey：`reservation-backend/services/learningJourney/*import*`
- BESTEP：`reservation-backend/services/bestepImportService.js`、`reservation-backend/controllers/bestepImportController.js`
- 刷卡/活動：`reservation-backend/routes/reservationRouter.js`（import-card-excel 類）

## Hard Constraints（資料一致性守則）

1. 不把 Import Center 改成「統一上傳 API」
- Import Center 的角色是入口/導流；實際上傳與寫入仍落在各功能頁與各模組端點。

2. 去重鍵與 quarantine 不可隨意改
- 一旦改了 dedupe 或衝突策略，可能造成：
  - 重複資料不會進 quarantine（或反過來）
  - admin 的 import-runs 狀態呈現失真

3. PII/敏感資料不得進 log
- 匯入通常會包含 email、姓名、學號等欄位；任何新增 log 都必須先走 mask/sanitizer。

4. 欄位驗證要對應既有模板/別名
- 中英別名、欄位順序差異要沿用既有映射/驗證規則。

## Suggested Steps（修改匯入時的實作順序）

1. 確認你改的是哪個「模組匯入」而不是 Import Center
2. 列出匯入輸入：
   - 欄位集合（含別名）
   - 狀態流轉（pending/quarantine/完成等，依實作為準）
3. 找出它對應的 import-runs 追蹤點
4. 更新並加測試：
   - 去重/衝突情境
   - 欄位錯誤的錯誤回報語意
   - 權限測試（import-runs 刪除/維運）

## Common Pitfalls

- 只更新前端模板，忘了後端欄位映射仍舊
- 允許超大檔案或移除檔名/類型檢查（資料污染與安全風險）
- 刪除或改掉稽核（audit）行為，導致運維無法追溯

## Suggested Workflow Prompt

> 請先判斷這是「哪個匯入模組」的改動，列出對應的 import 服務、import-runs 紀錄點與去重/驗證契約，然後再提出你要改的最小變更範圍與建議測試案例。

