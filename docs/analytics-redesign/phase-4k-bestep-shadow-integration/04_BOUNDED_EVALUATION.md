# 200 列上限

`MAX_SHADOW_ROWS = 200`。母體是成績匯入已經解析的 `rows`，順序是工作表列順序。`selectionMethod` 是 `first_n`。

同一前綴再分成 accepted 與 skipped：

- raw：`first_n`
- accepted：`accepted_within_raw_prefix`
- skipped：`skipped_within_raw_prefix`

三個集合的 `truncated` 都跟原始列是否超過 200 一致。不把三個 200 相加成「只評估了 200」以外的另一個總數。診斷上的 `evaluatedRowCount` 是原始列前綴長度。

`totalRowCount` 只有 `rows` 是陣列時才有。呼叫端沒給列時是 null，不會填 450 這類假總數。

前綴裡的 finding 不代表後面未掃描列的缺漏率。`wholeFileInference` 固定 false。測試把非法 CEFR 放在 index 210，450 列的診斷沒有 `SKILL_VALUE_INVALID`。

全檔 `writtenRowCount` 仍用匯入已經算好的 `imported`。它和前綴內的 `acceptedRowCount` 可以不同。截斷時不能把前綴缺漏率乘到 `writtenRowCount`。
