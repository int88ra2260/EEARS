import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useOutletContext } from 'react-router-dom';
import { Alert, Button, Card, Spinner, Table } from 'react-bootstrap';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import { adminFetchPassportDetail } from '../../services/englishLearningPassportApi';
import ElpStatusBadge from '../../components/englishLearningPassport/ElpStatusBadge';
import EnglishLearningSubmissionReviewModal from '../../components/englishLearningPassport/EnglishLearningSubmissionReviewModal';
import { RULE_LIMIT_HINTS } from '../../constants/elpFormConfig';
import '../../components/englishLearningPassport/elp.css';

export default function EnglishLearningPassportDetailPage() {
  const { id } = useParams();
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canReview = hasPermission(accessProfile, P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewSub, setReviewSub] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await adminFetchPassportDetail(token, id));
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (error) return <div className="alert alert-danger m-3">{error}</div>;
  if (!data) return null;

  const { passport, pointsByRule, submissions, auditLogs } = data;
  const pendingSubmissions = submissions.filter((s) => s.status === 'submitted');
  const studentFallback = {
    studentId: passport.studentId,
    studentName: passport.studentName,
    studentEmail: passport.studentEmail,
  };

  return (
    <div className="container-fluid py-3">
      <Link to="/admin/english-learning-passports" className="small">← 返回列表</Link>
      <h1 className="h4 mt-2">護照詳情 — {passport.studentName}</h1>

      <Card className="mb-3">
        <Card.Body>
          <div className="row g-2">
            <div className="col-md-3"><strong>學號</strong><br />{passport.studentId}</div>
            <div className="col-md-3"><strong>Email</strong><br />{passport.studentEmail}</div>
            <div className="col-md-3"><strong>狀態</strong><br /><ElpStatusBadge status={passport.status} /></div>
            <div className="col-md-3"><strong>累計點數</strong><br />{passport.totalApprovedPoints}</div>
            <div className="col-md-3"><strong>最終認證</strong><br />{passport.certificationStatus}</div>
          </div>
        </Card.Body>
      </Card>

      {canReview && pendingSubmissions.length > 0 && (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>有 {pendingSubmissions.length} 筆點數項目待審核</span>
          <Button
            size="sm"
            variant="warning"
            onClick={() => setReviewSub(pendingSubmissions[0])}
          >
            審核第一筆
          </Button>
        </Alert>
      )}

      <h2 className="h6">各類別核准點數</h2>
      <Table size="sm" className="mb-4" style={{ maxWidth: 480 }}>
        <thead>
          <tr><th>類型</th><th>核准點數</th><th>說明</th></tr>
        </thead>
        <tbody>
          {Object.entries(pointsByRule || {}).map(([code, pts]) => (
            <tr key={code}>
              <td><code>{code}</code></td>
              <td>{pts} 點</td>
              <td className="small text-muted">{RULE_LIMIT_HINTS[code] || '—'}</td>
            </tr>
          ))}
          {Object.keys(pointsByRule || {}).length === 0 && (
            <tr><td colSpan={3} className="text-muted">尚無核准點數</td></tr>
          )}
        </tbody>
      </Table>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h2 className="h6 mb-0">提交紀錄</h2>
        {canReview && (
          <Link to="/admin/english-learning-passports?tab=submissions" className="btn btn-sm btn-outline-primary">
            前往點數審核列表
          </Link>
        )}
      </div>
      <Table responsive size="sm" className="mb-4">
        <thead>
          <tr>
            <th>類型</th>
            <th>名稱</th>
            <th>狀態</th>
            <th>申請</th>
            <th>核准</th>
            <th>提交時間</th>
            {canReview && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {submissions.length === 0 && (
            <tr><td colSpan={canReview ? 7 : 6} className="text-muted">尚無提交紀錄</td></tr>
          )}
          {submissions.map((s) => (
            <tr key={s.id}>
              <td><code className="small">{s.ruleCode}</code></td>
              <td>{s.title || '—'}</td>
              <td><ElpStatusBadge status={s.status} /></td>
              <td>{s.pointsRequested}</td>
              <td>{s.pointsApproved ?? '—'}</td>
              <td className="text-nowrap small">
                {(s.submittedAt || s.createdAt || '').slice(0, 16).replace('T', ' ')}
              </td>
              {canReview && (
                <td className="text-nowrap">
                  {s.status === 'submitted' ? (
                    <Button size="sm" variant="primary" onClick={() => setReviewSub(s)}>
                      審核
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline-secondary" onClick={() => setReviewSub(s)}>
                      查看
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="h6">稽核紀錄（最近 100 筆）</h2>
      <Table responsive size="sm">
        <thead><tr><th>時間</th><th>動作</th><th>操作者</th></tr></thead>
        <tbody>
          {(auditLogs || []).map((l) => (
            <tr key={l.id}>
              <td className="text-nowrap small">{(l.created_at || l.createdAt || '').slice(0, 19).replace('T', ' ')}</td>
              <td>{l.action}</td>
              <td className="small">{l.actor_role || '—'} / {l.actor_id || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <EnglishLearningSubmissionReviewModal
        show={!!reviewSub}
        onHide={() => setReviewSub(null)}
        submission={reviewSub}
        token={token}
        studentFallback={studentFallback}
        onDone={loadDetail}
      />
    </div>
  );
}
