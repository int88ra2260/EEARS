import React from 'react';
import Table from 'react-bootstrap/Table';

const QUICK_ROWS = [
  ['校正後進步', '分組平均扣預期', '回歸校正（目前預設）', '否'],
  ['前後測間隔', '未使用', '由兩次考試日期推算', '否'],
  ['誰比較可能參加', '簡單加權', '統計模型估計', '否'],
  ['對照要多接近', '固定寬鬆度', '依資料自動調整', '否'],
  ['資源效果（背景相近比較）', '簡單加權配對', '統計模型配對', '否'],
  ['資源效果（依背景加權）', '簡單加權', '統計模型加權', '否'],
  ['資源效果（綜合校正）', '無', '同時校正參加與進步', '否'],
];

function cellText(row, side) {
  return row[side]?.plainLabel
    || row[side]?.estimateType
    || row[side]?.method
    || row[side]?.value
    || row[side]?.rule
    || '—';
}

export default function LvaMethodComparison({ methodComparison }) {
  const rows = methodComparison?.rows?.length
    ? methodComparison.rows.map((row) => [
      row.plainMetric || row.metric,
      cellText(row, 'legacy'),
      cellText(row, 'current'),
      row.causalClaimAllowed === false ? '否' : '—',
    ])
    : QUICK_ROWS;

  return (
    <div className="la-method-comparison mb-0">
      <p className="small text-muted mb-2">
        {methodComparison?.disclaimer
          || '目前預設用右側算法。所有數字都是觀察結果，請勿寫成「活動造成能力提升」。'}
      </p>
      <Table bordered responsive size="sm" className="mb-0 align-middle">
        <thead className="table-light">
          <tr>
            <th>項目</th>
            <th>舊算法</th>
            <th>目前算法</th>
            <th>是否保證有效</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([metric, legacy, current, causal]) => (
            <tr key={metric}>
              <td className="fw-medium">{metric}</td>
              <td>{legacy}</td>
              <td>{current}</td>
              <td>{causal}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
