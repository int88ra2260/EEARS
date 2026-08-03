EEARS 英語學習成效分析模組 PRD
1. 專案目標
目前 EEARS 英語學習歷程中心主要用於記錄學生在校內的英語學習歷程，例如：
修課紀錄
活動參與紀錄
英檢成績
英語能力認證狀態
學習歷程檔案
本次需求希望進一步將 EEARS 從「資料紀錄系統」升級為「英語學習成效分析系統」。
核心目標是讓中心能夠分析：
中心提供的課程與活動，是否有助於學生提升英語能力？
系統應協助管理者回答以下問題：
學生的英語能力是否進步？
哪些學生群體進步最多？
哪些課程或活動可能對能力提升最有幫助？
不同課程與活動分別對聽力、閱讀、口說、寫作有何影響？
中心資源應如何調整與優化？
分析結果是否能回溯到原始資料？

2. 功能定位
本模組名稱建議為：
EEARS 英語學習成效分析與增值評估模組
英文命名可使用：
EEARS Learning Effectiveness Analytics
或：
EEARS-LVA: English Learning Value-added Analytics
本模組不應只做單純統計，而應包含：
學生能力標準化
學生進步幅度分析
課程與活動效益分析
群體分析
技能分項分析
原始資料探索
資料可信度標示
後續可擴充的增值模型與準因果分析

3. 核心設計原則
3.1 可解釋
管理者必須能理解每個指標代表什麼，避免黑箱算法。
3.2 可追溯
所有分析結果都必須能回溯到原始資料，例如：
哪些學生被納入分析？
哪些測驗成績被使用？
哪些修課紀錄被計入？
哪些活動發生在考試前？
哪些活動因時間不符被排除？
3.3 可分階段落地
不要一開始就做最複雜的模型。應分階段完成：
資料整理與標準化
基礎儀表板
能力成長分析
課程與活動效益分析
進階模型與決策支援
3.4 避免過度因果宣稱
系統不應直接宣稱：
English Table 讓學生口說能力提升 25 分。
應改為：
在控制入學能力、測驗間隔與參與程度後，English Table 參與者的口說能力成長高於相似學生群體。此結果為觀察資料估計，仍可能受到未觀察因素影響。

4. 分析對象與資料來源
4.1 學生資料
系統應盡可能整合以下學生背景資料：
學號
姓名
系所
學院
年級
入學年度
入學管道
學生身分別
是否已有入學前英檢資料
是否具備英語能力認證通過紀錄
4.2 能力資料
學生英語能力來源可能包含：
TOEIC
GEPT
IELTS
TOEFL
Cambridge English
大學入學考英文成績
校內測驗
自評資料
無基準資料
系統必須保留原始成績，並建立標準化後的分析欄位。
4.3 修課資料
需納入中心相關課程，例如：
通識英文
EAP
ESP
初級課程
中級課程
中高級課程
高級課程
課程資料應包含：
課程名稱
課程類型
課程等級
學期
授課教師
修課學生
成績或通過狀態
出席狀況，若有資料
課程主要訓練技能
4.4 活動資料
需納入中心活動，例如：
English Table
English Club
Job Talk
International Forum
未來新增活動類型
活動資料應包含：
活動名稱
活動類型
活動日期
活動時數
活動等級，若有
活動主題
參與學生
出席狀況
問卷填答狀態
活動主要訓練技能

5. 能力標準化設計
目前前台或管理端可繼續使用 CEFR 作為主要顯示方式，例如：
Below A1
A1
A2
B1
B2
C1
C2
但系統內部分析不建議直接將 CEFR 當作等距分數。
建議建立內部分析分數：
CAPS = CEFR-aligned Proficiency Score
範例對應：
CEFR 顯示等級
內部分數 CAPS
Below A1
0
A1
100
A2
200
B1
350
B2
550
C1
750
C2
900

CAPS 應分技能記錄：
caps_listening
caps_reading
caps_speaking
caps_writing
caps_interaction
caps_mediation
caps_overall
其中 interaction 與 mediation 可作為未來擴充欄位，初期可先保留 schema。

