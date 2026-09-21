import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function GrowthMetricsExplainer({ className = '' }) {
  return (
    <LaFold label="實際進步與高於/低於預期差在哪？" className={className}>
      <p className="mb-1">
        <strong>GSE 實際進步</strong>
        ：後測減前測，且已換成同一把能力尺（GSE），才能跨不同英檢互比。不是各測驗的原始分數差。
      </p>
      <p className="mb-1">
        <strong>高於/低於預期成長</strong>
        ：從實際 GSE 進步扣掉模型預期成長。接近 0 代表大致符合預期；正值代表高於預期，負值代表低於預期。
      </p>
      <p className="mb-1 small text-muted">
        工具原始分進步（例如 TOEIC +35）與 GSE 量尺不同，不會畫在同一張圖上。缺少可估資料時會留白，不會當作 0。
      </p>
      <p className="mb-0">
        兩者都是觀察結果。進階參數在
        {' '}
        <Link to="/admin/learning-analytics/settings">分析設定</Link>
        。
      </p>
    </LaFold>
  );
}
