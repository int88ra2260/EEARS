import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';
import Table from 'react-bootstrap/Table';
import { useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import {
  fetchEtGroupingBands,
  fetchEtLeaderCandidates,
  fetchEtLeaderPreferences,
  saveEtGroupingBands,
  saveEtLeaderPreferences,
} from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

const DEFAULT_GROUP_COUNT = 9;

const EMPTY_BAND = {
  code: '',
  label: '',
  gseMin: '',
  gseMax: '',
  cefrMin: '',
  cefrMax: '',
  maxPerTable: 12,
  tableCount: 1,
  sortOrder: 0,
  isActive: true,
};

function formatLeaderLabel(teacher) {
  if (!teacher) return '';
  if (teacher.studentId) return `${teacher.name}（${teacher.studentId}）`;
  return teacher.name;
}

function buildDefaultLeaderRows() {
  return Array.from({ length: DEFAULT_GROUP_COUNT }, (_, index) => ({
    groupLabel: `Group ${index + 1}`,
    leaderTeacherId: '',
  }));
}

function mergeLeaderRows(preferences = []) {
  const prefMap = new Map(
    preferences.map((row) => [row.groupLabel, row.leaderTeacherId || ''])
  );
  return buildDefaultLeaderRows().map((row) => ({
    groupLabel: row.groupLabel,
    leaderTeacherId: prefMap.get(row.groupLabel) || '',
  }));
}

export default function AdminEtGroupingSettingsPage() {
  const { token, accessProfile } = useOutletContext();
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);

  const [activeTab, setActiveTab] = useState('bands');
  const [loadingBands, setLoadingBands] = useState(true);
  const [savingBands, setSavingBands] = useState(false);
  const [bands, setBands] = useState([]);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [leaderRows, setLeaderRows] = useState(buildDefaultLeaderRows);
  const [leaderCandidates, setLeaderCandidates] = useState([]);

  const loadBands = useCallback(async () => {
    if (!token || !canManage) return;
    setLoadingBands(true);
    try {
      const rows = await fetchEtGroupingBands(token);
      setBands(rows?.length ? rows : [{ ...EMPTY_BAND }]);
    } catch (e) {
      showErrorMessage(e.message || '載入分組帶設定失敗');
      setBands([{ ...EMPTY_BAND }]);
    } finally {
      setLoadingBands(false);
    }
  }, [token, canManage]);

  const loadPreferences = useCallback(async () => {
    if (!token || !canManage) return;
    setLoadingPrefs(true);
    try {
      const rows = await fetchEtLeaderPreferences(token);
      setLeaderRows(mergeLeaderRows(rows));
    } catch (e) {
      showErrorMessage(e.message || '載入 Leader 偏好失敗');
      setLeaderRows(buildDefaultLeaderRows());
    } finally {
      setLoadingPrefs(false);
    }
  }, [token, canManage]);

  useEffect(() => {
    loadBands();
    loadPreferences();
    fetchEtLeaderCandidates(token)
      .then((rows) => setLeaderCandidates(rows || []))
      .catch(() => setLeaderCandidates([]));
  }, [token, loadBands, loadPreferences]);

  const updateBand = (index, key, value) => {
    setBands((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addBand = () => {
    setBands((prev) => [...prev, { ...EMPTY_BAND, sortOrder: (prev.length + 1) * 10 }]);
  };

  const handleSaveBands = async () => {
    setSavingBands(true);
    try {
      const payload = bands
        .filter((row) => String(row.code || '').trim() && String(row.label || '').trim())
        .map((row, index) => ({
          code: row.code.trim(),
          label: row.label.trim(),
          gseMin: row.gseMin === '' || row.gseMin == null ? null : Number(row.gseMin),
          gseMax: row.gseMax === '' || row.gseMax == null ? null : Number(row.gseMax),
          cefrMin: row.cefrMin || null,
          cefrMax: row.cefrMax || null,
          maxPerTable: Math.max(1, Number(row.maxPerTable) || 12),
          tableCount: Math.max(1, Number(row.tableCount) || 1),
          sortOrder: Number(row.sortOrder) || (index + 1) * 10,
          isActive: row.isActive !== false,
        }));
      const data = await saveEtGroupingBands(token, payload);
      setBands(data?.length ? data : payload);
      showSuccessMessage('分組帶設定已儲存');
    } catch (e) {
      showErrorMessage(e.message || '儲存分組帶設定失敗');
    } finally {
      setSavingBands(false);
    }
  };

  const updateLeaderRow = (index, leaderTeacherId) => {
    setLeaderRows((prev) => prev.map((row, i) => (
      i === index ? { ...row, leaderTeacherId: leaderTeacherId ? Number(leaderTeacherId) : '' } : row
    )));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const payload = leaderRows
        .filter((row) => row.leaderTeacherId)
        .map((row) => ({
          groupLabel: row.groupLabel,
          leaderTeacherId: Number(row.leaderTeacherId),
        }));
      if (!payload.length) {
        showErrorMessage('請至少指派一位 Leader 偏好');
        return;
      }
      const data = await saveEtLeaderPreferences(token, payload);
      setLeaderRows(mergeLeaderRows(data));
      showSuccessMessage('學期 Leader 偏好已儲存');
    } catch (e) {
      showErrorMessage(e.message || '儲存 Leader 偏好失敗');
    } finally {
      setSavingPrefs(false);
    }
  };

  const leaderHint = useMemo(() => (
    '此為全域預設偏好。活動與預約 → 管理 Leaders 可套用至單場或批次套用；指派時勾選「記住學期偏好」也會更新此處。'
  ), []);

  if (!canManage) {
    return <Alert variant="warning">您沒有 ET 分組管理權限。</Alert>;
  }

  return (
    <div className="admin-et-grouping-settings-page">
      <Alert variant="light" className="border mb-3">
        設定 GSE 能力分組帶區間與學期 Leader 預設指派。變更分組帶後，需至各場活動重新產生能力分組才會生效。
      </Alert>

      <Tab.Container activeKey={activeTab} onSelect={(key) => setActiveTab(key || 'bands')}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="bands">分組帶設定</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="leaders">Leader 偏好</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="bands">
            <Card className="border-0 shadow-sm">
              <Card.Body>
                {loadingBands ? (
                  <div className="d-flex align-items-center gap-2 py-3">
                    <Spinner animation="border" size="sm" />
                    <span>載入分組帶…</span>
                  </div>
                ) : (
                  <>
                    <Table responsive size="sm" className="align-middle mb-3">
                      <thead>
                        <tr>
                          <th>代碼</th>
                          <th>名稱</th>
                          <th>GSE 下限</th>
                          <th>GSE 上限</th>
                          <th>CEFR 下限</th>
                          <th>CEFR 上限</th>
                          <th>每桌人數</th>
                          <th>桌數</th>
                          <th>排序</th>
                          <th>啟用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bands.map((row, index) => (
                          <tr key={row.id || `band-${index}`}>
                            <td>
                              <Form.Control
                                size="sm"
                                value={row.code || ''}
                                onChange={(e) => updateBand(index, 'code', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                value={row.label || ''}
                                onChange={(e) => updateBand(index, 'label', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                value={row.gseMin ?? ''}
                                onChange={(e) => updateBand(index, 'gseMin', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                value={row.gseMax ?? ''}
                                onChange={(e) => updateBand(index, 'gseMax', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                value={row.cefrMin || ''}
                                onChange={(e) => updateBand(index, 'cefrMin', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                value={row.cefrMax || ''}
                                onChange={(e) => updateBand(index, 'cefrMax', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                min={1}
                                value={row.maxPerTable ?? 12}
                                onChange={(e) => updateBand(index, 'maxPerTable', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                min={1}
                                value={row.tableCount ?? 1}
                                onChange={(e) => updateBand(index, 'tableCount', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Control
                                size="sm"
                                type="number"
                                value={row.sortOrder ?? 0}
                                onChange={(e) => updateBand(index, 'sortOrder', e.target.value)}
                              />
                            </td>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={row.isActive !== false}
                                onChange={(e) => updateBand(index, 'isActive', e.target.checked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    <div className="d-flex flex-wrap gap-2">
                      <Button variant="outline-secondary" size="sm" onClick={addBand}>
                        新增分組帶
                      </Button>
                      <Button variant="primary" size="sm" disabled={savingBands} onClick={handleSaveBands}>
                        {savingBands ? '儲存中…' : '儲存分組帶'}
                      </Button>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Tab.Pane>

          <Tab.Pane eventKey="leaders">
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <p className="small text-muted">{leaderHint}</p>
                {loadingPrefs ? (
                  <div className="d-flex align-items-center gap-2 py-3">
                    <Spinner animation="border" size="sm" />
                    <span>載入 Leader 偏好…</span>
                  </div>
                ) : (
                  <>
                    <Row className="g-2 mb-3">
                      {leaderRows.map((row, index) => (
                        <Col key={row.groupLabel} md={4} lg={3}>
                          <Form.Label className="small mb-1">{row.groupLabel}</Form.Label>
                          <Form.Select
                            size="sm"
                            value={row.leaderTeacherId || ''}
                            onChange={(e) => updateLeaderRow(index, e.target.value)}
                          >
                            <option value="">— 未指派 —</option>
                            {leaderCandidates.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {formatLeaderLabel(teacher)}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                      ))}
                    </Row>
                    <Button variant="primary" size="sm" disabled={savingPrefs} onClick={handleSavePreferences}>
                      {savingPrefs ? '儲存中…' : '儲存 Leader 偏好'}
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
}
