import React from 'react';

const FORMULA_BLOCKS = [
  {
    title: '1. GSE 能力量尺與實際成長',
    lines: [
      'GSE = 依英檢成績或 CEFR 查表換算（Pearson GSE 對照）',
      '實際成長 actualGseGrowth = 後測 GSE − 前測 GSE',
      'monthsBetweenTests = (後測日 − 前測日) ÷ 30.4375（需 previousExamEventId）',
    ],
  },
  {
    title: '2. 修正成長 v2（OLS value-added，預設）',
    lines: [
      'ŷ = OLS 預測(actualGseGrowth | baselineGse, monthsBetweenTests, quality, CEFR band, skill)',
      'adjustedGseGrowth = actualGseGrowth − ŷ',
      '樣本 < 8 時回退舊版分組加權平均（見 adjustedGrowthLegacy）',
    ],
  },
  {
    title: '2b. 修正成長 Legacy（對照用）',
    lines: [
      'expectedGseGrowth = Σ(權重ᵢ × 該分組平均成長) ÷ Σ(權重ᵢ)',
      'adjustedGseGrowth = actualGseGrowth − expectedGseGrowth',
    ],
  },
  {
    title: '3. 傾向分數 v2（Logistic PS，預設）',
    lines: [
      'P(T=1|X) = logistic(β₀ + β₁X₁ + …)',
      'X 含 baselineGse、quality、resourceHours、monthsBetweenTests、skill、CEFR band',
      '樣本不足時回退啟發式 propensity-like score（見 legacy 欄位）',
    ],
  },
  {
    title: '4. 背景相近配對 v2',
    lines: [
      '距離 = |logit(P_處理) − logit(P_對照)|',
      'caliper = 0.2 × SD(logit PS)（Austin 2011）',
      '篩選區 matching_caliper 覆寫時改用 legacy 固定 caliper 路徑',
      '效應 ≈ 處理組 adjustedGseGrowth 平均 − 配對對照組平均',
    ],
  },
  {
    title: '5. IPW 與 AIPW（輔助估計）',
    lines: [
      'IPW v2：stabilized IPW on logistic PS',
      'AIPW v2：doubly robust = IPW 殘差修正 + outcome regression',
      '請與 matching 交叉比對；均非因果證明',
    ],
  },
  {
    title: '6. 資源技能曝光（與技能向量連動）',
    lines: [
      '某技能曝光 += 活動／課程時數 × 該資源在該技能的權重',
      '權重來自「資源技能向量」設定（0–1 相對面向，非因果係數）',
    ],
  },
];

export default function LvaFormulaReference() {
  return (
    <div className="la-lva-formulas mb-3">
      <div className="fw-semibold small mb-2">計算公式說明（v2 預設；legacy 供對照）</div>
      <p className="small text-muted mb-2">
        下列為目前 LVA 估計流程。調整參數會改變權重或門檻，但不改變「仍為觀察估計、不可單獨宣稱因果」的定位。
      </p>
      <div className="la-lva-formulas__grid">
        {FORMULA_BLOCKS.map((block) => (
          <div key={block.title} className="la-lva-formulas__block">
            <div className="la-lva-formulas__title">{block.title}</div>
            <pre className="la-lva-formulas__pre mb-0">{block.lines.join('\n')}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
