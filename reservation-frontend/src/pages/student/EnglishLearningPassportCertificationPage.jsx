import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import {
  loadElpStudent,
  fetchElpDashboard,
  openElpCertificationCertificate,
} from '../../services/englishLearningPassportApi';
import '../../components/englishLearningPassport/elp.css';

/** 最終行政審核已移除：此頁改為導向／匯出認證單 */
export default function EnglishLearningPassportCertificationPage() {
  const navigate = useNavigate();
  const student = loadElpStudent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passport, setPassport] = useState(null);

  React.useEffect(() => {
    if (!student) {
      navigate('/student/english-learning-passport');
      return;
    }
    fetchElpDashboard(student)
      .then((d) => setPassport(d.passport))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [student, navigate]);

  if (!student) return null;
  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  const certified = passport?.certificationStatus === 'approved' || passport?.hasCompletedCertification;

  return (
    <div className="elp-page">
      <Link to="/student/english-learning-passport" className="small">← 返回護照首頁</Link>
      <h1 className="h4 mt-2 mb-3">英語能力標準認證</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Body>
          <p>您目前已累積 <strong>{passport?.totalApprovedPoints || 0}</strong> 點。</p>
          <p className="text-muted small mb-3">
            點數項目經行政審核達 100 點後，系統會自動完成認證，無需再送「最終認證」申請。
          </p>
          {certified ? (
            <div>
              <Alert variant="success">您已通過英語能力標準認證。</Alert>
              <Button variant="success" onClick={() => openElpCertificationCertificate(student)}>
                匯出認證單（PDF）
              </Button>
            </div>
          ) : (
            <Alert variant="warning" className="mb-0">
              尚未達標或點數仍在審核中。請於護照首頁持續提交項目，待點數審核通過並累積滿 100 點後即可匯出認證單。
              <div className="mt-2">
                <Link to="/student/english-learning-passport" className="btn btn-sm btn-outline-primary">
                  返回護照首頁
                </Link>
              </div>
            </Alert>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
