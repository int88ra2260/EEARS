import React from 'react';
import Table from 'react-bootstrap/Table';

const QUICK_ROWS = [
  ['修正成長', '分組加權平均', 'OLS 多元回歸（value-added）', '否'],
  ['前後測間隔', '未使用', '由 previousExamEventId 推算', '否'],
  ['傾向分數', '加權啟發式', 'Logistic 回歸', '否'],
  ['配對 caliper', '固定 0.35', 'Austin：0.2×SD(logit PS)', '否'],
  ['資源效應（配對）', '啟發式 PS', 'Logistic PS + Austin caliper', '否'],
  ['資源效應（IPW）', '啟發式 PS 加權', 'Logistic PS 加權', '否'],
  ['資源效應（AIPW）', '無', '新增 doubly robust', '否'],
];

export default function LvaMethodComparison({ methodComparison }) {
  const rows = methodComparison?.rows?.length
    ? methodComparison.rows.map((row) => [
      row.metric,
      row.legacy?.estimateType || row.legacy?.method || row.legacy?.value || row.legacy?.rule || '—',
      row.current?.estimateType || row.current?.method || row.current?.value || row.current?.rule || '—',
      row.causalClaimAllowed === false ? '否' : '—',
    ])
    : QUICK_ROWS;

  return (
    <div className="la-method-comparison mb-3">
      <div className="fw-semibold small mb-2">估計方法新舊對照（v2 為預設）</div>
      <p className="small text-muted mb-2">
        {methodComparison?.disclaimer
          || '所有估計均為觀察資料，causalClaimAllowed 一律為 false；請勿寫成「活動造成能力提升」。'}
      </p>
      <Table bordered responsive size="sm" className="mb-2 align-middle">
        <thead className="table-light">
          <tr>
            <th>項目</th>
            <th>舊版（Legacy）</th>
            <th>新版（v2）</th>
            <th>是否因果</th>
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
      <p className="small text-muted mb-0">
        完整說明見專案文件
        {' '}
        <code>docs/learning-analytics-method-comparison.md</code>
        ；API 亦回傳
        {' '}
        <code>methodComparison</code>
        、
        <code>adjustedGrowthLegacy</code>
        、
        <code>aipwEstimates</code>
        供程式對照。
      </p>
    </div>
  );
}
