# Node 20 環境

## 發現

| 檢查 | 結果 |
|---|---|
| 系統 `node --version` | v24.15.0，路徑 `C:\Program Files\nodejs\node.exe` |
| 系統 npm | 11.12.1 |
| nvm-windows / Volta / fnm | 找不到命令或目錄 |
| Docker | 沒有 `docker` 命令 |
| CI | `.github/workflows/ci.yml` 兩處 `node-version: "20"` |
| `package.json` `engines` | 前後端都沒有這個欄位 |
| lockfile | 前後端 `package-lock.json` 的 `lockfileVersion` 都是 3 |
| Codex 內附 node | v24.14.0，不是 20 |

沒有把系統 Node 換成 20，也沒有改系統 PATH。

## 取得方式

從 `https://nodejs.org/dist/latest-v20.x/` 讀到 v20.20.2，下載官方 `node-v20.20.2-win-x64.zip`，解壓到：

`C:\Users\int88\AppData\Local\node-v20.20.2-win-x64`

驗證：`node --version` 為 v20.20.2，`npm --version` 為 10.8.2。後續命令只在該次 shell 把這個目錄放在 PATH 前面。

## 依賴安裝

在 `D:/EEARS-phase5b` 用這顆 Node 執行 `npm ci`，沒有 `npm audit fix`。

- backend：added 717 packages，exit 0，約 4 分鐘。npm 印出既有套件的 deprecated 與 52 個 audit 公告。
- frontend：added 821 packages，exit 0，約 5 分鐘。23 個 audit 公告。

Playwright 鎖定 `@playwright/test` 1.64.1。`npx playwright --version` 印出 `Version 1.64.1`。套件內 Chromium 宣告版本是 156.0.8078.4。測試直接啟動，沒有升級 Playwright，也沒有另裝瀏覽器。
