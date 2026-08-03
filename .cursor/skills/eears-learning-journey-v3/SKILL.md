---
name: eears-learning-journey-v3
description: EEARS Learning Journey v3（canonical/legacy gate、讀模型 feature flag、匯入/維運）
license: MIT
---

# eears-learning-journey-v3（Learning Journey v3）

## When to Use This Skill

- 你要改 Learning Journey v3 的 API / 讀模型 / projection 重建邏輯
- 你要改 LJ v3 匯入（enrollment/exam/operation runs）與一致性策略
- 你要處理 canonical policy（legacy write blocked）相關的錯誤或維運流程
- 你要改「版本/讀模型 feature flag」導致的 legacy 回退行為

## Background You Need（以現況為準）

### 讀模型 feature flag
- `reservation-backend/services/learningJourney/learningJourneyFeatureFlags.js`
  - `ENABLE_LEARNING_JOURNEY_V3_READ_MODEL`：
    - 未明確設為 `"false"` 時，預設啟用 v3 讀模型

### canonical required gate（legacy write policy）
- `reservation-backend/services/learningJourney/canonicalSemesterPolicyService.js`
  - 預設 required from：`115-1`（`DEFAULT_REQUIRED_FROM`）
  - policy：
    - `canonical_required_legacy_write_blocked`
    - 或 `legacy_write_allowed_for_historical_semester`

### 稽核/治理（migration governance）
- `reservation-backend/docs/LJS_MIGRATION_GOVERNANCE.md`
  - 說明治理層的 batch/checkpoint/quarantine 操作方式
  - 也包含 `run-learning-journey-migration.js` 的預期 CLI 行為

## Hard Constraints（不可違背）

1. canonical required 期間：不得寫 legacy

- 若目標 semester 判定為 canonical required，必須維持：
  - legacy write blocked（不可讓 legacy 寫入繼續通過）

2. migration 腳本存在性必須確認

- `reservation-backend/package.json` 可能宣告某些 LJ migration/治理 scripts
- 但目前在 `reservation-backend/scripts/` 目錄下未必都存在（可能出現 script 斷裂）。
- 因此任何「建議執行 CLI 指令」前，AI 必須先檢查對應檔案是否存在；若不存在：
  - 改成「需補齊該 script / 或調整 package.json」而不是指令立即執行

3. quarantine / dedupe 與一致性契約

- LJ 匯入通常包含去重、衝突隔離（quarantine）與 projection 重建連動
- 不得只改成功路徑而忽略衝突/隔離狀態流轉（import-runs/operation-runs 也可能受影響）

## Suggested Steps（改 LJ v3 時的順序）

1. 先判斷：這是讀（read model）還是寫（import/sync）？
2. 找到 canonical policy 使用在哪裡、是如何由 semesterId 判斷（對照 `buildCanonicalPolicy`）
3. 若改寫入流程，確認：
   - 哪些情境要 quarantine
   - 哪些情境要 rebuild/projection
   - legacy 何時放行/何時阻擋
4. 補測（優先）
   - canonical gate 行為
   - legacy fallback/阻擋行為
   - 去重鍵與衝突狀態

## Suggested Workflow Prompt

> 請先判斷我這個需求是影響 LJ v3 讀模型還是寫入流程；接著指出它會觸及 canonical policy 與 legacy write gate 的哪一段，並列出需要補的測試（canonical blocked/unblocked、dedupe/quarantine、以及 legacy 回退的行為）。

