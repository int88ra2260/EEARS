# 學習成效分析（LVA）估計方法新舊對照表

> 本文件供非統計背景的管理者與開發者參考。  
> **重要：無論舊版或新版，`causalClaimAllowed` 一律為 `false`，不可宣稱因果。**

## 快速對照

| 項目 | 舊版（Legacy） | 新版（v2，目前預設） | 是否因果 |
|------|----------------|---------------------|----------|
| 修正成長 | 分組加權平均 | OLS 多元回歸（value-added） | 否 |
| 前後測間隔 | 未使用（null） | 由 `previousExamEventId` 推算 | 否 |
| 傾向分數 | 加權啟發式 | Logistic 回歸 | 否 |
| 配對 caliper | 固定 0.35 | Austin：0.2×SD(logit PS) | 否 |
| 資源效應（配對） | 啟發式 PS 配對 | Logistic PS + Austin caliper | 否 |
| 資源效應（IPW） | 啟發式 PS 加權 | Logistic PS 加權 | 否 |
| 資源效應（AIPW） | 無 | 新增 doubly robust | 否 |

## API 欄位對應

| 用途 | 新版（預設） | 舊版（對照） |
|------|-------------|-------------|
| 修正成長 | `adjustedGrowth` | `adjustedGrowthLegacy` |
| 背景相近配對 | `quasiCausalEstimates` | `quasiCausalEstimatesLegacy` |
| IPW 加權 | `propensityWeightedEstimates` | `propensityWeightedEstimatesLegacy` |
| AIPW | `aipwEstimates` | — |
| 對照表 metadata | `methodComparison` | — |

## 1. 修正成長（Adjusted Growth）

### 舊版：`baseline_adjusted_simplified`

```
actualGseGrowth = 後測 GSE − 前測 GSE
expectedGseGrowth = Σ(權重ᵢ × 該分組平均成長) ÷ Σ(權重ᵢ)
adjustedGseGrowth = actualGseGrowth − expectedGseGrowth
```

分組包含：全體、同技能、技能+起點等級、技能+系所、技能+資料品質。

### 新版：`baseline_adjusted_regression_v2`

```
adjustedGseGrowth = actualGseGrowth − ŷ
ŷ = OLS 預測值，共變量含：
  - baselineGse（基線 GSE）
  - monthsBetweenTests（前後測間隔，月）
  - evidenceQuality（資料品質分數）
  - initialCefrBand（起點 CEFR，序數編碼）
  - skill（技能 one-hot）
```

**差異**：新版可同時控制多個因素；舊版是「找相似分組的平均」。

**樣本不足**：episode 少於 8 筆時，新版會回退舊版邏輯並標記 `fallbackReason`。

## 2. 前後測間隔（monthsBetweenTests）

- **舊版**：固定為 `null`。
- **新版**：若 exam 有 `previousExamEventId`，查前次 `examDate`，計算  
  `monthsBetweenTests = (後測日 − 前測日) / 30.4375`（四捨五入至小數 2 位）。
- **annualizedGseGrowth**（年化成長）= `actualGseGrowth / monthsBetweenTests × 12`（僅當間隔 > 0）。

## 3. 傾向分數（Propensity Score）

### 舊版：propensity-like score

```
P ≈ w基線 × clamp(GSE/90) + w品質 × qualityScore + w資源 × clamp(hours/cap)
```

### 新版：logistic propensity

```
P(T=1|X) = 1 / (1 + exp(−(β₀ + β₁X₁ + …)))
```

共變量 X 含：baselineGse、quality、resourceHours、monthsBetweenTests、skill、CEFR band。

**樣本不足**：treated 或 control 各少於 3 人，或總樣本 < 12 時，回退舊版。

## 4. 配對 Caliper

| | 舊版 | 新版 |
|---|------|------|
| 距離 | 啟發式 PS 差 + 共變量懲罰 | \|logit(P_處理) − logit(P_對照)\| |
| 門檻 | 固定（預設 0.35，可於設定頁調整） | 0.2 × SD(logit PS)（Austin 2011） |

## 5. 資源效應估計

### 5a. 背景相近配對（Matching）

- **舊版** `propensity_matched_observational`
- **新版** `propensity_matched_logistic_v2`
- 估計式：處理組 `adjustedGseGrowth` 平均 − 配對對照組平均

### 5b. 逆機率加權（IPW）

- **舊版** `propensity_weighted_observational`
- **新版** `propensity_weighted_logistic_v2`
- 使用 stabilized IPW；propensity 限制在 0.05–0.95

### 5c. 增強 IPW（AIPW，新增）

- **estimateType**：`aipw_doubly_robust_v2`
- 結合 outcome regression 與 IPW，屬 doubly robust 輔助估計
- 請與 matching、IPW **三者交叉比對**，不可單獨宣稱效應

## 6. 如何解讀儀表板

1. **優先看** `adjustedGrowth`（v2 修正成長）了解整體趨勢。
2. **資源頁** 同時有 matching、IPW、AIPW；儀表板僅顯示樣本人數 ≥ **10** 的列（與細項分析隱私門檻對齊）。方向一致較可信，仍只是觀察估計。
3. **比對 legacy 欄位** 若差異大，可能是樣本小或 logistic 回退；查看 `limitations` 與 `monthsBetweenTestsCoverage`。
4. **永遠加上免責**：「觀察資料估計，非隨機對照試驗」。

### 樣本門檻對照（避免混淆）

| 門檻 | 用途 | 典型值 |
|------|------|--------|
| UI 顯示／遮蔽 | 細項分析平均值、資源頁進階估計列 | **10**（`MIN_GROWTH_SAMPLE`／`LA_MIN_DISPLAY_SAMPLE`） |
| `evidenceLevel: medium` | 描述／配對／AIPW 資料完整度標籤 | 約 **30**（或部分路徑 50） |
| 後端算法回退 | OLS／logistic 不穩時退回 legacy | 見各節「樣本不足」 |

「資料標籤 medium」≠「已通過 UI 顯示門檻」；小樣本仍可能出現 `low` 標籤的數字，解讀時應降權。

## 7. 參考文獻（簡要）

| 方法 | 參考 |
|------|------|
| Propensity score | Rosenbaum & Rubin (1983) |
| Austin caliper | Austin (2011), Multivariate Behavioral Research |
| AIPW / doubly robust | Bang & Robins (2005); Lunceford & Davidian (2004) |
| Value-added models | Kline (2011) 等教育計量文獻 |
| GSE 量尺 | Pearson Global Scale of English（對齊 CEFR） |

## 8. 程式位置

| 模組 | 路徑 |
|------|------|
| 主 API | `reservation-backend/services/learningJourney/analytics/lvaAnalyticsService.js` |
| 修正成長 v2 | `reservation-backend/services/learningJourney/analytics/lvaAdjustedGrowthService.js` |
| 傾向分數 / 配對 / AIPW | `reservation-backend/services/learningJourney/analytics/lvaPropensityService.js` |
| 對照表資料 | `reservation-backend/services/learningAnalytics/learningAnalyticsMethodComparison.js` |
