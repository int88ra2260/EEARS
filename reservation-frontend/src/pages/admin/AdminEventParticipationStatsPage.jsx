import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { safeAPICall } from '../../utils/errorHandler';
import { fetchParticipationCheckins } from '../../services/reportsAdminApi';

const SEMESTER_LABEL = {
  '113-2': '113-2',
  '114-1': '114-1',
  '114-2': '114-2',
  '115-1': '115-1',
  '115-2': '115-2',
  other: '其他／未分類學期',
};

function formatSemester(code) {
  return SEMESTER_LABEL[code] || code;
}

export default function AdminEventParticipationStatsPage() {
  const { token } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await safeAPICall(async () => fetchParticipationCheckins(token), () => {});
    if (result.success) {
      const data = result.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setGeneratedAt(data.generatedAt || '');
    } else {
      setRows([]);
      setError(result.error || '載入失敗');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="text-muted small">
            依活動日期歸屬學期；僅統計預約狀態為「已簽到」的紀錄。參與人數為不重複學號，人次為已簽到筆數（同一學生參加多場活動會計入多次）。
        </div>
        <Link to="/admin/operations" className="btn btn-outline-secondary btn-sm">
          返回活動列表
        </Link>
      </div>

      {loading && (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入統計中…</span>
        </div>
      )}

      {!loading && error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {generatedAt && (
              <div className="text-muted small px-3 pt-3">
                資料時間：{new Date(generatedAt).toLocaleString('zh-TW')}
              </div>
            )}
            {rows.length === 0 ? (
              <div className="p-4 text-muted">目前沒有已簽到資料可統計。</div>
            ) : (
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>學期</th>
                    <th>活動類型</th>
                    <th className="text-end">參與人數（不重複學號）</th>
                    <th className="text-end">簽到人次</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.semester}-${r.eventType}`}>
                      <td>{formatSemester(r.semester)}</td>
                      <td>{r.eventType}</td>
                      <td className="text-end">{r.uniqueParticipants}</td>
                      <td className="text-end">{r.checkinVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
