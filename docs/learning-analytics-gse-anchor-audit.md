# GSE 英檢錨點合理性稽核

> 對照 `reservation-backend/services/learningAnalytics/gseMappingDefaults.js`（VERSION `2026-v1`）  
> 稽核日：2026-09-04  
> 目的：評估「同測進步是否被 GSE 吃掉」與「跨測比較是否仍可用」

## 結論（先看這段）

| 英檢 | 可信度標籤 | 同測敏感度 | 跨測可用性 | 建議 |
|------|------------|------------|------------|------|
| IELTS | official | 高（0.5 分一錨） | 高 | 維持 |
| TOEIC L&R | estimated | 中（CEFR 切點插值） | 中 | 可維持；高分區仍粗 |
| TOEIC S&W | estimated | 中 | 中 | 可維持 |
| TOEFL ITP | estimated | 中 | 中 | 可維持 |
| TOEFL iBT（legacy／2026） | estimated | 中高 | 中 | 可維持 |
| **BESTEP（培力）** | estimated | **中（CEFR 帶對齊後）** | 中（門檻對齊） | 已用 CEFR↔GSE 帶重設；同測仍建議對照原始分 |
| GEPT | estimated | **低**（等級中點） | 粗 | 等級變動才看得出；勿當小數進步 |
| Cambridge | estimated | **低**（等級中點） | 粗 | 同上 |

**產品原則（已落地 offerings.v4）：**  
同測主看原始分；GSE 當跨測驗量尺。同測原始明顯變、GSE≈0 → 標「換算解析度不足」，不解讀為沒進步。

另：目前分析重建的前後測配對**只在同一英檢內**（`buildInstrumentSessions`）。GSE 的價值是「不同學生／不同工具的成長數字可放在同一尺比較」，不是「同一人跨工具前後測已自動配對」。

---

## 各工具細節

### IELTS — 合理
- `score_anchors`，來源 Pearson concordance；四技能皆有 2.0–9.0 密錨。
- 同測半級進步通常會反映在 GSE。適合當跨測尺的「好例子」。

### TOEIC / TOEIC_SW / TOEFL_* — 大致可用、屬估計
- 多為 ETS CEFR cutoffs → GSE 插值（`confidence: estimated`）。
- 錨點密度中等；切點之間有線性插值，中低分區通常跟得上卷面變化。
- 風險：靠近 CEFR 帶邊界時，小幅卷面進步可能仍落在相近 GSE；屬估計誤差，可接受並在 UI 標「估計」。

### BESTEP — 已依 CEFR↔GSE 帶對齊重設（2026-09-04）
- 聽／讀門檻（校內）：70=B1、100=B2、130=C1；滿分 140 → C1 上界 GSE 84
- 說／寫門檻（校內）：280=B2、330=C1；滿分 360 → C1 上界 GSE 84（無官方 B1）
- 帶內：下一級門檻前一分對齊該 CEFR 的 GSE 上界（如 99→58、129→75），同測卷面進步可反映為 GSE 差
- 低於最低門檻：聽讀估 A1（0→22）、說寫估 A2（0→30），非校內正式切點
- 來源字串：`school_policy_bestep_cefr_to_gse_bands`；confidence 仍為 `estimated`

### GEPT / Cambridge — 等級尺，不適合看「小數進步」
- `level_midpoint`：同一級內分數／等第不變 → GSE 不變。
- 只適合觀察「是否升等」；不適合與 BESTEP 卷面小數進步並列解讀。

---

## 與 offerings 呈現的對齊

1. 主欄：**平均原始進步（主）**
2. 輔欄：**GSE 實際（輔）**／GSE 修正
3. 警示：極端值；GSE 鈍化（原始 |Δ|≥5 且 |GSE|≤0.5 或無法換算）
4. 進步定義文案：
   - 任一技能進步（原始分）
   - 有資料技能皆進步（非四科齊備）
   - 學生平均原始進步 > 0

---

## 下一步

1. 若英語中心另有培力說寫 B1 門檻或更細分數對照，再補入錨點。
2. 高分貼頂（聽讀 140／說寫 360）後卷面再進步，GSE 仍可能不動——屬量尺上界，繼續以原始分為準。
3. 若未來要做「跨英檢個人前後測」，需另開配對規則（目前資料管線不支援）。
