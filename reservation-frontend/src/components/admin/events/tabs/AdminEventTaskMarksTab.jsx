import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  fetchEventTaskMarks,
  saveEventTaskMarks,
} from '../../../../services/etGroupingApi';
import { notifyLeaderMarkingAttention } from '../../../../hooks/useLeaderMarkingAttention';
import { showErrorMessage, showSuccessMessage } from '../../../../utils/errorHandler';
import { isEnglishTableEventType } from '../../../../utils/eventCapacityFields';
import AdminListPager, { slicePage } from '../../AdminListPager';

export default function AdminEventTaskMarksTab({ tabProps }) {
  const { token, eventId, canManage, canMark, eventType } = tabProps;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [draftMarks, setDraftMarks] = useState({});
  const [studentPage, setStudentPage] = useState(1);

  const isEnglishTable = isEnglishTableEventType(eventType);
  const canAccess = canManage || canMark;

  const loadMarks = useCallback(async () => {
    if (!token || !eventId || !isEnglishTable || !canAccess) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchEventTaskMarks(token, eventId);
      setMatrix(data);
      const initial = {};
      for (const student of data.students || []) {
        for (const task of student.tasks || []) {
          initial[`${student.reservationId}:${task.taskItemId}`] = Boolean(task.completed);
        }
      }
      setDraftMarks(initial);
    } catch (e) {
      setError(e.message || '載入任務勾選失敗');
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, isEnglishTable, canAccess]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  const groupOptions = useMemo(() => {
    const labels = new Set((matrix?.students || []).map((s) => s.groupLabel).filter(Boolean));
    return ['all', ...Array.from(labels).sort()];
  }, [matrix]);

  const filteredStudents = useMemo(() => {
    const students = matrix?.students || [];
    if (selectedGroup === 'all') return students;
    return students.filter((s) => s.groupLabel === selectedGroup);
  }, [matrix, selectedGroup]);

  useEffect(() => {
    setStudentPage(1);
  }, [selectedGroup, matrix]);

  const pagedStudents = slicePage(filteredStudents, studentPage);

  const taskColumns = useMemo(() => {
    const map = new Map();
    for (const student of filteredStudents) {
      for (const task of student.tasks || []) {
        if (!map.has(task.taskItemId)) {
          map.set(task.taskItemId, task);
        }
      }
    }
    return Array.from(map.values());
  }, [filteredStudents]);

  const toggleMark = (reservationId, taskItemId, student) => {
    if (!student.canMark || !matrix?.markingOpen) return;
    const key = `${reservationId}:${taskItemId}`;
    setDraftMarks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyRowAll = (student, checked) => {
    if (!student.canMark || !matrix?.markingOpen) return;
    setDraftMarks((prev) => {
      const next = { ...prev };
      for (const task of student.tasks || []) {
        next[`${student.reservationId}:${task.taskItemId}`] = checked;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const marks = Object.entries(draftMarks).map(([key, completed]) => {
        const [reservationId, taskItemId] = key.split(':');
        return { reservationId: Number(reservationId), taskItemId: Number(taskItemId), completed };
      });
      const data = await saveEventTaskMarks(token, eventId, marks);
      setMatrix(data);
      notifyLeaderMarkingAttention();
      showSuccessMessage('任務勾選已儲存');
    } catch (e) {
      showErrorMessage(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!isEnglishTable) {
    return <Alert variant="info">僅 English Table 活動支援任務勾選。</Alert>;
  }

  if (!canAccess) {
    return <Alert variant="warning">您沒有任務勾選權限。</Alert>;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 py-4">
        <Spinner animation="border" size="sm" />
        <span>載入任務勾選…</span>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div className="admin-event-task-marks-tab">
      <Alert variant="light" className="border mb-3">
        <div className="small fw-semibold mb-1">怎麼勾</div>
        <ul className="small mb-0 ps-3">
          <li>只有已簽到的學生可以勾。每個人用同一套任務。</li>
          <li>必選題都勾完，這場才會計薪。勾是或勾否都算，空白不算。</li>
          <li>
            {matrix?.markingExtendedUntil
              ? `行政已開放補勾到 ${new Date(matrix.markingExtendedUntil).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}。離活動當天越遠，越不能代表現場。`
              : matrix?.markingOpen
                ? '請在離場前勾完。超過結束後 3 天就不能再勾，這場也不會計薪。'
                : '補勾期限已過，現在只能看。還沒勾完請聯絡行政。'}
          </li>
        </ul>
        {matrix?.scope === 'leader' && matrix.leaderGroups?.length > 0 && (
          <div className="small mt-2">
            你負責的組別：
            {matrix.leaderGroups.map((g) => (
              <Badge key={g} bg="primary" className="ms-1">{g}</Badge>
            ))}
          </div>
        )}
      </Alert>

      <Form.Group className="mb-3" style={{ maxWidth: 280 }}>
        <Form.Label className="small mb-1" htmlFor="task-marks-group">組別</Form.Label>
        <Form.Select
          id="task-marks-group"
          size="sm"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          {groupOptions.map((opt) => (
            <option key={opt} value={opt}>{opt === 'all' ? '全部組別' : opt}</option>
          ))}
        </Form.Select>
      </Form.Group>

      {!filteredStudents.length ? (
        <Alert variant="secondary">目前沒有可勾選的學生。請確認分組，以及你是否被指派這場。</Alert>
      ) : (
        <>
        <div className="d-md-none">
          {pagedStudents.rows.map((student) => (
            <article key={student.reservationId} className="leader-task-student-card border rounded p-3 mb-2 bg-white">
              <div className="d-flex justify-content-between gap-2 mb-2">
                <div>
                  <div className="fw-semibold">{student.studentName}</div>
                  <div className="small text-muted">
                    {student.studentId}
                    {student.groupLabel ? ` · ${student.groupLabel}` : ''}
                  </div>
                </div>
                <Badge bg={student.canMark ? 'success' : 'secondary'}>{student.checkinStatus}</Badge>
              </div>
              <div className="d-grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Button
                  variant="outline-primary"
                  size="sm"
                  disabled={!student.canMark || !matrix?.markingOpen}
                  onClick={() => applyRowAll(student, true)}
                >
                  全選
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={!student.canMark || !matrix?.markingOpen}
                  onClick={() => applyRowAll(student, false)}
                >
                  清除
                </Button>
              </div>
              {taskColumns.map((task) => {
                const studentTask = (student.tasks || []).find((t) => t.taskItemId === task.taskItemId);
                const key = `${student.reservationId}:${task.taskItemId}`;
                const checked = Boolean(draftMarks[key]);
                const disabled = !student.canMark || !matrix?.markingOpen || !studentTask;
                if (!studentTask) return null;
                return (
                  <Form.Check
                    key={task.taskItemId}
                    className="mb-2"
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleMark(student.reservationId, task.taskItemId, student)}
                    label={(
                      <span>
                        {task.label}
                        {task.isRequired ? <Badge bg="warning" text="dark" className="ms-2">必選</Badge> : null}
                      </span>
                    )}
                    aria-label={`${student.studentName} ${task.label}`}
                  />
                );
              })}
            </article>
          ))}
        </div>
        <div className="d-none d-md-block table-responsive">
          <Table bordered size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>學號</th>
                <th>姓名</th>
                <th>組別</th>
                <th>簽到</th>
                <th>批次</th>
                {taskColumns.map((task) => (
                  <th key={task.taskItemId} className="text-center" style={{ minWidth: 110 }}>
                    <div className="small fw-semibold">{task.label}</div>
                    {task.isRequired ? <Badge bg="warning" text="dark">必選</Badge> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedStudents.rows.map((student) => (
                <tr key={student.reservationId}>
                  <td>{student.studentId}</td>
                  <td>{student.studentName}</td>
                  <td>{student.groupLabel || '—'}</td>
                  <td>
                    <Badge bg={student.canMark ? 'success' : 'secondary'}>
                      {student.checkinStatus}
                    </Badge>
                  </td>
                  <td className="text-nowrap">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-1"
                      disabled={!student.canMark || !matrix?.markingOpen}
                      onClick={() => applyRowAll(student, true)}
                    >
                      全選
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={!student.canMark || !matrix?.markingOpen}
                      onClick={() => applyRowAll(student, false)}
                    >
                      清除
                    </Button>
                  </td>
                  {taskColumns.map((task) => {
                    const studentTask = (student.tasks || []).find((t) => t.taskItemId === task.taskItemId);
                    const key = `${student.reservationId}:${task.taskItemId}`;
                    const checked = Boolean(draftMarks[key]);
                    const disabled = !student.canMark || !matrix?.markingOpen || !studentTask;
                    return (
                      <td key={task.taskItemId} className="text-center">
                        {studentTask ? (
                          <Form.Check
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleMark(student.reservationId, task.taskItemId, student)}
                            aria-label={`${student.studentName} ${task.label}`}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <AdminListPager
          page={pagedStudents.current}
          pages={pagedStudents.pages}
          total={filteredStudents.length}
          onPage={setStudentPage}
          label="學生分頁"
        />
        <div className="leader-task-actions d-grid gap-2 d-sm-flex mt-3">
          <Button
            variant="primary"
            disabled={saving || !matrix?.markingOpen}
            onClick={handleSave}
          >
            {saving ? '儲存中…' : '儲存勾選'}
          </Button>
          <Button variant="outline-secondary" disabled={saving} onClick={loadMarks}>
            重新載入
          </Button>
        </div>
        </>
      )}
    </div>
  );
}
