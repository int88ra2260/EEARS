# 個資與 log

診斷仍不含學號、姓名、email、原始列、原始成績與上傳內容。跳過列只留 code。

預設不呼叫 `console.info`。Log flag 為字串 `true` 時只印一行：pilot、status、stage、evaluated、truncated、finding code。不印完整報告，不把 exception 傳進 logger。

測試用 `student SYN-SHADOW-1` 讓 snapshot、mapping、validator、sanitizer 與 logger throw。診斷 JSON 與那一行 log 都沒有這個字串。
