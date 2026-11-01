# Phase 4K.1 實作摘要

Phase 4K 的 shadow 已留在本機 commit `0949ec7`。本階段只修正資料階段語意與 shadow 自己的錯誤邊界。

已完成：

- `rawFileRows` 標成 `parsed_worksheet_rows`。`originalFileFidelity` 是 `not_verified`。
- 沒有 `commitSucceeded: true` 時，不給 `committedRowCount`。匯入 hook 只在 commit 成功後傳入這個旗標。
- `validatedRowCount` 維持 null。匯入程式沒有獨立的 validated 計數器。
- `SOURCE_INFORMATION_LOSS` 仍保留，但 shadow 診斷把證據降為 `undetermined` / `parsed_versus_normalized`。離線 validator 的 `contract_only` 沒有改。
- Snapshot、mapping、validator、sanitizer 的 throw，以及 thenable，都收成固定 code。Logger throw 不改診斷，也不改匯入結果。

沒有做：管理員報告、新 API、L3、B2 或匯入政策變更。
