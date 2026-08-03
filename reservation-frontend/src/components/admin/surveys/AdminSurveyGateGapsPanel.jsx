import React, { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Pagination from 'react-bootstrap/Pagination';
import Badge from 'react-bootstrap/Badge';
import { displayStudentEmail } from '../../../utils/piiMask';
import { fetchSurveyGateGaps } from '../../../services/surveyAdminApi';

const GAP_ACTIVITY_TYPES = new Set(['ET', 'EC']);

export function canQuerySurveyGateGaps(filters) {
  if (!filters?.semesterId) return false;
  if (!GAP_ACTIVITY_TYPES.has(filters.activityType)) return false;
  return true;
}

/** 預約缺口列表／匯出共用的 query 參數 */
export function buildSurveyGateGapsQueryParams(filters, { page, pageSize } = {}) {
  if (!canQuerySurveyGateGaps(filters)) return null;
  const q = new URLSearchParams({
    semesterId: String(filters.semesterId),
    activityType: filters.activityType,
  });
  if (page != null) q.set('page', String(page));
  if (pageSize != null) q.set('pageSize', String(pageSize));
  if (filters.eventId) q.set('eventId', String(filters.eventId));
  if (filters.studentId?.trim()) q.set('studentId', filters.studentId.trim());
  if (filters.studentName?.trim()) q.set('studentName', filters.studentName.trim());
  if (filters.studentEmail?.trim()) q.set('studentEmail', filters.studentEmail.trim());
  return q;
}

function formatGapReason(code) {
  if (code === 'survey_not_completed') return '未完成問卷';
  return code || '-';
}

function formatMetaReason(reason) {
  const map = {
    rule_disabled: '問卷 Gate 已停用',
    rule_not_required: '問卷非必填',
    not_started: '問卷尚未開始',
    ended: '問卷已結束',
    no_legacy_survey_setting: '無 legacy 問卷設定',
  };
  return map[reason] || reason || null;
}

export default function AdminSurveyGateGapsPanel({ filters, token, reloadToken, pageSize = 20 }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGaps = useCallback(
    async (page = 1) => {
      if (!canQuerySurveyGateGaps(filters)) {
        setRows([]);
        setSummary(null);
        setMeta(null);
        setError('');
        return;
      }

      try {
        setLoading(true);
        setError('');
        const q = buildSurveyGateGapsQueryParams(filters, { page, pageSize });
        if (!q) return;

        const data = await fetchSurveyGateGaps(token, q);
        setRows(data.rows || []);
        setSummary(data.summary || null);
        setMeta(data.meta || null);
        setPagination((p) => ({
          ...p,
          ...(data.pagination || {}),
          page,
          pageSize,
        }));
      } catch (e) {
        setError(e.message || '載入預約缺口失敗');
        setRows([]);
        setSummary(null);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [filters, token, pageSize]
  );

  useEffect(() => {
    if (reloadToken == null || reloadToken === 0) return;
    loadGaps(1);
  }, [reloadToken, loadGaps]);

  if (!canQuerySurveyGateGaps(filters)) {
    return (
      <Alert variant="info" className="mb-0">
        請先選擇<strong>學期</strong>與活動類型 <strong>ET</strong> 或 <strong>EC</strong>，再按「查詢」載入預約缺口。
        {filters.activityType && !GAP_ACTIVITY_TYPES.has(filters.activityType) ? (
          <div className="mt-2 mb-0 small">目前活動類型為 {filters.activityType}；預約缺口僅支援 ET / EC。</div>
        ) : null}
      </Alert>
    );
  }

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-2">
              <div className="small text-muted">掃描預約筆數</div>
              <div className="h5 mb-0">{summary?.reservationRowsScanned ?? '-'}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-2">
              <div className="small text-muted">缺口學生數</div>
              <div className="h5 mb-0">{summary?.distinctStudents ?? '-'}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="border-0 shadow-sm">
            <Card.Body className="py-2">
              <div className="small text-muted">缺口數</div>
              <div className="h5 mb-0 text-danger">{summary?.gapCount ?? '-'}</div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {meta ? (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Body className="small">
            <div className="d-flex flex-wrap gap-3 mb-2">
              <span>
                <span className="text-muted">surveyKey：</span>
                {meta.surveyKey || '-'}
              </span>
              <span>
                <span className="text-muted">gateMode：</span>
                {meta.gateMode || '-'}
              </span>
              <span>
                <span className="text-muted">retakePolicy：</span>
                {meta.retakePolicy || '-'}
              </span>
              <span>
                <span className="text-muted">completionSemester：</span>
                {meta.completionSemesterUsed || meta.semesterCode || '-'}
              </span>
              <span>
                <span className="text-muted">Gate：</span>
                <Badge bg={meta.gateActive ? 'success' : 'secondary'}>
                  {meta.gateActive ? '生效中' : '未生效'}
                </Badge>
              </span>
            </div>
            {!meta.gateActive && meta.reason ? (
              <Alert variant="warning" className="py-2 mb-2">
                {formatMetaReason(meta.reason)}
              </Alert>
            ) : null}
            {(meta.warnings || []).length > 0 ? (
              <Alert variant="info" className="py-2 mb-0">
                <div className="fw-semibold mb-1">注意</div>
                <ul className="mb-0 ps-3">
                  {meta.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </Card.Body>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : null}

      {!loading && error ? <Alert variant="danger">{error}</Alert> : null}

      {!loading && !error && rows.length === 0 ? (
        <Alert variant="secondary" className="mb-0">
          {meta && !meta.gateActive
            ? '問卷 Gate 目前未生效，無缺口名單。'
            : '目前條件下沒有「已預約但未完成問卷」的學生。'}
        </Alert>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="table-responsive">
            <Table hover size="sm" className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>學號</th>
                  <th>姓名</th>
                  <th>Email</th>
                  <th>預約筆數</th>
                  <th>最近預約時間</th>
                  <th>範例活動名稱</th>
                  <th>範例活動日期</th>
                  <th>缺口原因</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.studentId}-${r.sampleEventId || ''}`}>
                    <td>{r.studentId || '-'}</td>
                    <td>{r.studentName || '-'}</td>
                    <td className="small text-break">{displayStudentEmail(r)}</td>
                    <td>{r.reservationCount ?? '-'}</td>
                    <td className="small text-nowrap">
                      {r.latestReservedAt ? new Date(r.latestReservedAt).toLocaleString() : '-'}
                    </td>
                    <td>{r.sampleEventName || '-'}</td>
                    <td>{r.sampleEventDate || '-'}</td>
                    <td>{formatGapReason(r.gapReason)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination className="mb-0">
            <Pagination.Prev
              disabled={pagination.page <= 1}
              onClick={() => loadGaps(pagination.page - 1)}
            />
            <Pagination.Item active>
              {pagination.page} / {pagination.totalPages || 1}
            </Pagination.Item>
            <Pagination.Next
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => loadGaps(pagination.page + 1)}
            />
          </Pagination>
        </>
      ) : null}
    </>
  );
}
