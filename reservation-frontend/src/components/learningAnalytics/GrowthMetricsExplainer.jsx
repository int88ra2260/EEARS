import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function GrowthMetricsExplainer({ className = '' }) {
  return (
    <LaFold label="這幾個數字分別在比什麼？" className={className}>
      <p className="mb-1">
        <strong>平均和中間的人</strong>
        ：都是這一科、前測落在同一區間的人，後來的 GSE 成長。平均容易被少數人拉走，要下結論先看正中間的人。
      </p>
      <p className="mb-1">
        <strong>跟同樣起點比</strong>
        ：這個人在同一科、同一前測區間裡，進步多過百分之多少的人。比過愈多人，代表在起點相近的人裡面愈快。不到 5 人不排名。
      </p>
      <p className="mb-1">
        <strong>比預期多多少</strong>
        ：這一科換成同一把尺之後的成長，減去「入學程度相近、兩次測驗間隔也相近的人通常會進步多少」。正數代表比他們多。這是探索性估計，不是因果證明。扣的是入學時的整體英文程度和測驗間隔，不是把入學分數直接減掉，也不是跟這一科的前測比。不同英檢的 CEFR 不能當成完全可交換。
      </p>
      <p className="mb-1 small text-muted">
        原始分進步（例如 TOEIC +35）和 GSE 不是同一把尺。缺少資料時留白，不會當成 0。
        原始分 0 或 1 不計入前後測；缺考常被記成 0，換成 GSE 後會變成很大的假退步。
      </p>
      <p className="mb-0">
        這些都是觀察，不代表課程造成進步。進階參數在
        {' '}
        <Link to="/admin/learning-analytics/settings">分析設定</Link>
        。
      </p>
    </LaFold>
  );
}
