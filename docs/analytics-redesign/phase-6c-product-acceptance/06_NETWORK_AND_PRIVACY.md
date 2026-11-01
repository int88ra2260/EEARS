# 網路與隱私

- 只允許 `127.0.0.1`／`localhost`
- 非 allowlist 的 `/api/**` 直接 abort
- 外部主機 abort；連到 port 3000 會讓測試失敗
- Vite analytics 設定沒有 API proxy
- 合成資料：`SYN-CLASS`、`SYN-N1-H`、合成教師／活動
- 合成 JWT（`e30.…sig`），不是正式 Staff 憑證
- 失敗截圖僅在本機 test-results，不提交
- Hub 與守衛案例確認無權限時不顯示學生識別資料
