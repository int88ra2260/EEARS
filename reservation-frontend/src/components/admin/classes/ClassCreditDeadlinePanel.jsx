import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Spinner, Table } from 'react-bootstrap';
import {
  fetchClassCreditDeadlines,
  fetchClassCreditNavEnabled,
  previewClassCreditReminder,
  sendClassCreditReminder,
  updateClassCreditDeadline,
  updateClassCreditNavEnabled,
} from '../../../services/classCreditAllocationApi';
import { showErrorMessage, showSuccessMessage } from '../../../utils/errorHandler';

export default function ClassCreditDeadlinePanel({ token }) {
  const [loading, setLoading] = useState(true);
  const [savingSemester, setSavingSemester] = useState('');
  const [savingNav, setSavingNav] = useState(false);
  const [navEnabled, setNavEnabled] = useState(true);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [previewingSemester, setPreviewingSemester] = useState('');
  const [sendingSemester, setSendingSemester] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [data, enabled] = await Promise.all([
        fetchClassCreditDeadlines(token),
        fetchClassCreditNavEnabled(),
      ]);
      setNavEnabled(enabled);
      const list = data.rows || [];
      setRows(list);
      const next = {};
      list.forEach((r) => {
        next[r.semester] = r.deadline || '';
      });
      setDrafts(next);
    } catch (e) {
      setError(e.message || '載入失敗');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNavToggle = async (enabled) => {
    setSavingNav(true);
    try {
      const next = await updateClassCreditNavEnabled(token, enabled);
      setNavEnabled(next);
      showSuccessMessage(next ? '已顯示「課堂加分配置」入口' : '已隱藏「課堂加分配置」入口');
    } catch (e) {
      showErrorMessage(e.message || '更新入口開關失敗');
    } finally {
      setSavingNav(false);
    }
  };

  const handlePreview = async (semester) => {
    setPreviewingSemester(semester);
    setPreview(null);
    try {
      const data = await previewClassCreditReminder(token, semester);
      setPreview(data);
    } catch (e) {
      showErrorMessage(e.message || '預覽提醒對象失敗');
    } finally {
      setPreviewingSemester('');
    }
  };

  const handleSendReminder = async (semester) => {
    setSendingSemester(semester);
    try {
      const data = await sendClassCreditReminder(token, semester);
      showSuccessMessage(`已排入 ${data.queued} 封課堂加分分配提醒`);
      setPreview(null);
    } catch (e) {
      showErrorMessage(e.message || '寄送提醒失敗');
    } finally {
      setSendingSemester('');
    }
  };

  const handleSave = async (semester) => {
    setSavingSemester(semester);
    try {
      const deadline = drafts[semester] || null;
      await updateClassCreditDeadline(token, semester, deadline || null);
      showSuccessMessage(`${semester} 截止日已更新`);
      await load();
    } catch (e) {
      showErrorMessage(e.message || '更新失敗');
    } finally {
      setSavingSemester('');
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0">課堂加分配置截止日</h5>
        <div className="small text-muted mt-1">
          固定日由後台控制；逾期後多課學生無法再拆分，班級明細會顯示「未配置」。接近截止日時，可寄信提醒仍有待分配時數的多課學生。
        </div>
      </Card.Header>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-3">
          <div>
            <div className="fw-semibold">顯示學生導覽「課堂加分配置」</div>
            <div className="small text-muted">關閉後，前台導覽與「我的英語進度」不再顯示此入口。</div>
          </div>
          <div className="form-check form-switch m-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={navEnabled}
              disabled={loading || savingNav}
              onChange={(e) => handleNavToggle(e.target.checked)}
              aria-label="顯示課堂加分配置入口"
            />
          </div>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="py-3"><Spinner size="sm" /> 載入中…</div>
        ) : (
          <Table responsive hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>學期</th>
                <th>學期區間</th>
                <th>配置截止日</th>
                <th>狀態</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.semester}>
                  <td>{r.semester}</td>
                  <td className="small text-muted">
                    {r.range ? `${r.range.start} ~ ${r.range.end}` : '—'}
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    <Form.Control
                      type="date"
                      value={drafts[r.semester] || ''}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev,
                        [r.semester]: e.target.value,
                      }))}
                    />
                  </td>
                  <td>{r.locked ? '已截止' : (r.deadline ? '開放中' : '未設定')}</td>
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      disabled={savingSemester === r.semester}
                      onClick={() => handleSave(r.semester)}
                    >
                      {savingSemester === r.semester ? '儲存中…' : '儲存'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={previewingSemester === r.semester}
                      onClick={() => handlePreview(r.semester)}
                    >
                      {previewingSemester === r.semester ? '統計中…' : '寄送提醒'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {preview && (
          <Alert variant={preview.canSend ? 'info' : 'warning'} className="mt-3 mb-0">
            <div className="fw-semibold mb-1">{preview.semester} 分配提醒</div>
            <div className="small">
              多課學生 {preview.multiClassCount} 人，可寄出 {preview.recipientCount} 人。
              略過：無待分配時數 {preview.skippedNoHours}、已分配完 {preview.skippedFullyAllocated}、找不到信箱 {preview.skippedNoEmail}。
            </div>
            {preview.blockMessage && (
              <div className="small mt-1">{preview.blockMessage}</div>
            )}
            {preview.recipients?.length > 0 && (
              <ul className="small mb-2 mt-2">
                {preview.recipients.map((row) => (
                  <li key={row.studentId}>
                    {row.studentName}（{row.studentId}）{row.email}，待分配 {row.remainingHours} 時
                  </li>
                ))}
              </ul>
            )}
            {preview.recipientsTruncated && (
              <div className="small text-muted">名單僅顯示前 30 人，寄出時會包含全部可提醒學生。</div>
            )}
            <div className="d-flex gap-2 mt-2">
              <Button
                size="sm"
                variant="primary"
                disabled={!preview.canSend || sendingSemester === preview.semester}
                onClick={() => handleSendReminder(preview.semester)}
              >
                {sendingSemester === preview.semester ? '排入寄送中…' : `確認寄出 ${preview.recipientCount} 封`}
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setPreview(null)}>
                取消
              </Button>
            </div>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}
