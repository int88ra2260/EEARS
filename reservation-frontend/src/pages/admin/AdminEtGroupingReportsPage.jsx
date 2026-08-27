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
import { useNavigate, useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { getSemesterOptions } from '../../utils/adminReportUtils';
import {
  downloadEtBlob,
  exportEtGroupingReports,
  fetchEtGroupingReportsSummary,
} from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

export default function AdminEtGroupingReportsPage() {
  const { token, accessProfile } = useOutletContext();
  const navigate = useNavigate();
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_ET_GROUPING);
  const canView = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING)
    || canExport;

  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const [selectedSemester, setSelectedSemester] = useState(semesterOptions[0]?.value || 'all');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    if (!token || !canView) return;
    setLoading(true);
    try {
      const data = await fetchEtGroupingReportsSummary(token, {
        semester: selectedSemester,
        date: filterDate || undefined,
      });
      setSummary(data);
    } catch (e) {
      showErrorMessage(e.message || '載入場次報表失敗');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token, canView, selectedSemester, filterDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const { blob, filename } = await exportEtGroupingReports(token, {
        semester: selectedSemester,
        date: filterDate || undefined,
      });
      downloadEtBlob(blob, filename);
      showSuccessMessage('場次彙總報表已下載');
    } catch (e) {
      showErrorMessage(e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return <Alert variant="warning">您沒有檢視 ET 場次報表的權限。</Alert>;
  }

  return (
    <div className="admin-et-reports-page">
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => navigate('/admin/et-grouping/student-trends')}
        >
          學生學期趨勢
        </Button>
      </div>

      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small mb-1">學期</Form.Label>
              <Form.Select
                size="sm"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
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
            <Col md="auto" className="ms-auto d-flex gap-2">
              <Button variant="outline-secondary" size="sm" onClick={loadSummary} disabled={loading}>
                重新整理
              </Button>
              {canExport ? (
                <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting || loading}>
                  {exporting ? '匯出中…' : '匯出 Excel'}
                </Button>
              ) : null}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入報表…</span>
        </div>
      ) : null}

      {!loading && summary ? (
        <>
          <div className="small text-muted mb-2">共 {summary.totalEvents} 場 ET 活動</div>
          <Table responsive hover size="sm" className="bg-white border">
            <thead>
              <tr>
                <th>日期</th>
                <th>活動</th>
                <th>組數</th>
                <th>預約</th>
                <th>Leader</th>
                <th>已簽到</th>
                <th>任務完成率</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(summary.events || []).map((row) => (
                <tr key={row.eventId}>
                  <td>{row.date}</td>
                  <td>{row.name}</td>
                  <td>{row.groupCount}</td>
                  <td>{row.reservationCount}</td>
                  <td>
                    <Badge bg={row.leaderCount >= row.groupCount ? 'success' : 'warning'}>
                      {row.leaderCount}/{row.groupCount}
                    </Badge>
                  </td>
                  <td>{row.taskStats?.checkedIn ?? 0}</td>
                  <td>
                    {row.taskStats?.completionRate != null ? `${row.taskStats.completionRate}%` : '—'}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="link"
                      className="p-0"
                      onClick={() => navigate(`/admin/operations/${row.eventId}`)}
                    >
                      明細
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : null}
    </div>
  );
}
