# 07 方法與因果宣稱

方法等級：描述、群體比較、同一人縱向、統計關聯、因果。因果要求對照與可說明的假設。目前沒有已掛載的數字達到因果，也沒有一條 API 回傳 `causalClaimAllowed: true` 的路徑在本次讀到的 LVA 組裝裡。

## 名稱對照

| 表面用詞 | 程式實際做的事 | 等級 | 名稱是否超過證據 |
|---|---|---|---|
| Resource Effectiveness、`causal_effect` 欄 | LVA `estimatePolicy` 固定 `causalClaimAllowed: false`。描述型估計寫 `estimateType: descriptive`。進階方法（回歸、配對、IPW、AIPW）存在於同一 policy 物件的說明文字，是否在預設頁面執行：PARTIALLY_VERIFIED。欄位仍可被寫入表 | 預設是描述或統計調整，不是因果 | 欄名超過。資源頁文案寫不做排名。洞察頁文案寫「不用來宣稱參與造成進步」（`LearningAnalyticsInsightsPage.jsx` 99 行）。該頁路由已改導，文案還在檔案裡 |
| Adjusted Growth、校正後進步 | OLS 或簡化加權，共變項含起點能力與間隔。樣本限有前後測者 | 縱向＋統計調整 | 「校正後」容易讀成去掉了所有偏差。選擇誰來考第二次並未由隨機分派處理 |
| Growth Episodes | 可計算的成長段計數 | 描述 | 低風險，除非旁邊放效果量 |
| Skill Exposure | 考前窗時數 | 描述 | 低風險 |
| 學習有伴差距 | 有成績的有伴減非有伴。API `caveat` 寫明不保證參加就進步、未控制先備與自選 | 群體比較／關聯 | 名稱若只寫「成效」會超過；現有 caveat 沒有超過 |
| 課／師／活動頁 | 頁面有「非因果」字樣（`LearningAnalyticsOfferingsPage.jsx` 671 行） | 描述為主 | 頁內有限制句。是否每張圖都有：PARTIALLY_VERIFIED |
| 技能頁校正數 | 有調整後平均欄 | 統計調整 | 設定頁寫「只有在確認分析方法要更新時才調整」 |
| 歷史最佳「認證通過率」 | 最高 rank 的人數比 | 描述（截至今天的狀態） | overview API note 仍寫「歷史最佳技能 CEFR 達 B2+」。超過證據，而且 UI 目前多半看不到這段 |
| CAPS Growth | 腳本註解：分組 GSE 快照是 CAPS 遷移之後的欄位。沒有現行 `capsGrowth` 計算 | 不適用 | 舊名。不要當成還在估計的效果 |

## 六個檢查

1. 實際方法：見上表。沒有隨機分派，沒有工具變數。
2. 名稱：`causal_effect`、`isB2plus`、B2+ 註解、行政「通過率」多義，這四個超過或容易超過。
3. 前端：資源頁、課師頁、洞察頁、有伴 API 有限制句。KPI 頁講的是成對規則，不講因果。總覽不再把學期 KPI 放在第一屏（Phase 1 的 UI 變更，本次以篩選鍵不含學期為準）。限制句沒有覆蓋活動分析與班級通過率，那兩邊本來也不是因果句。
4. 選擇偏差：成長樣本只有考了兩梯的人。有伴是自己加入。考前時數高的人可能本來就較常參加。程式沒有把這些人對回「沒有第二梯」的人再估計差異，除了 LVA 那些預設關閉因果宣稱的方法。
5. 控制：校正成長控制起點 GSE、間隔、證據品質、CEFR 帶、技能（`learningAnalyticsMethodComparison.js` 的 covariates 清單）。不控制動機、科系要求、是否為補考。配對方法在 policy 說明裡，不代表預設報表已配對。
6. 樣本限制：缺第二梯就沒有 delta。缺等級在培力檔算未過。KPI 缺科不算過但人還在分母。這些規則不同，不能把「未改善人數」加總。

## `causalClaimAllowed` 用在哪

| 位置 | 行為 | 狀態 |
|---|---|---|
| `lvaAnalyticsService.estimatePolicy` | 回傳 false，並附方法說明 | VERIFIED 155–169 行 |
| `lvaPropensityService` | 多處物件帶 false | VERIFIED 搜尋命中 |
| `learningAnalyticsCohortServiceHelpers` | 參與比較物件帶 false | VERIFIED |
| `ResourceEffectEstimate` 與 `StudentResourceExposure` 欄位 | 預設 false，欄位仍在 | VERIFIED model |
| 測試 | 期望回應為 false | VERIFIED `learningJourneyAnalyticsApi.test.js` |
| 前端是否讀旗標才決定用詞 | 本次未逐頁搜 `causalClaimAllowed` 的畫面分支 | PARTIALLY_VERIFIED。至少資源頁與洞察頁用句子限制，不一定讀布林 |

旗標是 false 只能證明這支 API 沒有授權因果句。它不能證明資料庫沒有人把欄位改成 true，也不能證明別的頁面沒有用效果語氣。前者要查資料，後者要再搜前端文案。本次前端搜尋沒有看到「因此證明活動有效」這類句子；看到的是限制句。

## 應該多標、但還不要改計算的地方

- KPI 與歷史最佳的數字旁：時間窗與「不是這一場考試」。
- 班級通過率旁：四項等級、加號已摺疊、分母是註冊人數。
- 行政培力通過率旁：分母是出席、出席碼只認 LR／SW。
- 校正後成長旁：樣本是有兩梯的人，調整不是因果。

這些是標示缺口，不是新指標。
