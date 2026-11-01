# 資源接觸與參與

| 畫面上的數字 | 來源欄位 | 單位 | 不能怎麼讀 |
|---|---|---|---|
| 參加過的人數 | `resourceEffectiveness.participantCount` | 不重複 `studentId` | 不是事件次數，也不是完成學習 |
| 能算進步的人數 | `growthSampleSize` | 有可平均前後測的學生數 | 樣本少時不把平均讀成效果 |
| 可觀察事件次數 | `skillExposure.byResource.events` | 事件 | 不是不重複學生，也不是學習效果 |
| 這份測驗多幾分 | `rawGrowthAverage` | 既有描述性平均 | 跨英檢不能直接互比 |

`0` 是有效的零，顯示 `0`。`null`、缺欄或無法轉成數字顯示 —。空的資源陣列顯示「尚無可用紀錄。不能推論沒有學習。」

頁面不把匿名軌跡寫成某一位學生的姓名。表格沒有學生姓名欄。個人軌跡仍留在既有的 `/admin/learning-analytics/students`，而且 Hub 不放學生層級資料。

選課、報名、出席與學習軌跡仍是不同來源。這次沒有把它們加成一個參與率。
