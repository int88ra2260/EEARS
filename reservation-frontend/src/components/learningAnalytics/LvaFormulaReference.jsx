import React from 'react';

const FORMULA_BLOCKS = [
  {
    title: '1. 能力分數與實際進步',
    lines: [
      '不同英檢先換成同一把能力尺，才能互相比較。',
      '實際進步 = 後測分數 − 前測分數',
      '間隔月數由兩次考試日期推算',
    ],
  },
  {
    title: '2. 校正後進步（目前預設）',
    lines: [
      '用回歸估計「以這位學生的背景，預期會進步多少」',
      '校正後進步 = 實際進步 − 預期進步',
      '樣本太少時改用舊版分組平均',
    ],
  },
  {
    title: '3. 背景相近學生比較',
    lines: [
      '找程度、系所相近但沒參加的學生當對照',
      '對照要多接近，可由系統依資料自動調整',
      '效果 ≈ 有參加者的校正後進步 − 對照組',
    ],
  },
  {
    title: '4. 依背景加權、綜合校正',
    lines: [
      '依背景加權：依「誰比較可能參加」調整權重後再比進步',
      '綜合校正：同時校正「誰會參加」與「預期會進步多少」',
      '三種算法方向一致時較可信；都不是保證參加就進步',
    ],
  },
];

export default function LvaFormulaReference() {
  return (
    <div className="la-lva-formulas mb-3">
      <div className="fw-semibold small mb-2">計算方式（給需要對照的人）</div>
      <p className="small text-muted mb-2">
        改參數會改變門檻或權重，但不會變成「保證有效」。
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
