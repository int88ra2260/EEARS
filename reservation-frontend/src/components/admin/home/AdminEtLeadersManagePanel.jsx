import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { useNavigate } from 'react-router-dom';
import { getSemesterOptions } from '../../../utils/adminReportUtils';
import {
  applyEventLeaderPreferences,
  applyEventLeaderPreferencesBatch,
  assignEventGroupLeaders,
  fetchEtLeaderCandidates,
  fetchLeaderManagementEvents,
} from '../../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../../utils/errorHandler';

function formatLeaderCandidateLabel(teacher) {
  if (!teacher) return '';
  if (teacher.studentId) return `${teacher.name}（${teacher.studentId}）`;
  return teacher.name;
}

function buildLeaderMap(leaders = []) {
  const map = new Map();
  leaders.forEach((row) => {
    if (row.groupLabel) map.set(row.groupLabel, row.leaderTeacherId || '');
  });
  return map;
}

export default function AdminEtLeadersManagePanel({ token, selectedSemester, onSemesterChange }) {
  const navigate = useNavigate();
  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [events, setEvents] = useState([]);
  const [leaderCandidates, setLeaderCandidates] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [rememberPreference, setRememberPreference] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState(() => new Set());

  const loadEvents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await fetchLeaderManagementEvents(token, {
        semester: selectedSemester,
        date: filterDate || undefined,
      });
      setEvents(rows || []);
      const nextDrafts = {};
      (rows || []).forEach((event) => {
        nextDrafts[event.eventId] = buildLeaderMap(event.leaders);
      });
      setDrafts(nextDrafts);
      setSelectedEventIds(new Set());
    } catch (e) {
      showErrorMessage(e.message || '載入 Leader 管理場次失敗');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [token, selectedSemester, filterDate]);

  useEffect(() => {
    fetchEtLeaderCandidates(token)
      .then((rows) => setLeaderCandidates(rows || []))
      .catch(() => setLeaderCandidates([]));
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleLeaderDraftChange = (eventId, groupLabel, leaderTeacherId) => {
    setDrafts((prev) => {
      const eventDraft = new Map(prev[eventId] || []);
      eventDraft.set(groupLabel, leaderTeacherId ? Number(leaderTeacherId) : '');
      return { ...prev, [eventId]: eventDraft };
    });
  };

  const handleSaveEventLeaders = async (eventRow) => {
    const eventDraft = drafts[eventRow.eventId];
    if (!eventDraft) return;
    const assignments = Array.from({ length: eventRow.groupCount }, (_, index) => {
      const groupLabel = `Group ${index + 1}`;
      const leaderTeacherId = eventDraft.get(groupLabel);
      return { groupLabel, leaderTeacherId: leaderTeacherId || null };
    }).filter((row) => row.leaderTeacherId);

    if (!assignments.length) {
      showErrorMessage('請至少指派一位 Leader');
      return;
    }

    setActionKey(`save-${eventRow.eventId}`);
    try {
      await assignEventGroupLeaders(token, eventRow.eventId, assignments, { rememberPreference });
      showSuccessMessage(rememberPreference ? '已儲存並記住學期偏好' : '已儲存 Leader 指派');
      await loadEvents();
    } catch (e) {
      showErrorMessage(e.message || '儲存 Leader 失敗');
    } finally {
      setActionKey('');
    }
  };

  const handleApplyPreferences = async (eventRow) => {
    setActionKey(`pref-${eventRow.eventId}`);
    try {
      await applyEventLeaderPreferences(token, eventRow.eventId);
      showSuccessMessage('已套用學期 Leader 偏好');
      await loadEvents();
    } catch (e) {
      showErrorMessage(e.message || '套用偏好失敗');
    } finally {
      setActionKey('');
    }
  };

  const selectableEventIds = useMemo(
    () => events.filter((row) => row.canApplyPreferences).map((row) => row.eventId),
    [events]
  );

  const allSelectableSelected = selectableEventIds.length > 0
    && selectableEventIds.every((id) => selectedEventIds.has(id));

  const toggleEventSelection = (eventId) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedEventIds((prev) => {
      if (allSelectableSelected) return new Set();
      return new Set(selectableEventIds);
    });
  };

  const handleBatchApplyPreferences = async () => {
    const eventIds = [...selectedEventIds];
    if (!eventIds.length) {
      showErrorMessage('請先勾選要套用的場次');
      return;
    }
    setActionKey('batch-pref');
    try {
      const result = await applyEventLeaderPreferencesBatch(token, eventIds);
      const applied = result?.applied?.length || 0;
      const failed = result?.errors?.length || 0;
      if (failed > 0) {
        showSuccessMessage(`已套用 ${applied} 場，${failed} 場失敗`);
      } else {
        showSuccessMessage(`已批次套用 ${applied} 場活動的 Leader 偏好`);
      }
      await loadEvents();
    } catch (e) {
      showErrorMessage(e.message || '批次套用偏好失敗');
    } finally {
      setActionKey('');
    }
  };

  return (
    <div className="admin-et-leaders-panel pt-2">
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small mb-1">學期</Form.Label>
              <Form.Select
                size="sm"
                value={selectedSemester}
                onChange={(e) => onSemesterChange(e.target.value)}
              >
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small mb-1">日期（選填）</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </Col>
            <Col md="auto">
              <Form.Check
                type="checkbox"
                id="remember-leader-pref"
                className="small"
                label="指派後記住學期偏好"
                checked={rememberPreference}
                onChange={(e) => setRememberPreference(e.target.checked)}
              />
            </Col>
            <Col md="auto" className="ms-auto d-flex flex-wrap gap-2">
              {selectableEventIds.length > 0 ? (
                <Form.Check
                  type="checkbox"
                  id="select-all-leader-events"
                  className="small align-self-center"
                  label={allSelectableSelected ? '取消全選可套用場次' : '全選可套用場次'}
                  checked={allSelectableSelected}
                  onChange={toggleSelectAll}
                  disabled={loading || Boolean(actionKey)}
                />
              ) : null}
              <Button
                variant="outline-primary"
                size="sm"
                disabled={loading || Boolean(actionKey) || selectedEventIds.size === 0}
                onClick={handleBatchApplyPreferences}
              >
                {actionKey === 'batch-pref' ? '批次套用中…' : `批次套用偏好（${selectedEventIds.size}）`}
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={loadEvents} disabled={loading}>
                重新整理
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入 ET 場次…</span>
        </div>
      ) : null}

      {!loading && !events.length ? (
        <Alert variant="info">目前篩選條件下沒有 English Table 場次。</Alert>
      ) : null}

      {!loading && events.map((eventRow) => {
        const eventDraft = drafts[eventRow.eventId] || new Map();
        const groupLabels = Array.from({ length: eventRow.groupCount }, (_, i) => `Group ${i + 1}`);
        return (
          <Card key={eventRow.eventId} className="mb-3 border-0 shadow-sm">
            <Card.Header className="d-flex flex-wrap align-items-center gap-2 py-2">
              {eventRow.canApplyPreferences ? (
                <Form.Check
                  type="checkbox"
                  className="mb-0"
                  checked={selectedEventIds.has(eventRow.eventId)}
                  onChange={() => toggleEventSelection(eventRow.eventId)}
                  disabled={Boolean(actionKey)}
                  aria-label={`選取 ${eventRow.name}`}
                />
              ) : (
                <span style={{ width: 24 }} aria-hidden />
              )}
              <div className="fw-semibold">{eventRow.name}</div>
              <Badge bg="light" text="dark" className="border">{eventRow.date}</Badge>
              <Badge bg={eventRow.leaderFilled ? 'success' : 'warning'}>
                Leader {eventRow.leaderCount}/{eventRow.groupCount}
              </Badge>
              <div className="ms-auto d-flex flex-wrap gap-2">
                {eventRow.canApplyPreferences ? (
                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={Boolean(actionKey)}
                    onClick={() => handleApplyPreferences(eventRow)}
                  >
                    {actionKey === `pref-${eventRow.eventId}` ? '套用中…' : '套用學期偏好'}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => navigate(`/admin/operations/${eventRow.eventId}`)}
                >
                  活動明細
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={Boolean(actionKey)}
                  onClick={() => handleSaveEventLeaders(eventRow)}
                >
                  {actionKey === `save-${eventRow.eventId}` ? '儲存中…' : '儲存指派'}
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="pt-2">
              <Table responsive size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>組別</th>
                    <th>人數</th>
                    <th style={{ minWidth: 180 }}>Leader</th>
                  </tr>
                </thead>
                <tbody>
                  {groupLabels.map((groupLabel) => {
                    const groupStat = eventRow.groups?.find((g) => g.groupLabel === groupLabel);
                    return (
                      <tr key={groupLabel}>
                        <td>{groupLabel}</td>
                        <td>{groupStat?.studentCount ?? 0}</td>
                        <td>
                          <Form.Select
                            size="sm"
                            value={eventDraft.get(groupLabel) || ''}
                            disabled={Boolean(actionKey)}
                            onChange={(e) => handleLeaderDraftChange(
                              eventRow.eventId,
                              groupLabel,
                              e.target.value
                            )}
                          >
                            <option value="">— 未指派 —</option>
                            {leaderCandidates.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>{formatLeaderCandidateLabel(teacher)}</option>
                            ))}
                          </Form.Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}
