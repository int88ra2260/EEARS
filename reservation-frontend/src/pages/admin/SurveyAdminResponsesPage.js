import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import { fetchSurveyResponsesBySurveyId } from '../../services/surveyAdminApi';

export default function SurveyAdminResponsesPage() {
  const { surveyId } = useParams();
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canView = hasPermission(accessProfile, P.CAN_VIEW_SURVEY_RESPONSES);

  const [data, setData] = useState({ rows: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await fetchSurveyResponsesBySurveyId(token, surveyId, 50);
        if (!cancelled) setData({ rows: json.rows || [], count: json.count });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, canView, surveyId]);

  if (!canView) {
    return (
      <div className="container py-4">
        <Alert variant="warning">無權限檢視作答資料。</Alert>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="mb-3">
        <Link to="/admin/survey-module">← 問卷模組總覽</Link>
      </div>
      <h2 className="h4 text-primary mb-3">作答資料（survey #{surveyId}）</h2>
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <p className="small text-muted">共 {data.count} 筆（最多顯示 50 筆）</p>
            <div className="table-responsive">
              <Table size="sm" hover>
                <thead className="table-light">
                  <tr>
                    <th>id</th>
                    <th>學號</th>
                    <th>版本</th>
                    <th>提交時間</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.studentId}</td>
                      <td>{r.surveyVersionId}</td>
                      <td className="text-nowrap small">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                      <td className="small text-truncate" style={{ maxWidth: 280 }}>
                        {typeof r.answersJson === 'object' ? JSON.stringify(r.answersJson).slice(0, 120) : String(r.answersJson || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
