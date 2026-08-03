# Feature Flags 系統文件

## 概述

Feature Flags 系統允許在不重啟服務的情況下動態開關功能，提供快速回滾機制。

## 功能

### 預設 Feature Flags

| Flag 名稱 | 預設值 | 說明 |
|-----------|--------|------|
| `SURVEY_GATE_ENABLED` | `true` | 問卷 Gate 功能開關 |
| `EMAIL_NOTIFICATION_ENABLED` | `true` | Email 通知功能開關 |
| `NO_SHOW_AUTO_MARK_ENABLED` | `true` | No-Show 自動標記功能開關 |
| `BLACKLIST_MODAL_ENABLED` | `true` | 黑名單警告 Modal 開關 |
| `CLASS_OVERVIEW_EXPORT_ENABLED` | `true` | 班級參與概況匯出功能開關 |
| `RESERVATION_SORT_SEARCH_ENABLED` | `true` | 預約排序與搜尋功能開關 |

## API 端點

### 取得所有 Feature Flags

```http
GET /api/admin/feature-flags
Authorization: Bearer <admin_token>
```

**回應**:
```json
{
  "success": true,
  "data": {
    "SURVEY_GATE_ENABLED": true,
    "EMAIL_NOTIFICATION_ENABLED": true,
    "NO_SHOW_AUTO_MARK_ENABLED": true,
    "BLACKLIST_MODAL_ENABLED": true,
    "CLASS_OVERVIEW_EXPORT_ENABLED": true,
    "RESERVATION_SORT_SEARCH_ENABLED": true
  }
}
```

### 取得單一 Feature Flag

```http
GET /api/admin/feature-flags/:flagName
Authorization: Bearer <admin_token>
```

**回應**:
```json
{
  "success": true,
  "data": {
    "flagName": "SURVEY_GATE_ENABLED",
    "value": true
  }
}
```

### 設定 Feature Flag

```http
PUT /api/admin/feature-flags/:flagName
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "value": false
}
```

**回應**:
```json
{
  "success": true,
  "message": "Feature Flag SURVEY_GATE_ENABLED 已設定為 false",
  "data": {
    "flagName": "SURVEY_GATE_ENABLED",
    "value": false
  }
}
```

## 使用方式

### 在程式碼中檢查 Feature Flag

```javascript
const { getFeatureFlag } = require('../utils/featureFlags');

async function myFunction() {
  const isEnabled = await getFeatureFlag('SURVEY_GATE_ENABLED', true);
  
  if (isEnabled) {
    // 功能啟用時的邏輯
  } else {
    // 功能關閉時的邏輯（或跳過）
  }
}
```

### 環境變數設定

Feature Flags 也可以透過環境變數設定（優先級低於資料庫設定）：

```bash
FEATURE_SURVEY_GATE=false
FEATURE_EMAIL_NOTIFICATION=true
FEATURE_NO_SHOW_AUTO_MARK=true
```

## 快取機制

- Feature Flags 會快取 1 分鐘（TTL）
- 設定新的 Flag 值會立即更新快取
- 如需強制重新載入，可呼叫 `clearCache()`

## 回滾策略

### 緊急關閉功能

1. **透過 API**:
   ```bash
   curl -X PUT http://localhost:3000/api/admin/feature-flags/SURVEY_GATE_ENABLED \
     -H "Authorization: Bearer <admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"value": false}'
   ```

2. **透過環境變數**（需要重啟服務）:
   ```bash
   # 在 .env 設定 FEATURE_SURVEY_GATE=false 後重啟
   # Windows 正式環境：
   scripts\ops\restart-backend.bat
   # 或：pm2 restart eears-backend
   ```

3. **直接修改資料庫**:
   ```sql
   UPDATE settings 
   SET value = 'false' 
   WHERE key = 'feature_flag_SURVEY_GATE_ENABLED';
   ```

## 最佳實踐

1. **預設值**：總是提供合理的預設值（`getFeatureFlag(flagName, defaultValue)`）

2. **錯誤處理**：當 Feature Flag 讀取失敗時，系統會使用預設值，不會中斷流程

3. **測試**：在測試環境中，可以手動設定 Feature Flags 來測試不同場景

4. **監控**：建議記錄 Feature Flag 的使用情況，以便分析功能使用率

## 相關文件

- [CHANGELOG.md](../CHANGELOG.md)
- [API_SPECIFICATION.md](./API_SPECIFICATION.md)

