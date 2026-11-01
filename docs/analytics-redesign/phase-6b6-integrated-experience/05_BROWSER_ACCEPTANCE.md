# 瀏覽器驗收

命令：`npm run test:analytics-browser`

設定：`playwright.analytics.config.mjs`，`127.0.0.1:3017`。

結果：35 passed，約 1.1 分鐘，exit 0。Node v20.20.2。

等級是路由／元件驗收（ROUTE_BROWSER_ACCEPTED）。Harness 使用 MemoryRouter，沒有 AdminLayout、沒有登入表單、沒有正式 API。網址列不會隨路由改變，斷言用標題、test id 與 `href`。Vite 設定沒有 API proxy；未知 API 在路由層中止，並檢查沒有連到 port 3000。資料是合成的 `SYN-CLASS`、`SYN-N1-H`。沒有產生要留存的個資截圖。

## 掛載

真實元件：`AnalyticsHubPage`、`AdminAnalyticsPage`、`ClassOverview`、`ClassBestepOverview`、`LearningAnalyticsResourcesPage`、`LearningAnalyticsSkillsPage`。

`/admin/operations` 只掛標題「活動列表」。沒有掛活動管理、簽到、違規、報表、AdminLayout、`LearningAnalyticsLayout`。

## 三條流程

| 流程 | 這次實際點過 | 未驗證 |
|---|---|---|
| Hub → 營運總覽 → 活動列表 | 看到「預約列」，再看到標題「活動列表」 | 正式活動列表的表格與篩選 |
| Hub → 班級列表 → BESTEP → 學生明細 | 「查看 BESTEP 分析」、閱讀「尚未核准為官方達標率」、「查看詳情」看到「L 出席」、關閉後回到 Hub | 正式登入與 route guard |
| Hub → 資源覆蓋 → 技能成長 | 「不代表資源造成能力提升」、「不代表課程造成進步」、返回 `href` 為 `/admin/analytics` | 正式學習分析版面與側欄 active |

## 權限與寬度

同一檔測了 admin、executive、class-only、learning-only、operations-only、event_lead、未登入。權限來自 harness JWT 與正式 `buildAccessProfile`，沒有在測試裡重寫規則。Hub 上確認沒有出現 `SYN-N1-H`。

Hub 在 1440×900、1280×800、768×1024、390×844、375×667 的頁面溢出不超過 1px，且「活動營運總覽」可以取得鍵盤焦點。詳情頁的寬度與表格捲動由同一輪既有檔案涵蓋：營運、BESTEP、學習各有自己的 viewport 測試，35 題全部通過。

沒有做螢幕報讀器測試，不標 Screen Reader Accepted。不標 Full Login E2E。
