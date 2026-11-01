# 合成測試

檔案：`tests/analytics-contracts/bestepClassAnalytics.test.js`。

L01 契約可載入，引用的 Metric ID 都在既有 32 個裡，`PROPOSED:` 不在其中。L02 現行形狀沒有未知欄位。L03 多的鍵以路徑回報。L04 `pagination.page` 是 query context。L05–L08 學生、項目、名冊與四科 observation 的 analysis unit 不同，`examSittings` 是 null。L09–L12 true、false、null 分開，null 不產生缺考人數或新的率。L13–L14 只改率的數字時診斷相同。L15 不輸出 `B2+`。L16 報名 B2 旗標不是四科通過。L17 `passRate` 對到四科契約，並標明不是正式 KPI。L18–L19 檔案學期、出席日與成績來源日分開。L20–L21 來源不合併，兩種投影狀態並存。L22 平均分與到考率維持 proposed。L23 班級學期和查詢學期不同時發 `TEMPORAL_CONTRACT_GAP`。L24–L25 輸入不變。L26 契約與 validator 沒有 Sequelize，service 與 controller 沒有呼叫它。L27 診斷不含合成學號、姓名、email。L28 governance 為 false，7 domains、11 gates pending、2 個未實作指標。L29 壞形狀得到 partial 或 undetermined。L30 回應沒有被加上 diagnostics。

這些測試沒有讀正式班級資料，不能說明正式統計正確。
