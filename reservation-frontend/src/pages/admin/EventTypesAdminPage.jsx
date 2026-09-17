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
import {
  createAdminEventType,
  deleteAdminEventType,
  fetchAdminEventTypes,
  setAdminEventTypeActive,
  updateAdminEventType,
} from '../../services/eventTypeApi';
import { OPEN_RULE_TYPES, CAPACITY_MODES } from '../../constants/eventTypeCatalog';

const EMPTY_FORM = {
  code: '',
  displayName: '',
  abbreviation: '',
  slug: '',
  sortOrder: 100,
  isActive: true,
  openRuleType: OPEN_RULE_TYPES.DAY_BEFORE,
  openDays: 1,
  openWeekday: 3,
  openHour: 12,
  openMinute: 0,
  cutoffHours: 2,
  capacityMode: CAPACITY_MODES.SIMPLE,
  surveyGateEnabled: false,
  defaultGroupCount: 9,
  defaultPerGroupCapacity: 4,
  maxCapacityCap: 100,
};

function formFromRow(row) {
  if (!row) return { ...EMPTY_FORM };
  const rule = row.openRule || {};
  return {
    code: row.code,
    displayName: row.displayName || '',
    abbreviation: row.abbreviation || '',
    slug: row.slug || '',
    sortOrder: row.sortOrder ?? 100,
    isActive: row.isActive !== false,
    openRuleType: rule.type || OPEN_RULE_TYPES.DAY_BEFORE,
    openDays: rule.days ?? 1,
    openWeekday: rule.weekday ?? 3,
    openHour: rule.hour ?? 12,
    openMinute: rule.minute ?? 0,
    cutoffHours: row.cutoffHours ?? 2,
    capacityMode: row.capacityMode || CAPACITY_MODES.SIMPLE,
    surveyGateEnabled: !!row.surveyGateEnabled,
    defaultGroupCount: row.defaultGroupCount ?? 9,
    defaultPerGroupCapacity: row.defaultPerGroupCapacity ?? 4,
    maxCapacityCap: row.maxCapacityCap ?? 100,
  };
}

function payloadFromForm(form, { isCreate }) {
  const openRule = { type: form.openRuleType, hour: Number(form.openHour), minute: Number(form.openMinute) };
  if (form.openRuleType === OPEN_RULE_TYPES.PREV_WEEKDAY) {
    openRule.weekday = Number(form.openWeekday);
  } else {
    openRule.days = Number(form.openDays);
  }
  return {
    ...(isCreate ? { code: String(form.code || '').trim() } : {}),
    displayName: form.displayName,
    abbreviation: form.abbreviation,
    slug: form.slug,
    sortOrder: Number(form.sortOrder),
    isActive: !!form.isActive,
    openRule,
    cutoffHours: Number(form.cutoffHours),
    capacityMode: form.capacityMode,
    surveyGateEnabled: !!form.surveyGateEnabled,
    defaultGroupCount: form.capacityMode === CAPACITY_MODES.GROUPED ? Number(form.defaultGroupCount) : null,
    defaultPerGroupCapacity: form.capacityMode === CAPACITY_MODES.GROUPED ? Number(form.defaultPerGroupCapacity) : null,
    maxCapacityCap: Number(form.maxCapacityCap) || null,
  };
}

function describeRule(row) {
  const rule = row.openRule || {};
  const cutoff = Number(row.cutoffHours);
  const cutoffLabel = Number.isFinite(cutoff) ? `截止前 ${cutoff} 小時` : '';
  if (rule.type === OPEN_RULE_TYPES.DAYS_BEFORE) {
    return `前 ${rule.days} 天 ${rule.hour}:${String(rule.minute || 0).padStart(2, '0')} 開放；${cutoffLabel}`;
  }
  if (rule.type === OPEN_RULE_TYPES.PREV_WEEKDAY) {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return `上週${names[rule.weekday] || '?'} ${rule.hour}:${String(rule.minute || 0).padStart(2, '0')} 開放；${cutoffLabel}`;
  }
  return `前 ${rule.days ?? 1} 天 ${rule.hour}:${String(rule.minute || 0).padStart(2, '0')} 開放；${cutoffLabel}`;
}