6. 課程與活動能力向量
每個課程或活動都應建立「技能向量」，用來表示該資源主要訓練哪些能力。
6.1 技能向量欄位
每個資源至少包含：
Listening weight
Reading weight
Speaking weight
Writing weight
Interaction weight
Mediation weight
EAP weight
ESP weight
6.2 範例
資源
Listening
Reading
Speaking
Writing
Interaction
EAP
ESP
通識英文
0.25
0.35
0.15
0.25
0.10
0.05
0.05
EAP Writing
0.10
0.30
0.05
0.50
0.05
0.30
0.05
ESP Course
0.20
0.20
0.20
0.20
0.20
0.10
0.50
English Table
0.25
0.05
0.45
0.00
0.45
0.05
0.05
English Club
0.25
0.15
0.35
0.10
0.35
0.10
0.10
Job Talk
0.25
0.15
0.30
0.10
0.30
0.10
0.50
International Forum
0.40
0.20
0.25
0.10
0.30
0.30
0.30


7. 核心分析邏輯
7.1 學生成長區間
學生若有前後兩筆能力資料，系統應建立 growth episode。
Growth = Post-test CAPS - Pre-test CAPS
每個技能分開計算：
growth_listening = post_caps_listening - pre_caps_listening
growth_reading = post_caps_reading - pre_caps_reading
growth_speaking = post_caps_speaking - pre_caps_speaking
growth_writing = post_caps_writing - pre_caps_writing
growth_overall = post_caps_overall - pre_caps_overall
7.2 時間修正
只有發生在前測與後測之間的課程或活動，才能納入該次成長區間的主要分析。
規則：
if resource_date < pre_test_date:
    mark as prior exposure

if pre_test_date <= resource_date <= post_test_date:
    include as valid exposure

if resource_date > post_test_date:
    exclude from this growth episode
7.3 參與程度修正
資源曝光量應考量：
參與次數
參與時數
出席狀況
完成狀態
距離後測時間
活動或課程技能權重
建議概念公式：
Effective Exposure =
Participation Count
× Duration
× Attendance Quality
× Skill Weight
× Time Decay Weight
7.4 資料可信度
每個分析結果應標示資料可信度：
資料狀況
可信度
有前測、後測、完整參與紀錄
高
有前後測，但參與資料不完整
中
只有後測，沒有前測
低
只有入學考成績
中低
完全沒有基準資料
低
活動時間晚於測驗時間
不可計入該次成效


8. 主要指標設計
8.1 Student Skill Growth Score
學生技能成長指標。
欄位：
ssgs_listening
ssgs_reading
ssgs_speaking
ssgs_writing
ssgs_overall
8.2 Center Resource Exposure
中心資源曝光量。
欄位：
cre_ge
cre_eap
cre_esp
cre_english_table
cre_english_club
cre_job_talk
cre_international_forum
8.3 Skill Alignment Index
能力對齊度。
用來判斷學生參與的資源是否對應其弱項能力。
例如：
學生 Speaking 較弱，但參加 English Table 與 English Club，則 alignment 較高。
學生 Writing 較弱，但只參加口說活動，則 alignment 較低。
8.4 Level Fit Index
難度適配度。
用來判斷課程或活動等級是否符合學生目前能力。
例如：
學生能力
資源等級
判定
A2
初級
適配
A2
高級
過難
B2
初級
過易
B1
中級
適配

8.5 Resource Value-added Score
資源增值分數。
用來評估課程或活動與學生能力進步之間的關聯。
注意：初期不做因果宣稱，只顯示「關聯」與「修正後趨勢」。

9. 後台頁面規劃
9.1 中心成效總覽 Dashboard
目的：讓主管快速了解整體成效。
應包含：
納入分析學生數
有完整前後測資料學生數
平均能力成長
認證通過率變化
聽說讀寫分項成長
各資源參與量
效益較明顯的課程與活動
資料可信度分布
建議圖表：
CEFR 前後分布圖
聽說讀寫成長雷達圖
認證通過率趨勢圖
資源參與量長條圖
資源效益排名圖

9.2 學生群體分析 Cohort Analytics
目的：分析不同群體學生的進步差異。
篩選條件：
學期
學年
年級
學院
系所
入學年度
入學管道
初始 CEFR
目前 CEFR
是否通過認證
是否修課
是否參加活動
課程類型
活動類型
資料可信度
建議圖表：
群體進步幅度 boxplot
不同 CEFR 起點的成長曲線
系所資源使用率與通過率比較
參與組與未參與組比較

9.3 課程與活動效益分析 Resource Effectiveness
目的：分析各類資源的可能效益。
每個資源顯示：
參與人數
平均參與次數
平均參與時數
主要影響技能
原始成長幅度
修正後成長幅度
資料可信度
最適合的學生群體
邊際效益是否遞減
篩選條件：
資源類型
活動類型
課程等級
學期
教師
學生起始能力
技能面向
資料可信度

