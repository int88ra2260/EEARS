# 既有契約

班級頁呼叫既有 `GET /api/admin/classes/:classId/bestep-overview`。匯出仍是 `GET /api/admin/classes/:classId/bestep-overview/export`。班級列表是 `GET /api/admin/classes/overview`。

| 領域 | 現有資料 | 這次怎麼用 |
|---|---|---|
| 報名 | `personalRegistration.status` | 成功報名才進匯出摘要的報名人數。未報名不是缺考 |
| 到考 | `attendance[L/R/S/W].attended` | `true` 出席、`false` 缺席、`null` 或沒有欄位是未確認。空物件是未匯入 |
| 四技能 | 成績列的 listening／reading／speaking／writing 分數與級別 | 沒有成績列是未匯入，不是未到考 |
| CEFR | 已儲存級別 | 照顯示。B2 不能還原成 B2+ |
| 通過 | `statistics.passRate`、`passedCount` | 分子是有成績且 `score.passed` 的人數。分母是匯出摘要的成功報名人數。母體不同，可超過 100。分母 0 時服務回 0 |
| 抵免 | `exemptionType` | 只出現在抵免欄，不寫進出席 |
| 成績 | `totalScore` 與技能分 | 0 是分數。`null`、沒有欄位、空字串是缺值 |
| 匯出 | `getAttendanceExportCell` | 未確認出席在已報考項目上寫空白。這次沒有改檔案格式 |
| 學期 | 班級頁 query `semester`，否則目前學期 | 不是各科考試日期 |

報考率與到考率卡片仍用 API 回傳的分子分母，前端不重算。
