import React, { useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Button from 'react-bootstrap/Button';

import Collapse from 'react-bootstrap/Collapse';

import { Link } from 'react-router-dom';



const METRICS = [

  {

    id: 'raw',

    title: '平均成長（實際成長）',

    summary: '後測 GSE − 前測 GSE，在群體上取平均。',

    detail: [

      'GSE（Global Scale of English）先把各類英檢成績換算成可比的能力量尺分數，方便跨測驗比較。',

      '「平均成長」= 每位可計算前後測學生的 actualGseGrowth 算術平均。',

      '此數字反映「有沒有進步」，但未扣除「本來就會自然成長」的部分，也不代表某一課程的直接成效。',

    ],

  },

  {

    id: 'adjusted',

    title: '修正成長（校正後成長）',

    summary: '在平均成長基礎上，扣除依背景分組估計的「預期成長」。',

    detail: [

      '預期成長 expectedGseGrowth = Σ(權重ᵢ × 該分組平均成長) ÷ Σ(權重ᵢ)。',

      '分組可能含：全體平均、同技能、技能＋起點等級、技能＋系所、技能＋資料品質（有資料的組才納入）。',

      '修正成長 adjustedGseGrowth = actualGseGrowth − expectedGseGrowth。',

      '用於群體間較公平比較；仍為觀察估計，不能單獨宣稱因果。',

    ],

  },

];



/**

 * @param {{ compact?: boolean, className?: string }} props

 */

export default function GrowthMetricsExplainer({ compact = false, className = '' }) {

  const [open, setOpen] = useState(!compact);



  return (

    <Alert variant="light" className={`la-growth-explainer border mb-3 ${className}`.trim()}>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">

        <div>

          <div className="fw-semibold small">平均成長與修正成長怎麼算？</div>

          {!compact ? (

            <p className="small text-muted mb-0 mt-1">

              兩者皆以 GSE 能力量尺衡量進步幅度；修正成長會扣除「預期也會成長」的部分，較適合跨群體比較。

            </p>

          ) : null}

        </div>

        {compact ? (

          <Button

            variant="outline-secondary"

            size="sm"

            onClick={() => setOpen((v) => !v)}

            aria-expanded={open}

          >

            {open ? '收合說明' : '查看計算方式'}

          </Button>

        ) : null}

      </div>

      <Collapse in={open}>

        <div className="mt-3">

          {METRICS.map((metric) => (

            <div key={metric.id} className="mb-3">

              <div className="fw-semibold small">{metric.title}</div>

              <p className="small text-muted mb-1">{metric.summary}</p>

              <ul className="small text-muted mb-0 ps-3">

                {metric.detail.map((line) => (

                  <li key={line}>{line}</li>

                ))}

              </ul>

            </div>

          ))}

          <p className="small text-muted mb-0">

            進階參數與完整公式請至

            {' '}

            <Link to="/admin/learning-analytics/settings">學習成效分析設定</Link>

            。

          </p>

        </div>

      </Collapse>

    </Alert>

  );

}