export default function EventTypesAdminPage() {
  const token = localStorage.getItem('token') || '';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminEventTypes(token);
      setRows(data);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!creating && !editingCode) return;
    const id = requestAnimationFrame(() => {
      document.getElementById('event-type-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [creating, editingCode]);

  const editingRow = useMemo(
    () => rows.find((r) => r.code === editingCode) || null,
    [rows, editingCode]
  );

  const startCreate = () => {
    setCreating(true);
    setEditingCode(null);
    setForm({ ...EMPTY_FORM });
  };

  const startEdit = (row) => {
    setCreating(false);
    setEditingCode(row.code);
    setForm(formFromRow(row));
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditingCode(null);
    setForm(EMPTY_FORM);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (creating) {
        await createAdminEventType(token, payloadFromForm(form, { isCreate: true }));
      } else if (editingCode) {
        await updateAdminEventType(token, editingCode, payloadFromForm(form, { isCreate: false }));
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setError('');
    try {
      await setAdminEventTypeActive(token, row.code, !row.isActive);
      await load();
    } catch (err) {
      setError(err.message || '更新失敗');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`確定刪除「${row.displayName}」？僅在無活動引用時可刪。`)) return;
    setError('');
    try {
      await deleteAdminEventType(token, row.code);
      if (editingCode === row.code) cancelEdit();
      await load();
    } catch (err) {
      setError(err.message || '刪除失敗');
    }
  };

  const showForm = creating || !!editingRow;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">活動類型設定</h1>
          <p className="text-muted small mb-0">
            管理類型 code、預約開放規則、截止時數、名額模式與問卷 Gate。預約／公開取消共用 cutoffHours。
            使用右上角「新增類型」建立新類型；列表右側可「停用」或「刪除」（無活動引用時才可刪）。停用後學生端日曆與活動介紹不再顯示該類型。
          </p>
        </div>
        <Button variant="primary" onClick={startCreate} disabled={creating}>
          新增類型
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="py-5 text-center"><Spinner animation="border" /></div>
      ) : (
        <Card className="mb-3">
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>code</th>
                  <th>名稱</th>
                  <th>規則</th>
                  <th>名額</th>
                  <th>Gate</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <td><code>{row.code}</code></td>
                    <td>
                      {row.displayName}
                      {row.abbreviation ? <span className="text-muted ms-1">({row.abbreviation})</span> : null}
                    </td>
                    <td className="small">{describeRule(row)}</td>
                    <td className="small">{row.capacityMode}</td>
                    <td>{row.surveyGateEnabled ? <Badge bg="info">on</Badge> : <Badge bg="secondary">off</Badge>}</td>
                    <td>{row.isActive ? <Badge bg="success">啟用</Badge> : <Badge bg="secondary">停用</Badge>}</td>
                    <td className="text-nowrap text-end">
                      <Button size="sm" variant="outline-primary" className="me-1" onClick={() => startEdit(row)}>編輯</Button>
                      <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => toggleActive(row)}>
                        {row.isActive ? '停用' : '啟用'}
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => remove(row)}>刪除</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {!showForm && !loading ? (
        <Alert variant="light" className="border small mb-0">
          列表僅顯示摘要。請點該列的<strong>編輯</strong>，即可調整「預約時間規則」「名額模式」「問卷 Gate」。
        </Alert>
      ) : null}

      {showForm ? (
        <Card id="event-type-edit-form" className="border-primary">
          <Card.Header className="bg-primary-subtle">
            {creating ? '新增活動類型' : `編輯：${form.displayName || editingCode}`}
          </Card.Header>
          <Card.Body>
            <Form onSubmit={save}>
              <h2 className="h6 text-uppercase text-muted mb-3">基本資料</h2>
              <Row className="g-3 mb-4">
                {creating ? (
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>code（建立後不可改）</Form.Label>
                      <Form.Control
                        value={form.code}
                        onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                        placeholder="workshop"
                        required
                        pattern="[a-z][a-z0-9_]{1,63}"
                      />
                    </Form.Group>
                  </Col>
                ) : null}
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>顯示名稱</Form.Label>
                    <Form.Control
                      value={form.displayName}
                      onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>簡稱</Form.Label>
                    <Form.Control
                      value={form.abbreviation}
                      onChange={(e) => setForm((p) => ({ ...p, abbreviation: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>slug</Form.Label>
                    <Form.Control
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>排序</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3} className="d-flex align-items-end">
                  <Form.Check
                    type="switch"
                    id="event-type-active"
                    label="啟用此類型"
                    checked={!!form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                </Col>
              </Row>

              <h2 className="h6 text-uppercase text-muted mb-2">預約時間規則</h2>
              <p className="small text-muted mb-3">
                決定學生何時可開始預約，以及活動開始前多久截止（預約與公開取消共用）。
              </p>
              <Row className="g-3 mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>開放規則類型</Form.Label>
                    <Form.Select
                      value={form.openRuleType}
                      onChange={(e) => setForm((p) => ({ ...p, openRuleType: e.target.value }))}
                    >
                      <option value={OPEN_RULE_TYPES.DAY_BEFORE}>N 天前（日曆日，含前一天）</option>
                      <option value={OPEN_RULE_TYPES.DAYS_BEFORE}>N 天前（同 weekday，如 Job Talk）</option>
                      <option value={OPEN_RULE_TYPES.PREV_WEEKDAY}>上週指定星期（如 English Club）</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                {form.openRuleType === OPEN_RULE_TYPES.PREV_WEEKDAY ? (
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>星期（0=日 … 6=六）</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        max={6}
                        value={form.openWeekday}
                        onChange={(e) => setForm((p) => ({ ...p, openWeekday: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                ) : (
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>開放前天數 N</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        max={60}
                        value={form.openDays}
                        onChange={(e) => setForm((p) => ({ ...p, openDays: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                )}
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>開放時刻（時）</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={23}
                      value={form.openHour}
                      onChange={(e) => setForm((p) => ({ ...p, openHour: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>開放時刻（分）</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={59}
                      value={form.openMinute}
                      onChange={(e) => setForm((p) => ({ ...p, openMinute: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>截止時數（小時）</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={72}
                      step={0.5}
                      value={form.cutoffHours}
                      onChange={(e) => setForm((p) => ({ ...p, cutoffHours: e.target.value }))}
                      required
                    />
                    <Form.Text>活動開始前 N 小時關閉預約／取消（預設 2）</Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <h2 className="h6 text-uppercase text-muted mb-2">名額模式</h2>
              <p className="small text-muted mb-3">
                simple＝單一總人數；grouped＝組數 × 每組人數（如 English Table）。
              </p>
              <Row className="g-3 mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>名額模式</Form.Label>
                    <Form.Select
                      value={form.capacityMode}
                      onChange={(e) => setForm((p) => ({ ...p, capacityMode: e.target.value }))}
                    >
                      <option value={CAPACITY_MODES.SIMPLE}>simple（總人數）</option>
                      <option value={CAPACITY_MODES.GROUPED}>grouped（組數 × 每組）</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>人數上限（硬上限）</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={form.maxCapacityCap}
                      onChange={(e) => setForm((p) => ({ ...p, maxCapacityCap: e.target.value }))}
                    />
                  </Form.Group>
                </Col>
                {form.capacityMode === CAPACITY_MODES.GROUPED ? (
                  <>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>預設組數</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          max={20}
                          value={form.defaultGroupCount}
                          onChange={(e) => setForm((p) => ({ ...p, defaultGroupCount: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>預設每組人數</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          max={30}
                          value={form.defaultPerGroupCapacity}
                          onChange={(e) => setForm((p) => ({ ...p, defaultPerGroupCapacity: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                  </>
                ) : null}
              </Row>

              <h2 className="h6 text-uppercase text-muted mb-2">問卷 Gate</h2>
              <p className="small text-muted mb-3">
                啟用後，此類型活動在預約前會依問卷規則檢查（未完成則擋下並導向問卷）。
              </p>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="survey-gate"
                    label="啟用問卷 Gate"
                    checked={!!form.surveyGateEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, surveyGateEnabled: e.target.checked }))}
                  />
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-4">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? '儲存中…' : '儲存'}
                </Button>
                <Button type="button" variant="outline-secondary" onClick={cancelEdit} disabled={saving}>
                  取消
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  );
}
