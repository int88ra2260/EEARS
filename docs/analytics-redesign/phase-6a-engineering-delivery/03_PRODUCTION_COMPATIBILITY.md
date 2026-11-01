# 正式環境相容性

只讀檢查。沒有讀 `.env`，沒有改 IIS，沒有連正式主機。

- 部署形態仍是 Windows 上的 Node API 加前端靜態檔。這次沒有改 `ecosystem`、`web.config` 或啟動腳本。
- API 路徑沒有改。活動總覽仍是 `GET /api/analytics/overview?semester=&kind=reservation`。班級 BESTEP 仍是 `GET /api/admin/classes/:classId/bestep-overview`。
- 權限沒有改。活動總覽仍要 `requireFullCenterAnalytics`（admin 或 executive）。班級頁仍走既有 `teacherMiddleware` 與 `assertCanAccessClass`。
- 學生登入與職員登入檔案不在這 19 個提交的程式差異裡。
- 路由沒有新增。`/admin/analytics/overview` 與 `/admin/classes/:classId/bestep` 還在原位。
- 前端 build 產物檔名含 hash。上線時要整包替換靜態檔，避免瀏覽器吃到舊的 `index`。
- `.env.example` 沒有三個 Shadow 旗標。未設定即關閉。runtime 在 `NODE_ENV=production` 直接 return false。正式環境不會因為漏設旗標而啟用。
- 資料庫連線設定沒有改。沒有 migration。

相容風險：若正式機的 `NODE_ENV` 不是 `production`，而且有人把旗標設成 `true`，Shadow 會在背景跑，但仍不改回應、不寫庫。交付時不要加這三個變數。
