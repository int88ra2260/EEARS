# 測試報告

Node 為本機可攜版 v20.20.2，npm 10.8.2。命令都先把這個 Node 放進該次 shell 的 PATH。

## 前端單元

提交前以 Node v20.20.2 重跑同一組 12 個檔：114 tests，exit 0，約 26.75s。包含 Hub、營運觀察、BESTEP、路由權限、側欄、學習歷程主頁／時間軸／名冊契約，以及 `learningExperience.test.jsx`。

## 瀏覽器

`npm run test:analytics-browser`：30 passed，約 1.0 分鐘，exit 0。其中學習流程 3 題：Hub 到資源覆蓋再到技能成長、空資料與 500、五種寬度與鍵盤展開。

掛載範圍：`AnalyticsHubPage`、`LearningAnalyticsResourcesPage`、`LearningAnalyticsSkillsPage`。不是 AdminLayout 登入流程，也不是正式 API。等級記為路由／元件驗收，不記完整 E2E。

沒有做螢幕報讀器測試，不標 Screen Reader Accepted。

## 後端

完整 Jest **沒有重跑**。不沿用先前 236 suites／1608 tests 當作本階段結果。

本階段只跑既有 LVA 契約：

`npx jest tests/lvaAnalyticsService.test.js tests/lvaMethodsUpgrade.test.js --runInBand`

2 suites，20 tests，exit 0。沒有改這兩個檔。

## ESLint 與 build

針對本次修改檔執行 `npx eslint`，exit 0。只有既有的 Browserslist 資料過舊提示。

提交前 `npm run build`：6885 modules，32.43s，exit 0。Playwright 30 passed 是上一輪同一程式的結果，這次提交前沒有再改瀏覽器測試。
