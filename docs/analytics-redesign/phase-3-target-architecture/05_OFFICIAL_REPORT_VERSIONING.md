# 05 正式成果版本

三個詞不要互換。

| 詞 | 意思 | 現況有沒有 |
|---|---|---|
| Reproducible | 來源列與規則都在，用同一版程式可重算出同一數字 | 舊學期多數沒有。快照同日會被覆蓋，來源也沒版本化 |
| Traceable | 知道當時用了哪張表、哪條規則、多少列，但不保證重算相同 | 培力列有 `sourceFile`、`importedAt`。KPI 沒有發布紀錄 |
| Frozen Result | 發布的數值被存下來，之後匯入不會改它 | 沒有。這是要新建的能力 |

監測是每次重算。探索也是重算，但宣稱更低。正式成果是 Frozen Result，外加當時做得到的 Traceable 資訊。不要把「可凍結」說成「可重現」。

## 概念

```text
ReportDefinition   允許哪些 Metric ID、哪個 Usage、要哪些核准
ReportRun          一次計算
MetricResult       該次的數字與 metadata
MetricVersion      公式版
SourceManifest     表、列數、最大時間、來源鍵雜湊（不是全表副本）
PopulationManifest 分母身分的雜湊與人數，不含姓名
PublicationStatus  draft | in_review | published | superseded
PublishedAt
DataAsOf           核准人聲明的截止；若做不到過濾，標 unsupported
RecalculationPolicy freeze | recalc_monitoring_only
```

第一期儲存可以是一張發布表加 JSON，不必先正規化成八張表。重點是 published 列不可 UPDATE 數值。更正用新 Run，`supersedes` 指向上一版。

## 八個問題

1. **發布時固定什麼。** Metric ID、Metric Version、政策鍵與政策 JSON 副本、Temporal Contract 與 bound、Population 人數與身分雜湊、分子、率、Source Manifest、缺漏政策版本、宣稱等級、Data As Of 的聲明、計算時間、計算程式 build。不固定「現在資料庫的最新列」。
2. **如何追溯。** Source Manifest 的雜湊對得上當時的列集合時，才標 Reproducible。對不上或從未保存列集合時，標 Traceable 或僅 Frozen。培力 `sourceFile` 若檔案還在磁碟，可在 manifest 記檔名與大小，不把 Excel 自動收進 Git。
3. **資料修正後。** 新匯入只改監測。正式數要改，就 `draft` 新 Run，審查後 `published`，舊的變 `superseded`。舊版仍可讀。
4. **舊版如何留。** 不刪 published 與 superseded。同日快照那種覆蓋不准用在這張表。
5. **過期的監測。** 監測回應若 `derivedAt` 或來源 `importedAt` 比對方舊超過畫面設定的門檻，標 `stale`。這不改變數值。正式版沒有 stale，只有 superseded。
6. **歷史無法重算。** 對已發生的學期，若沒有當時的嘗試集合與政策副本，禁止提供「重算 113-1 官方 KPI」按鈕。允許的是：從今天起的發布開始凍結；過去的簡報若要進系統，只能當 Frozen 的人工登打，並標 `enteredManually: true`，與系統計算分開。
7. **與現有快照的區別。** `lj_analytic_*` 是投影快取，`snapshot_version` 含日期與規則，同日 sequence 固定為 1 會覆蓋。它不是 Report Run。快照可以當作探索的輸入版本，寫進該次探索的 Source Manifest，但發布達標時不讀 `isB2plus`。
8. **核准狀態。** `draft` 計算者可建。`in_review` 行政確認母體與規則。`published` 需要第二人（建議主任或被授權的成果負責人）。系統在 D1 未核准時拒絕把任何達標 ID 送進 `in_review`。營運指標可以先走這條流程，用來驗證機制，不代表活動利用率變成英語成果。

## 監測與正式的讀取

| | Monitoring | Official |
|---|---|---|
| 觸發 | 開頁、匯入後的下一次查詢 | 明確的發布動作 |
| 晚到資料 | 會變 | 不會變 |
| 畫面 | 必須寫「監測，會更新」 | 必須寫版本號與發布時間 |
| 失敗的重建 | 快照頁可能舊 | 與快照無關的已發布數字不變 |

主任儀表板若同時放監測與最近一次 published，兩塊要分開，不能加總。

## 現在就能凍結、與還不能凍結

能先做機制的：Scenario 1 的營運五個 ID。它們的 Data As Of 仍是「發布當下」，因為活動列沒有雙時態；所以第一版官方營運附錄是 Frozen＋Traceable，不是 Reproducible。

不能凍結成英語成果的：所有達標 ID、歷史最佳、校正成長、資源效果。閘門在 `08`。
