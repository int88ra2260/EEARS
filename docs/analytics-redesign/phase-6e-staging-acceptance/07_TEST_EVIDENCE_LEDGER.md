# Test Evidence Ledger

Application Candidate：`610495c5a9c9e0656f894ce19d81f381319d1ae8`  
Evidence SHA：`f8323f52c9e951c3554fb6503b0dbbbda2515b7c`  
Environment（本機）：Node v20.20.2／npm 10.8.2  
Tester：local agent session（Phase 6E）  
**Staging environment：N/A（未授權）**

| Test Case ID | Scenario | Role | Expected | Actual | Status | Evidence | Open Issue |
|---|---|---|---|---|---|---|---|
| ISO-01 | Prod vite／index 非 harness | n/a | 無 fallback／無 browser-tests entry | 符合 | PASSED | isolation test #1 | — |
| ISO-02 | src login／boot 無合成 auth import | n/a | 無 harness 符號 | 符合 | PASSED | isolation test #2 | — |
| ISO-03 | build 無 harness 產物 | n/a | 無 browser-tests／無符號 | 符合 | PASSED | isolation test #3 + fresh build | — |
| ISO-04 | web.config 為 ReverseProxy | n/a | Node:3000／非 test fallback | 符合 | PASSED | isolation test #4 | — |
| BUILD-01 | `npm run build` | n/a | exit 0 | exit 0 ~32.55s | PASSED | local log | — |
| ESLINT-01 | 相關前端 lint | n/a | exit 0 | exit 0 | PASSED | local | — |
| APPINT-01..06 | App Integration Browser | synthetic | 6 green | 6 passed | LOCAL_APPLICATION_INTEGRATION_PASSED | playwright analytics | 不可當 Staging |
| BE-FULL | Backend Jest 236／1608 | n/a | 歷史綠 | 未於 6E 重跑 | 歷史證據（前 SHA 語境） | Phase 6C／6D docs | 勿宣稱本 Evidence SHA 重跑 |
| FE-UNIT-116 | Frontend 116 | n/a | 歷史 | 未於 6E 全量重跑 | 歷史證據 | Phase 6C | — |
| PW-41 | Playwright 41 | n/a | 歷史 | 本次僅重跑 appIntegration 6 | 部分本次／其餘歷史 | — | — |
| STG-AUTH-* | Real staff login | staging | — | — | NOT_EXECUTED | — | 缺授權 |
| STG-OPS／BESTEP／LEARN | 三領域 | staging | — | — | NOT_EXECUTED | — | 缺授權 |
| STG-EXPORT | Excel | staging | — | — | NOT_EXECUTED | — | 缺授權 |

Ledger **不含** token、密碼、學生個資。
