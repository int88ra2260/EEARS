# Phase 4G.1 與 Phase 4H 依賴審查

## Phase 4G.1（已提交於 `b44692e`）

`reservation-frontend/package.json` 只新增 devDependency：

- `@testing-library/user-event` `^14.6.1`

沒有改 scripts，沒有改既有套件版本。`package-lock.json` 只增加該套件的解析（14.6.1、`dev: true`、peer `@testing-library/dom` >= 7.21.4）。鍵盤測試直接 import 它，所以 lockfile 屬於 Phase 4G.1，已納入該 commit。

這不是使用者另行留下的無關修改。沒有執行 `npm audit fix`。

## Phase 4H（未提交）

`package.json` 新增：

- scripts：`test:analytics-browser`
- devDependencies：`@playwright/test` `^1.64.1`

`package-lock.json` 只新增三個 dev 套件，沒有改其他版本：

- `@playwright/test` 1.64.1
- `playwright` 1.64.1
- `playwright-core` 1.64.1

`engines.node` 是 `>=20`，與 CI 的 Node 20 相容。本機執行時是 Node v24.15.0、npm 11.12.1。

Playwright 是 devDependency，不會進入正式 runtime。Browser binary 下載到本機 Playwright cache，不在 git。`playwright-report/`、`test-results/`、`blob-report/`、`browser-tests/evidence/` 已寫入 `reservation-frontend/.gitignore`。

沒有安裝 Cypress，也沒有改 Vitest 設定、正式部署設定或其他套件。
