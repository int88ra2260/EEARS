import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function GrowthMetricsExplainer({ className = '' }) {
  return (
    <LaFold label="實際進步與校正後進步差在哪？" className={className}>
      <p className="mb-1">
        <strong>實際進步</strong>
        ：後測減前測的平均。分數已先換成同一把能力尺，方便不同英檢互比。
      </p>
      <p className="mb-1">
        <strong>校正後進步</strong>
        ：再扣掉「本來程度較好／較差就可能不一樣」的部分，比較適合作群體比較。
      </p>
      <p className="mb-0">
        兩者都是觀察結果。進階參數在
        {' '}
        <Link to="/admin/learning-analytics/settings">模組設定</Link>
        。
      </p>
    </LaFold>
  );
}
