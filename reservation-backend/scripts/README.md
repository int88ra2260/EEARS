# Scripts 目錄說明

本目錄包含系統維護和測試用的腳本檔案。

## DEMO 資料生成

### `generate-complete-demo-data.js`
**用途**: 生成完整的 DEMO 測試資料（114-1 學期）

**功能**:
- 生成班級和班級成員資料
- 生成培力個人報名資料（80% 報名率）
- 生成培力團體報名資料（3 隊）
- 生成 BESTEP 出席和成績資料
- 生成增能活動（Event）和參與紀錄（Reservation）
- 生成對應的 Excel 檔案供匯入測試

**使用方法**:
```bash
node scripts/generate-complete-demo-data.js
```

**生成資料**:
- 2 個班級，30 位學生
- 24 位學生報名培力英檢（80%）
- 3 個團體（每隊 4 人）
- BESTEP 出席和成績資料
- 20 場增能活動（每種類型 5 場）
- 約 300-400 筆活動參與紀錄

**輸出檔案**:
- `uploads/bestep/demo/培力英檢LR出缺席紀錄.xlsx`
- `uploads/bestep/demo/培力英檢SW出缺席紀錄.xlsx`
- `uploads/bestep/demo/培力英檢成績資料.xlsx`
- `uploads/bestep/demo/班級修課名單.xlsx`

## 資料清理

### `clean-demo-data.js`
**用途**: 清理所有 DEMO 測試資料

**功能**:
- 刪除所有班級和班級成員資料
- 刪除所有培力報名資料（個人和團體）
- 刪除所有 BESTEP 相關資料
- 刪除 uploads 目錄下的相關檔案

**使用方法**:
```bash
# 需要確認
node scripts/clean-demo-data.js

# 跳過確認（謹慎使用）
SKIP_CONFIRM=true node scripts/clean-demo-data.js
```

**注意**: 此腳本會刪除所有相關資料，執行前請確認！

### `clear-learning-journey-exam-import-data.js`
**用途**: 清除「英語學習歷程中心考試匯入」資料

**功能**:
- 刪除 `et_exam_attempts` 中由考試匯入產生的資料（`sourceType=excel_import` 或 `batchId` 前綴為 `v3-exam:`）
- 同步刪除對應的 `et_exam_attempt_skill_scores`
- 具備互動式確認機制（需輸入 `YES`）

**使用方法**:
```bash
node scripts/clear-learning-journey-exam-import-data.js

# 跳過確認（謹慎使用）
SKIP_CONFIRM=true node scripts/clear-learning-journey-exam-import-data.js
```

### `clear-bestep-attendance-import-data.js`
**用途**: 清除 BESTEP 出席匯入資料

**功能**:
- 刪除 `bestep_attendance` 全部資料
- 具備互動式確認機制（需輸入 `YES`）

**使用方法**:
```bash
node scripts/clear-bestep-attendance-import-data.js

# 跳過確認（謹慎使用）
SKIP_CONFIRM=true node scripts/clear-bestep-attendance-import-data.js
```

## 資料盤點

### `check-semester-data.js`
**用途**: 盤點指定學期的資料統計

**功能**:
- 統計班級和班級成員數量
- 統計培力報名數量
- 統計 BESTEP 出席和成績數量
- 統計團體報名和名次資料

**使用方法**:
```bash
node scripts/check-semester-data.js
```

## 其他工具腳本

### `populate-semester-for-registrations.js`
**用途**: 為舊的培力報名記錄補填學期欄位

**使用方法**:
```bash
node scripts/populate-semester-for-registrations.js
```

### 老師帳號建立／重設密碼（已移除一次性腳本）

先前曾提供 `create-teacher-account.js`、`reset-teacher-password.js`，會要求於 `.env` 設定 `TEACHER_PASSWORD_<username>`。此作法易讓密碼留在環境檔、且清單硬編碼不利維護，**已自本 repo 移除**。

請改使用：

- **後台**「帳號管理」：新增帳號、編輯角色／職務、**重設密碼**（產生臨時密碼並 bump `accessVersion`）。
- 或呼叫既有 API：`POST /api/admin/teachers`、`PATCH /api/admin/teachers/:id`、`POST /api/admin/teachers/:id/reset-password`（需具 `can_manage_accounts` 等權限）。

若仍有一次性大量匯入需求，建議以**獨立維運腳本**（不放進版控）或**管理 API + 稽核**處理，勿將使用者密碼寫入 `.env`。

## 注意事項

1. 所有腳本執行前請確認資料庫連線設定正確
2. DEMO 資料生成腳本會使用事務，確保資料一致性
3. 清理腳本有確認機制，避免誤刪資料
4. 建議在測試環境執行這些腳本
