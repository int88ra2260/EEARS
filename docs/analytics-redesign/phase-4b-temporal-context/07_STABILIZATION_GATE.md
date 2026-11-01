# Phase 4B 基準檢查

檢查當下：

- Branch：`analytics/phase-4b-temporal-context`
- HEAD：`1f41dd5202c5672076ab3181e563effb172823fe`
- `git diff` 與 `git diff --cached` 沒有已追蹤檔案的變更
- Phase 4A／4B 檔案仍是未追蹤新增

```text
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts
```

基準當下是 6 個 suite、45 個測試通過。通過後才開始 Phase 4C。沒有 commit。

## 建議提交分組

下面只是以後要提交時的路徑。這次沒有執行。不要用 `git add .`。不要加入 `.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/`、任何 `.pem`。

1. Phase 4A 契約登錄

```text
git add -- reservation-backend/analytics-contracts/errors.js reservation-backend/analytics-contracts/domainRegistry.js reservation-backend/analytics-contracts/decisionGateRegistry.js reservation-backend/analytics-contracts/metricRegistry.js reservation-backend/analytics-contracts/temporalRegistry.js reservation-backend/analytics-contracts/legacyMappings.js reservation-backend/analytics-contracts/contractValidator.js reservation-backend/analytics-contracts/goldenCases.js reservation-backend/tests/analytics-contracts/registryIntegrity.test.js reservation-backend/tests/analytics-contracts/semanticAndGolden.test.js docs/analytics-redesign/phase-4a-contract-foundation
```

`index.js` 同時 export 4B 與 4C，不適合放進只有 4A 的提交。若要拆提交，需先讓 4A 的 index 可獨立載入，再在下一筆補 export。現在一次提交 4A+4B 的程式、下一筆再交 4C，比較不會留下不能載入的 index。

2. Phase 4A 與 4B 一起（可建置）

```text
git add -- reservation-backend/analytics-contracts/errors.js reservation-backend/analytics-contracts/domainRegistry.js reservation-backend/analytics-contracts/decisionGateRegistry.js reservation-backend/analytics-contracts/metricRegistry.js reservation-backend/analytics-contracts/temporalRegistry.js reservation-backend/analytics-contracts/legacyMappings.js reservation-backend/analytics-contracts/contractValidator.js reservation-backend/analytics-contracts/goldenCases.js reservation-backend/analytics-contracts/temporalTime.js reservation-backend/analytics-contracts/semesterBoundaryAdapter.js reservation-backend/analytics-contracts/legacyTimeAdapter.js reservation-backend/analytics-contracts/temporalContextBuilder.js reservation-backend/analytics-contracts/temporalCompatibility.js reservation-backend/analytics-contracts/temporalBoundaryRepresentation.js reservation-backend/analytics-contracts/index.js reservation-backend/tests/analytics-contracts/registryIntegrity.test.js reservation-backend/tests/analytics-contracts/semanticAndGolden.test.js reservation-backend/tests/analytics-contracts/temporalBoundaryValidator.test.js reservation-backend/tests/analytics-contracts/temporalCompatibility.test.js reservation-backend/tests/analytics-contracts/temporalContextBuilder.test.js reservation-backend/tests/analytics-contracts/temporalGoldenCases.test.js docs/analytics-redesign/phase-4a-contract-foundation docs/analytics-redesign/phase-4b-temporal-context
```

研究文件 `docs/analytics-redesign/00` 到 `09`、`phase-2-semantic-contracts`、`phase-3-target-architecture` 是另一組，不和程式綁在同一筆。

提交前用 `git diff --cached --name-only` 核對清單。