9.4 技能成長分析 Skill Growth
目的：分技能分析學生能力變化。
技能維度：
Listening
Reading
Speaking
Writing
Interaction
Mediation
Overall
每個技能應顯示：
平均成長
成長學生比例
退步學生比例
無明顯變化比例
相關課程與活動
弱項學生分布
資源錯配情形

9.5 學生個別學習軌跡 Student Journey
目的：查看單一學生完整學習歷程。
應包含時間線：
入學能力
英檢成績
修課紀錄
活動參與紀錄
出席紀錄
問卷填答
認證通過狀態
系統應能標示：
哪些資源發生在測驗前
哪些資源發生在測驗後
哪些資源被納入分析
哪些資料不足以判斷

9.6 原始資料探索 Raw Data Explorer
目的：讓分析結果可以回溯原始資料。
功能：
原始測驗資料表
原始修課資料表
原始活動參與資料表
原始出席資料表
原始問卷資料表
學生 timeline plot
CEFR flow / Sankey diagram
參與量 vs 成長 scatter plot
資源類型 × 技能成長 heatmap
匯出目前篩選資料
顯示資料缺漏原因
顯示排除樣本原因

10. 建議資料表設計
10.1 student_proficiency_snapshots
用途：記錄學生每一次能力狀態。
CREATE TABLE student_proficiency_snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_name VARCHAR(100),
  test_date DATE,
  cefr_overall VARCHAR(20),
  cefr_listening VARCHAR(20),
  cefr_reading VARCHAR(20),
  cefr_speaking VARCHAR(20),
  cefr_writing VARCHAR(20),
  caps_overall DECIMAL(8,2),
  caps_listening DECIMAL(8,2),
  caps_reading DECIMAL(8,2),
  caps_speaking DECIMAL(8,2),
  caps_writing DECIMAL(8,2),
  caps_interaction DECIMAL(8,2),
  caps_mediation DECIMAL(8,2),
  raw_score_payload JSON,
  confidence_level VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

10.2 resource_skill_profiles
用途：記錄每個課程或活動的技能向量。
CREATE TABLE resource_skill_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT NOT NULL,
  level VARCHAR(50),
  category VARCHAR(50),
  weight_listening DECIMAL(5,4) DEFAULT 0,
  weight_reading DECIMAL(5,4) DEFAULT 0,
  weight_speaking DECIMAL(5,4) DEFAULT 0,
  weight_writing DECIMAL(5,4) DEFAULT 0,
  weight_interaction DECIMAL(5,4) DEFAULT 0,
  weight_mediation DECIMAL(5,4) DEFAULT 0,
  weight_eap DECIMAL(5,4) DEFAULT 0,
  weight_esp DECIMAL(5,4) DEFAULT 0,
  expected_cefr_min VARCHAR(20),
  expected_cefr_max VARCHAR(20),
  created_by BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

