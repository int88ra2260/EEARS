# 回歸證據與治理限制

## Node／npm

- Node：`v20.20.2`
- npm：`10.8.2`
- Lockfile：frontend／backend `lockfileVersion: 3`（Phase 6C／6D **未**變更 lockfile）

## 測試證據對應

| 套件 | 結果 | 證據綁定 |
|---|---|---|
| Backend Full Jest | 236 suites／1608 tests／exit 0／約 149s | **歷史**：Phase 6C 文件記載；程式為 frontend-only 變更。**不得**宣稱 `610495c5` 本機重跑 1608。來源 SHA 語境：Product RC `c2bfd447…` 及先前工程鏈 |
| Frontend Unit（含 Hub） | 116 passed（Phase 6C）；本 Phase 6D 重跑關鍵 Analytics／route／ops／bestep／learning + isolation | Candidate 前端內容與 6C 提交一致；isolation 測試檔未進 Candidate |
| Application Integration | 6 passed | Phase 6C／本階段重驗 |
| Playwright 總計 | 41 passed | Phase 6C 證據 |
| ESLint | exit 0 | 本階段重跑相關前端 |
| Production Build | exit 0 | 本階段重跑；~6886 modules |
| Production isolation vitest | 4 passed（Phase 6D closure 重跑） | Evidence SHA 將於 6D commit 固定；不證明 Staging |

### Phase 6D 本機重跑（關鍵）

於 Candidate 內容上執行（不重跑完整 Backend Jest）：

- Analytics Hub／Route／Operations／BESTEP／Learning 相關 unit
- `appIntegration.browser.mjs`
- ESLint
- `npm run build`
- `productionBuildIsolation.test.mjs`

## Shadow Safety（驗收勿自行啟用）

| Shadow | Flag（概念） | 要求 |
|---|---|---|
| Activity Operations | 既有 ops shadow flag | 預設關、Production 禁用、fail-open、不寫 DB、不改正式 response |
| BESTEP File Quality | `BESTEP_FILE_QUALITY_SHADOW_ENABLED` | 同上 |
| BESTEP Class Analytics | `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED` | 同上；`officialUseAllowed=false`；`causalClaimAllowed=false` |

## Metric & Governance（不得因 Candidate 通過而解讀為官方核准）

- 32 Metric IDs；7 Domains；9 Temporal Contracts
- 2 Unimplemented Metrics；D1–D11 Pending
- `officialUseAllowed=false`；`causalClaimAllowed=false`
- F-BESTEP-01 Decision Pending

## Data Operations（本階段禁止）

Migration、Model／正式 SQL 變更、DB 寫入、未授權 L3、自動去重 Assessment Source、重算歷史 BESTEP — **皆未執行**。
