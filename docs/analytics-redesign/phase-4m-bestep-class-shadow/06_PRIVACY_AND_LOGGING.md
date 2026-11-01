# 個資與日誌

班級概況的 `students` 含學號、姓名、email 與成績。Shadow 不把這些值放進診斷。

允許出現的內容：

- pilot id `bestep-class-analytics`
- contract version `phase-4l`
- 狀態與欄位計數
- 警告代碼
- F-BESTEP-01 的 `definition_mismatch` 或 `observed_numerical_anomaly`
- 分子是否大於正分母、分母是否為 0 且分子大於 0
- 固定錯誤碼 `SHADOW_INTERNAL_ERROR`

不允許出現：學號、姓名、email、原始分數、整列學生、Authorization、JWT、完整 response、例外訊息、stack。診斷不保留 validator 的欄位路徑字串，只保留計數，避免路徑或值夾帶識別資料。雜湊學號也不會被當成匿名識別值寫入。

預設沒有 console 輸出。Controller 的 Shadow catch 不記錄例外物件。原本服務失敗的 `console.error` 仍在，那是既有 500 路徑，不是 Shadow 診斷。

測試使用合成識別值 `SYN-M-1`、`合成甲`、`person@example.com`。診斷 JSON 不包含這些字串。HTTP body 仍包含它們，因為既有 API 本來就回學生明細。