10.3 student_resource_exposures
用途：將學生修課與活動參與轉換成分析用 exposure。
CREATE TABLE student_resource_exposures (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT NOT NULL,
  participation_date DATE NOT NULL,
  duration_minutes INT,
  attendance_status VARCHAR(50),
  attendance_quality DECIMAL(5,4),
  exposure_listening DECIMAL(10,4) DEFAULT 0,
  exposure_reading DECIMAL(10,4) DEFAULT 0,
  exposure_speaking DECIMAL(10,4) DEFAULT 0,
  exposure_writing DECIMAL(10,4) DEFAULT 0,
  exposure_interaction DECIMAL(10,4) DEFAULT 0,
  exposure_mediation DECIMAL(10,4) DEFAULT 0,
  time_decay_weight DECIMAL(5,4),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

10.4 learning_growth_episodes
用途：記錄學生前後測形成的成長區間。
CREATE TABLE learning_growth_episodes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  pre_snapshot_id BIGINT NOT NULL,
  post_snapshot_id BIGINT NOT NULL,
  start_date DATE,
  end_date DATE,
  months_between DECIMAL(6,2),
  growth_listening DECIMAL(8,2),
  growth_reading DECIMAL(8,2),
  growth_speaking DECIMAL(8,2),
  growth_writing DECIMAL(8,2),
  growth_interaction DECIMAL(8,2),
  growth_mediation DECIMAL(8,2),
  growth_overall DECIMAL(8,2),
  evidence_quality_score DECIMAL(5,4),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

10.5 resource_effect_estimates
用途：保存課程與活動效益估計結果。
CREATE TABLE resource_effect_estimates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_run_id BIGINT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT,
  skill VARCHAR(50) NOT NULL,
  raw_effect DECIMAL(10,4),
  adjusted_effect DECIMAL(10,4),
  causal_effect DECIMAL(10,4),
  confidence_interval_low DECIMAL(10,4),
  confidence_interval_high DECIMAL(10,4),
  sample_size INT,
  evidence_quality VARCHAR(20),
  model_version VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

10.6 analytics_model_runs
用途：保存每次模型執行紀錄，方便稽核與追蹤。
CREATE TABLE analytics_model_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  semester VARCHAR(20),
  filters_payload JSON,
  included_students_count INT,
  excluded_students_count INT,
  missing_data_summary JSON,
  started_at DATETIME,
  finished_at DATETIME,
  created_by BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

11. API 規劃建議
請依照目前 EEARS 後端架構新增 service/router/controller。
11.1 Dashboard API
GET /api/admin/learning-analytics/overview
功能：
取得中心成效總覽資料
支援學期、學年、系所、年級等篩選

11.2 Cohort Analytics API
GET /api/admin/learning-analytics/cohorts
功能：
取得不同學生群體的成長分析
支援多條件篩選

11.3 Resource Effectiveness API
GET /api/admin/learning-analytics/resources
功能：
取得課程與活動效益分析
支援依資源類型、技能、學期篩選

11.4 Skill Growth API
GET /api/admin/learning-analytics/skills
功能：
取得聽說讀寫分項成長分析

11.5 Student Journey API
GET /api/admin/learning-analytics/students/:studentId/journey
功能：
取得單一學生學習軌跡

11.6 Raw Data Explorer API
GET /api/admin/learning-analytics/raw-data
功能：
查詢原始資料
支援分頁、排序、篩選

11.7 Export API
GET /api/admin/learning-analytics/export
功能：
匯出目前篩選後資料
格式可支援 XLSX / CSV

12. 權限設計
請依照現有 EEARS 權限機制新增權限常數。
建議新增：
CAN_VIEW_LEARNING_ANALYTICS
CAN_EXPORT_LEARNING_ANALYTICS
CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS
CAN_RUN_LEARNING_ANALYTICS_MODEL
權限建議：
角色
查看分析
匯出資料
管理設定
執行模型
admin
是
是
是
是
executive teacher
是
視政策
否
否
et_manager
可限制範圍
否
否
否
office_staff
可限制範圍
視政策
否
否

需注意：
涉及學生個資與成績資料，預設應採較嚴格權限。
匯出功能必須有 audit log。
若資料包含敏感欄位，需支援遮罩或最小揭露。

13. 前端頁面規劃
建議新增管理端路由：
/admin/learning-analytics
/admin/learning-analytics/overview
/admin/learning-analytics/cohorts
/admin/learning-analytics/resources
/admin/learning-analytics/skills
/admin/learning-analytics/students
/admin/learning-analytics/raw-data
/admin/learning-analytics/settings
13.1 頁面元件建議
LearningAnalyticsOverviewPage.jsx
LearningAnalyticsCohortsPage.jsx
LearningAnalyticsResourcesPage.jsx
LearningAnalyticsSkillsPage.jsx
LearningAnalyticsStudentJourneyPage.jsx
LearningAnalyticsRawDataPage.jsx
LearningAnalyticsSettingsPage.jsx
13.2 共用元件建議
LearningAnalyticsFilters.jsx
MetricCard.jsx
EvidenceQualityBadge.jsx
SkillGrowthChart.jsx
CefrDistributionChart.jsx
ResourceEffectivenessTable.jsx
StudentTimeline.jsx
RawDataExplorerTable.jsx
AnalyticsExportButton.jsx
13.3 前端 service 建議
reservation-frontend/src/services/learningAnalyticsService.js
應集中管理 API 呼叫，避免在頁面內直接 inline fetch。

14. UI/UX 原則
14.1 主管總覽要簡單
Overview 頁面應以卡片與圖表為主，不要一開始顯示過多統計術語。
14.2 進階分析要可展開
較複雜的模型資訊，例如修正後成長、信賴區間、資料可信度，可放在進階區塊。
14.3 每個數據都要有說明
例如滑鼠 hover 或 info tooltip：
修正後成長：控制學生起始能力、測驗間隔與參與程度後的估計成長。
14.4 避免誤導性文字
不要使用：
此活動造成學生進步
改用：
此活動與學生進步呈現正相關
或：
此活動在修正後模型中顯示較高的增值估計

15. 分階段實作建議
Phase 1：資料盤點與標準化
目標：
建立能力快照資料表
建立資源技能向量資料表
建立學生資源曝光資料表
整理現有英檢、修課、活動、出席資料來源
產生資料缺漏報告
交付項目：
migration
seed data
data normalization service
basic admin raw data endpoint

Phase 2：基礎 Dashboard
目標：
建立中心總覽頁
顯示 CEFR 分布
顯示認證通過率
顯示修課與活動參與統計
顯示初步學生群體成長資料
交付項目：
overview API
overview frontend page
chart components
basic filters

Phase 3：技能成長分析
目標：
建立 growth episode
計算聽力、閱讀、口說、寫作分項成長
加入時間窗判斷
加入資料可信度標示
交付項目：
growth episode service
skill growth API
skill growth frontend page
evidence quality badge

Phase 4：課程與活動效益分析
目標：
建立 resource effectiveness 頁面
顯示不同資源與技能成長的關聯
加入參與次數、時數、出席、時間等修正
顯示資料可信度與樣本數
交付項目：
resource effectiveness API
resource effectiveness table
filters
export

Phase 5：進階模型與決策支援
目標：
加入相似學生群體比較
加入基線修正
加入 value-added estimate
加入通過認證機率預測
加入學生個別化資源建議
交付項目：
model run framework
model result tables
admin model run page
student recommendation prototype

16. Cursor 實作任務建議
請 Cursor 先完成 Phase 1，不要一次實作全部功能。
First Task
請先盤點目前 EEARS 專案中與英語學習歷程、英檢成績、課程、活動、出席、問卷、學生基本資料相關的資料表、API、service、frontend page。

請輸出：
1. 現有資料來源清單
2. 可直接用於 learning analytics 的欄位
3. 缺少但需要新增的欄位
4. 建議新增 migration
5. 建議新增 backend service
6. 建議新增 frontend routes/components
7. 不要直接修改程式碼，先產出 implementation plan
Second Task
根據 implementation plan，先實作 Phase 1 的資料結構與 service skeleton。

範圍：
1. 新增 learning analytics 相關 migrations
2. 新增 backend service skeleton
3. 新增 admin router skeleton
4. 新增權限常數
5. 新增最基本測試
6. 不實作複雜模型，只保留 placeholder
7. 不影響現有學生端流程
8. 不改動既有英語能力認證流程
Third Task
實作 Phase 2 的管理端基礎 Dashboard。

範圍：
1. 新增 /admin/learning-analytics/overview 路由
2. 新增 Overview 頁面
3. 新增 learningAnalyticsService.js
4. 新增基礎篩選器
5. 顯示統計卡片與簡單圖表
6. API 沒資料時顯示 empty state
7. 必須遵守現有 AdminLayout、權限、toast、loading、error handling 慣例

17. 驗收標準
Phase 1 驗收
migration 可正常執行
不破壞既有資料表
新資料表命名清楚
權限常數已加入
backend service 有基本測試
raw data endpoint 可回傳 mock 或初步整理資料
無未授權角色可存取分析 API
Phase 2 驗收
管理端可看到 learning analytics 入口
有 Overview 頁面
可依學期、系所、年級篩選
可顯示學生數、認證通過率、CEFR 分布、活動參與統計
loading / empty / error state 完整
無資料時不 crash
匯出功能若尚未完成，需顯示 disabled 或 coming soon
Phase 3 驗收
可建立學生前後測 growth episode
可分技能顯示成長
考試後活動不被計入該次成長
資料可信度有明確標示
可追溯原始資料

18. 重要限制
初期不得宣稱因果關係。
不得覆蓋原始英檢成績。
不得只保存轉換後分數，必須保留 raw payload。
涉及學生成績與個資的匯出必須有權限控管。
分析模組不得影響現有預約、活動、英檢認證、問卷流程。
所有新增 API 必須遵守 EEARS 現有權限與 audit log 設計。
前端不得大量 inline fetch，需建立 service layer。
大型頁面需拆分 component / hook，避免新增 monolith。

19. 最終目標
完成後，EEARS 應能從單純記錄學生學習歷程，進一步提供中心以下能力：
掌握學生英語能力變化
了解不同學生群體的進步情形
分析中心課程與活動的可能效益
找出資源配置不足或過度集中的地方
支援成果報告與行政決策
支援未來個別化學習建議
本模組的核心價值是：
讓 EEARS 從「學習紀錄平台」升級為「英語學習成效分析與決策支援平台」。
