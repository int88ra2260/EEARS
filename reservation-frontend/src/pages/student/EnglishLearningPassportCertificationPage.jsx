import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import {
  loadElpStudent,
  requestElpCertification,
  fetchElpDashboard,
  openElpCertificationCertificate,
} from '../../services/englishLearningPassportApi';
import '../../components/englishLearningPassport/elp.css';

export default function EnglishLearningPassportCertificationPage() {
  const navigate = useNavigate();
  const student = loadElpStudent();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const handleRequest = async () => {
    setSubmitting(true);
    setError('');
    try {
      await requestElpCertification(student);
      navigate('/student/english-learning-passport');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;
  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  return (
    <div className="elp-page">
      <Link to="/student/english-learning-passport" className="small">← 返回護照首頁</Link>
      <h1 className="h4 mt-2 mb-3">申請英語能力標準認證</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Body>
          <p>您目前已累積 <strong>{passport?.totalApprovedPoints || 0}</strong> 點。</p>
          <p className="text-muted small">
            送出後由全英語卓越教學中心審核，核准後即完成英語文能力標準認證（英語實踐歷程檔案途徑）。
          </p>
          {passport?.certificationStatus === 'approved' ? (
            <div>
              <Alert variant="success">您已通過英語能力標準認證。</Alert>
              <Button variant="success" onClick={() => openElpCertificationCertificate(student)}>
                匯出認證單（PDF）
              </Button>
            </div>
          ) : passport?.canRequestCertification ? (
            <Button variant="success" onClick={handleRequest} disabled={submitting}>
              {submitting ? '送出中…' : '確認申請最終認證'}
            </Button>
          ) : (
            <Alert variant="warning" className="mb-0">
              {passport?.certificationStatus === 'pending'
                ? '您的最終認證申請審核中。'
                : '目前不符合申請條件（需 active 護照且滿 100 點）。'}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
