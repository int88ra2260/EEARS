# Phase 1–4N.1 盤點

來源：`git log --reverse b65e1df^..HEAD`、`docs/analytics-redesign/`、契約與路由程式。文件存在不代表使用者看得到。

狀態可以同時成立。`BROWSER_ACCEPTED` 只代表隔離瀏覽器測試通過。

## 提交對照

| Phase | Commit | 狀態 |
|---|---|---|
| 1 功能盤點 | `b65e1df` | `DOCUMENTED_ONLY` |
| 2 語意稽核 | `b65e1df` | `DOCUMENTED_ONLY` |
| 3 目標架構 | `b65e1df` | `DOCUMENTED_ONLY` |
| 4A 契約基礎 | `6a4215a` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` `RELEASE_PENDING` |
| 4B 時間查詢 | `6a4215a` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` |
| 4C 評量來源 | `6a4215a` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` `DATA_VALIDATION_PENDING` |
| 4C.1 一致性 | `6a4215a` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` |
| 4D 活動語意試點 | `640b2e0` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` |
| 4E 活動 Shadow | `ae76742` | `MOUNTED_FLAG_OFF` `MOCK_TESTED` |
| 4F 活動 UX 藍圖 | `c1129f7` | `DOCUMENTED_ONLY` |
| 4G 活動 UX | `087168e` | `USER_VISIBLE` `MOCK_TESTED` `RELEASE_PENDING` |
| 4G.1 前端測試 | `b44692e` | `MOCK_TESTED` |
| 4H 活動瀏覽器 | `da4d26e` | `BROWSER_ACCEPTED` `DATA_VALIDATION_PENDING` |
| 4I BESTEP 盤點 | `27c8d5b` | `DOCUMENTED_ONLY` |
| 4J 檔案品質契約 | `ccbd12c` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` |
| 4K 匯入 Shadow | `0949ec7` | `MOUNTED_FLAG_OFF` `MOCK_TESTED` |
| 4K.1 Shadow 硬化 | `6e72f1e` | `MOUNTED_FLAG_OFF` `MOCK_TESTED` |
| 4L 班級語意契約 | `499be06` | `IMPLEMENTED_OFFLINE` `MOCK_TESTED` |
| 4M 班級 Shadow | `b9cee83` | `MOUNTED_FLAG_OFF` `MOCK_TESTED` |
| 4N 出席與通過率決策包 | `ab7a9f5` | `USER_VISIBLE` `MOCK_TESTED` `RELEASE_PENDING` |
| 4N.1 出席瀏覽器 | `1a00599` | `BROWSER_ACCEPTED` `RELEASE_PENDING` |

Phase 1 的檔案在 `docs/analytics-redesign/00` 到 `09`，不是獨立資料夾。Phase 2、3 資料夾也在同一個 `b65e1df`。4A 到 4C.1 共用 `6a4215a`。

## 掛載事實

- 活動 Shadow：`controllers/analyticsController.js` 的 `getOverview`，僅 `kind=reservation`。旗標 `ANALYTICS_SEMANTIC_SHADOW_ENABLED`。
- 檔案品質 Shadow：`services/bestepImportService.js` 成績匯入提交成功之後。旗標 `BESTEP_FILE_QUALITY_SHADOW_ENABLED`。出席匯入與報名路由沒有這個呼叫。
- 班級 Shadow：`controllers/bestepClassController.js` 的 `getBestepOverview`，在 `getClassBestepOverview` 之後、`res.json` 之前。匯出函式沒有呼叫。旗標 `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED`。
- 使用者看得到的程式：`AdminAnalyticsPage.jsx`、`ClassBestepStudentsTable.jsx`、`classBestepDisplayHelpers.js`。它們在這條分支上，不在已部署的 `main`。

## 開放項

每個已實作階段的 Release Gate 都停在工程與測試。沒有階段標成 Data Validated、Staging Accepted 或 Deployed。F-BESTEP-01 的 A/B/C 只存在 `tests/bestepClassPassRateDecision.test.js` 與 Phase 4N 文件，服務程式仍是舊公式。
