# App Router 與版面

正式應用：

- `App.js` 用 `BrowserRouter`。`/admin` 在有 token 時掛 `AdminLayout`，否則 `Navigate` 到 `staffLoginPath`。
- `AdminLayout` 用 `buildAccessProfile(token)`、`getAdminRouteDeniedReason`。拒絕時渲染 `AdminAccessDenied`，不掛頁面。
- Outlet context 提供 `token`、`accessProfile`、`navContext`。
- Sidebar 用 `filterVisibleNav` 與真實 path。
- API 經 `fetchClient` 帶 `Authorization: Bearer …`。

本階段應用 harness：

- Entry：`browser-tests/app.html` + `app-main.jsx`
- Vite 將 `/admin/*` 與 `/login` fallback 到該 HTML
- 掛真實 `AdminLayout`、`AdminHome`、班級與學習頁
- 認證是合成 JWT + `localStorage`，再走正式 `buildAccessProfile`
- 等級：Application Integration Browser，不是完整登入 E2E
