# 追溯與品質標記

標記是並列事實，沒有權重，也不能相加成一個品質分。

| 標記 | 意義 |
|---|---|
| MISSING_ASSESSMENT_DATE | 沒有可用的日曆考試日 |
| INFERRED_ASSESSMENT_DATE | 呼叫端標成推估，或同步哨兵 1970-01-01 被排除 |
| SEMESTER_ONLY_DATE | 只有檔案學期。考試日仍是 null |
| MISSING_CEFR_LEVEL | 沒有可辨識的 A1–C2 |
| MISSING_RAW_SCORE | 沒有有限數值的原分 |
| NORMALIZED_CEFR_LOSS | 輸入含加號，正規化欄只留基底等級 |
| UNKNOWN_SOURCE_IDENTITY | 來源主鍵是空的 |
| UNVERIFIED_PROJECTION | `sourceType=BESTEP` 但沒有培力列 id |
| POSSIBLE_DUPLICATE | 比較結果認為坐席相似，但沒有來源連結 |
| SOURCE_CONFLICT | 同一身分、投影連結或相似坐席上，分數或等級衝突。sourceRef 與 payload id 矛盾時也會出現在單筆觀測 |
| INSTRUMENT_NOT_COMPARABLE | 兩邊工具都已知且不同，或有一邊未知 |
| UNKNOWN_IMPORT_BATCH | 沒有批次 id |

觀測上的標記描述這一列。比較結果上的標記描述這一對，不會寫回觀測。

`provenance` 另外保留欄位對應、`studentPk`、et 兩個日期欄是否不一致。這些不是品質分。
