# 網路與個資隔離

所有允許的 API 都是 `GET /api/admin/classes/SYN-CLASS/bestep-overview`。測試記錄的呼叫都落在這條路徑。被中止的網址清單是空的。

Authorization 是 `Bearer bestep-browser-harness`。標頭不含 `eyJ`。頁面文字不含 `@`。合成列沒有 email。

沒有讀 `.env`，沒有登入正式站，沒有代理 port 3000。Vite 設定寫明沒有 API proxy。若請求落到其他 host 或其他 API，route 會中止；這次沒有發生。

失敗截圖留在 gitignore 的 `test-results/`。沒有把截圖、trace 或影片加入 commit。
