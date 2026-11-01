# 200 列

`MAX_SHADOW_ROWS` 仍是 200。截斷發生在欄位複製之前：只讀 `rows[0]` 到 `rows[evaluated-1]`。超過上限的 index 不會進入 validator，也沒有整份列的深拷貝。

前綴三個集合共用同一組 `eval:index`：

- raw：`first_n` / `parsed_worksheet_rows`
- accepted：`accepted_within_raw_prefix`
- skipped：`skipped_within_raw_prefix`

`evaluatedRowCount` 是這個前綴的長度。`totalRowCount` 只有 `rows` 是陣列時才有。沒有列就是 null，不是 0。`wholeFileInference` 維持 false。

`committedRowCount` 是整批 `imported`，而且只在 commit 旗標存在時出現。它不是前綴的 200。截斷時不能把前綴缺漏率乘到這個數。
