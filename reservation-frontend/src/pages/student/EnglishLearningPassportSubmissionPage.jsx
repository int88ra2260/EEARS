import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import {
  loadElpStudent,
  createElpSubmission,
  updateElpSubmission,
  fetchElpSubmission,
  submitElpSubmission,
  uploadElpAttachment,
  fetchElpRules,
  deleteElpSubmission,
} from '../../services/englishLearningPassportApi';
import { RULE_FORM_FIELDS, buildSubmissionPayload } from '../../constants/elpFormConfig';
import '../../components/englishLearningPassport/elp.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DELETABLE_STATUSES = new Set(['draft', 'rejected']);

function applySubmissionToForm(sub) {
  return {
    activityDate: sub.activityDate || '',
    description: sub.description || '',
    ...(sub.metadataJson || {}),
    wonAward: sub.metadataJson?.wonAward ? 'true' : 'false',
  };
}

export default function EnglishLearningPassportSubmissionPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [student] = useState(() => loadElpStudent());
  const isNew = !id || id === 'new';
  const initialRule = searchParams.get('rule') || '';

  const [rules, setRules] = useState([]);
  const [ruleCode, setRuleCode] = useState(initialRule);
  const [form, setForm] = useState({ description: '' });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState(isNew ? null : id);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (!student?.studentId) {
      navigate('/student/english-learning-passport');
      return undefined;
    }

    const seq = ++loadSeqRef.current;
    let cancelled = false;

    fetchElpRules()
      .then((data) => {
        if (!cancelled && seq === loadSeqRef.current) setRules(data);
      })
      .catch(() => {});

    if (!isNew) {
      setLoading(true);
      setError('');
      fetchElpSubmission(student, id)
        .then((sub) => {
          if (cancelled || seq !== loadSeqRef.current) return;
          setRuleCode(sub.ruleCode);
          setForm(applySubmissionToForm(sub));
          setSubmissionId(sub.id);
          setSubmissionStatus(sub.status);
        })
        .catch((e) => {
          if (cancelled || seq !== loadSeqRef.current) return;
          const msg = e.code === 'RATE_LIMIT_EXCEEDED'
            ? '查詢過於頻繁，請稍候 1～2 分鐘後再試'
            : (e.message || '載入失敗');
          setError(msg);
        })
        .finally(() => {
          if (!cancelled && seq === loadSeqRef.current) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [student, student?.studentId, id, isNew, navigate]);

  const fields = RULE_FORM_FIELDS[ruleCode] || [];

  const handleFile = (key, file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('僅支援 JPG、PNG、WebP、PDF');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('檔案大小不可超過 5MB');
      return;
    }
    setFiles({ ...files, [key]: file });
    setError('');
  };

  const handleSave = async (andSubmit = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = buildSubmissionPayload(ruleCode, form);
      let sub;
      if (submissionId) {
        sub = await updateElpSubmission(student, submissionId, payload);
      } else {
        sub = await createElpSubmission(student, payload);
        setSubmissionId(sub.id);
        setSubmissionStatus(sub.status);
      }

      for (const entry of Object.entries(files)) {
        const file = entry[1];
        if (file) await uploadElpAttachment(student, sub.id, file);
      }

      if (andSubmit) {
        await submitElpSubmission(student, sub.id);
      }
      navigate('/student/english-learning-passport');
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!submissionId) return;
    if (!window.confirm('確定要刪除此草稿？刪除後無法復原。')) return;
    setDeleting(true);
    setError('');
    try {
      await deleteElpSubmission(student, submissionId);
      navigate('/student/english-learning-passport');
    } catch (e) {
      setError(e.message || '刪除失敗');
    } finally {
      setDeleting(false);
    }
  };

  if (!student?.studentId) return null;
  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  const canDelete = submissionStatus && DELETABLE_STATUSES.has(submissionStatus);

  return (
    <div className="elp-page">
      <Link to="/student/english-learning-passport" className="small">← 返回護照首頁</Link>
      <h1 className="h4 mt-2 mb-3">{isNew ? '新增點數項目' : '編輯點數項目'}</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Body>
          {isNew && (
            <Form.Group className="mb-3">
              <Form.Label>項目類型</Form.Label>
              <Form.Select value={ruleCode} onChange={(e) => setRuleCode(e.target.value)} required>
                <option value="">請選擇</option>
                {rules.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          {fields.map((field) => {
            if (field.type === 'file') {
              return (
                <Form.Group key={field.key} className="mb-3">
                  <Form.Label>
                    {field.label}
                    {field.required && <span className="text-danger"> *</span>}
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleFile(field.key, e.target.files?.[0])}
                  />
                  <Form.Text className="text-muted">JPG、PNG、WebP、PDF，最大 5MB</Form.Text>
                </Form.Group>
              );
            }
            if (field.type === 'select') {
              const opts = field.options || [];
              const isBool = field.key === 'wonAward';
              return (
                <Form.Group key={field.key} className="mb-3">
                  <Form.Label>{field.label}{field.required && <span className="text-danger"> *</span>}</Form.Label>
                  <Form.Select
                    value={form[field.key] ?? ''}
                    onChange={(e) => setForm({
                      ...form,
                      [field.key]: isBool ? e.target.value : e.target.value,
                    })}
                    required={field.required}
                  >
                    <option value="">請選擇</option>
                    {opts.map((o) => {
                      if (typeof o === 'object') {
                        return <option key={String(o.value)} value={String(o.value)}>{o.label}</option>;
                      }
                      return <option key={o} value={o}>{o}</option>;
                    })}
                  </Form.Select>
                </Form.Group>
              );
            }
            if (field.type === 'textarea') {
              return (
                <Form.Group key={field.key} className="mb-3">
                  <Form.Label>{field.label}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={form[field.key] || ''}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                </Form.Group>
              );
            }
            return (
              <Form.Group key={field.key} className="mb-3">
                <Form.Label>{field.label}{field.required && <span className="text-danger"> *</span>}</Form.Label>
                <Form.Control
                  type={field.type}
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  required={field.required}
                />
              </Form.Group>
            );
          })}

          <Row className="g-2 mt-2 align-items-center">
            <Col xs="auto">
              <Button variant="outline-primary" disabled={saving || !ruleCode} onClick={() => handleSave(false)}>
                儲存草稿
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="primary" disabled={saving || !ruleCode} onClick={() => handleSave(true)}>
                送出審核
              </Button>
            </Col>
            {canDelete && (
              <Col xs="auto" className="ms-auto">
                <Button variant="outline-danger" disabled={deleting || saving} onClick={handleDelete}>
                  {deleting ? '刪除中…' : '刪除草稿'}
                </Button>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
}
