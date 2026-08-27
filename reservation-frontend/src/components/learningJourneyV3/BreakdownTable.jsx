import React from 'react';

export default function BreakdownTable({ loading, error, rows }) {
  if (loading) {
    return (
      <div className="alert alert-light d-flex align-items-center gap-2 mb-0">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>正在載入分項統計…</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger mb-0">分項統計載入失敗：{error}</div>;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="alert alert-secondary mb-0">目前沒有分項統計資料。</div>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>分類</th>
            <th>學生數</th>
            <th>聽力 B2+</th>
            <th>閱讀 B2+</th>
            <th>口說 B2+</th>
            <th>寫作 B2+</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td>{row.count}</td>
              <td>{`${row.skills?.listening?.count || 0} (${Number((row.skills?.listening?.rate || 0) * 100).toFixed(1)}%)`}</td>
              <td>{`${row.skills?.reading?.count || 0} (${Number((row.skills?.reading?.rate || 0) * 100).toFixed(1)}%)`}</td>
              <td>{`${row.skills?.speaking?.count || 0} (${Number((row.skills?.speaking?.rate || 0) * 100).toFixed(1)}%)`}</td>
              <td>{`${row.skills?.writing?.count || 0} (${Number((row.skills?.writing?.rate || 0) * 100).toFixed(1)}%)`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
