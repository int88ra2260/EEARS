# 瀏覽器歷史與響應式

已在 Application harness 驗證：

- URL 隨 `BrowserRouter` 改變
- `goBack`／`goForward`
- Deep link 後 `reload` 仍顯示 AdminLayout 與班級 BESTEP
- 五種 viewport：1440×900、1280×800、768×1024、390×844、375×667；窄螢幕可開「選單」
- Hub 主要連結可鍵盤聚焦；頁面溢出 ≤ 1px

Sidebar active state 沿用既有 `getSidebarActiveState`。Screen Reader：`SCREEN_READER_PENDING`。
