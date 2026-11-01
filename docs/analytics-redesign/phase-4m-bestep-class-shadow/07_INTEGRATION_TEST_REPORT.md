# 整合測試報告

沒有連線 MySQL。真實班級資料沒有重跑。

## 後端

```text
cd reservation-backend
npx eslint analytics-contracts tests/analytics-contracts
npx jest --runInBand tests/analytics-contracts tests/bestepClassAnalyticsShadow.test.js tests/bestepClassOverviewShadow.controller.test.js tests/bestepClassExport.test.js tests/bestepScoreImportShadow.test.js tests/bestepScoreImportControllerShadow.test.js
```

ESLint：`analytics-contracts` 與 `tests/analytics-contracts` 為 0 errors、0 warnings。

`controllers/bestepClassController.js` 仍有既有 warning：`getBestepOverview` 的 `next` 未使用。這次沒有改函式簽名。

Jest 合併結果：22 suites、237 tests、237 passed、0 failed、0 skipped。

其中 `tests/analytics-contracts` 單獨是 17 suites、208 tests，全部 passed。新增的 runtime 測試 7 條、controller 測試 6 條。班級匯出與 BESTEP 匯入品質 Shadow 的既有測試包含在上述 22 suites 裡。

## 前端

```text
cd reservation-frontend
npx vitest run src/utils/classBestepDisplayHelpers.attendance.test.jsx
```

1 file、3 tests passed。沒有改正式元件。

## M01–M32

| ID | 結果 |
|---|---|
| M01–M04 | 旗標預設關閉；production、`TRUE`、`1` 不啟用；關閉時不呼叫 validator |
| M05 | 開啟時呼叫既有 validator |
| M06–M08 | 同一合成 response 的 status、全部 JSON 鍵值不變 |
| M09–M11 | 路由仍先 `authMiddleware` 再 `teacherMiddleware`；`assertCanAccessClass` 在服務與 Shadow 之前 |
| M12 | 服務拒絕仍是 500，Shadow 不呼叫 |
| M13–M15 | validator、query mapping、sanitizer 丟例外時只回 `SHADOW_INTERNAL_ERROR` |
| M16 | logger 丟例外時不覆蓋已完成診斷 |
| M17–M18 | `findByPk` 與服務次數不變；凍結前的 JSON 與診斷後相同 |
| M19–M20 | 診斷不含學號、姓名、email、分數與學生列 |
| M21–M23 | 查詢參數仍進服務；pagination 不被改寫；匯出不呼叫 Shadow |
| M24–M25 | `recalculated` 為 false；沒有改 B2 政策 |
| M26–M28 | 母體一致 50%、母體不一致 150%、分母 0 時公布率為 0 |
| M29–M30 | 前端 true/false/null 與缺少出席物件的渲染證據 |
| M31 | 32 個 metric、9 個 temporal、7 個 domain、D1–D11 pending、2 個未實作 |
| M32 | `mergePerformed` 與 `sourcePriorityApplied` 維持 false |

## 未用真實資料驗證

沒有對正式班級重算通過率，也沒有用正式出席列確認 null 的出現頻率。合成案例只證明程式能夠產生這些結果。
