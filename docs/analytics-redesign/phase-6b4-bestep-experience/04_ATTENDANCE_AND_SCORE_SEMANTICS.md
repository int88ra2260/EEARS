# 出席、抵免、零分、缺值

表格原本就用文字：

| 資料 | 畫面 |
|---|---|
| `attended: true` | 出席 |
| `attended: false` | 缺席 |
| `attended: null` | 未確認 |
| 有技能物件但沒有 `attended` | 未確認 |
| 空的 attendance 物件 | 未匯入 |

明細視窗以前用 `attended ? 出席 : 缺席`，`null` 會變成缺席。這次改成與表格相同的三態。空物件仍是未匯入。

抵免留在抵免欄。出席格不寫抵免，也不把未匯入寫成缺席。

總分與四技能分數改走 `formatStoredScore`。0 顯示 0。`null`、沒有欄位、空字串顯示 `-`。沒有整筆 `score` 仍是「未匯入」。

平均分 0 現在會顯示。以前 `avgScore &&` 會把 0 藏起來。
