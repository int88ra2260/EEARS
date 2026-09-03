import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function GrowthMetricsExplainer({ className = '' }) {
  return (
    <LaFold label="實際進步與校正後進步差在哪？" className={className}>
      <p className="mb-1">
        <strong>GSE 實際進步</strong>
        ：後測減前測，且已換成同一把能力尺（GSE），才能跨不同英檢互比。不是各測驗的原始分數差。
      </p>
      <p className="mb-1">
        <strong>GSE 校正後進步</strong>
        ：再扣掉「本來程度較好／較差就可能不一樣」的部分，比較適合作群體比較。
      </p>
      <p className="mb-1 small text-muted">
        工具原始分進步（例如 TOEIC +35）與 GSE 量尺不同，不會畫在同一張圖上。
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
