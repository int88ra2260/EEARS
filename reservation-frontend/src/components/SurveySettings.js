import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Card from 'react-bootstrap/Card';

function SurveySettings() {
  const { token, userRole } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/survey-settings', {
          headers: { Authorization: `Bearer ${token}`, 'X-User-Role': userRole || 'worker' },
        });
        const data = await res.json().catch(() => []);
        if (!cancelled && res.ok) setList(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, userRole]);

  return (
    <>
      <Alert variant="warning" className="mb-3">
        <strong>唯讀</strong>：舊版問卷設定已停止寫入，不能再改啟用狀態或開放時間。<br />
        請改到 <Link to="/admin/survey-rules">問卷規則</Link> 調整。寫入此頁會覆蓋正式規則的開放時間。
      </Alert>
      {loading ? <div className="text-muted">載入中...</div> : null}
      <div className="row g-3">
        {list.map((s) => (
          <div className="col-md-6" key={s.id || s.surveyId}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="fw-semibold">{s.surveyName}</div>
                <div className="small text-muted">surveyId: {s.surveyId}</div>
                <div className="small mt-2">isEnabled: {s.isEnabled ? 'true' : 'false'} / isRequired: {s.isRequired ? 'true' : 'false'}</div>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}

export default SurveySettings;
