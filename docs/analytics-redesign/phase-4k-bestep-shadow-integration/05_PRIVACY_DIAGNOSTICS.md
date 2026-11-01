# 診斷與個資

診斷欄位：pilot id、import type、evaluation scope、evaluated / total / truncated、selection method、max rows、各集合 availability、六個計數、finding 的 code / severity / dimension / count、contract version `phase-4j`、verification status、governance。

列參照沿用 validator 的 `accepted[0].listening` 或 `eval:` 索引。Snapshot 不複製 `studentId`、姓名、email、原始列物件或上傳內容。

既有 HTTP `errors` 仍含學號與姓名。那是原本的回應，shadow 沒有改它，也沒有把這份回應當成診斷。

預設不呼叫 `console.info`。`BESTEP_FILE_QUALITY_SHADOW_LOG=true` 且 shadow 本身已允許的環境，才印一行：status、evaluated、truncated、finding code。不印完整物件，也不逐列打 log。正式環境 flag 不會開，所以這行也不會在 production 出現。

診斷不寫入資料庫。
