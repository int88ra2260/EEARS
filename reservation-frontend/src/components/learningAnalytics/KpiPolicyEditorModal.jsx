import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';

const PASS_MODES = [
  { value: 'sum_raw', label: '合計達標（sum_raw）' },
  { value: 'both_cefr', label: '兩科 CEFR 皆過（both_cefr）' },
  { value: 'sum_and_section_mins', label: '合計＋分項門檻（嚴版）' },
];

const TIME_WINDOWS = [
  { value: 'lifetime', label: '不限時間（lifetime）' },
  { value: 'academic_year', label: '限政策學年日期窗' },
  { value: 'date_range', label: '自訂日期區間（進階）' },
];

const SKILL_META = [
  { skill: 'listening', label: '聽力' },
  { skill: 'reading', label: '閱讀' },
  { skill: 'speaking', label: '口說' },
  { skill: 'writing', label: '寫作' },
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function slugifyKey(name) {
  const base = String(name || 'policy')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const ascii = base.replace(/[^\w-]/g, '') || 'custom-policy';
  return `${ascii}-${Date.now().toString(36).slice(-4)}`;
}

export function flattenInstrumentRows(instruments) {
  const rows = [];
  Object.entries(instruments || {}).forEach(([code, cfg]) => {
    Object.entries(cfg?.pairs || {}).forEach(([pairKey, rule]) => {
      rows.push({
        code,
        label: cfg.label || code,
        pairKey,
        passMode: rule.passMode || 'sum_raw',
        minTotal: rule.minTotal != null ? rule.minTotal : '',
        minCefrRank: rule.minCefrRank != null ? rule.minCefrRank : 4,
        note: rule.note || '',
        skills: Array.isArray(rule.skills) ? rule.skills : [],
      });
    });
  });
  return rows;
}

export function applyInstrumentRows(baseInstruments, rows) {
  const next = deepClone(baseInstruments);
  rows.forEach((row) => {
    if (!next[row.code]) {
      next[row.code] = { label: row.label || row.code, pairs: {} };
    }
    if (!next[row.code].pairs) next[row.code].pairs = {};
    const prev = next[row.code].pairs[row.pairKey] || {};
    next[row.code].pairs[row.pairKey] = {
      ...prev,
      skills: row.skills?.length
        ? row.skills
        : (row.pairKey === 'SW' ? ['speaking', 'writing'] : ['listening', 'reading']),
      passMode: row.passMode,
      minTotal: row.minTotal === '' || row.minTotal == null ? undefined : Number(row.minTotal),
      minCefrRank: row.minCefrRank === '' || row.minCefrRank == null
        ? undefined
        : Number(row.minCefrRank),
      note: row.note || prev.note || '',
    };
  });
  return next;
}

function buildPairDimensions() {
  return [
    {
      id: 'lr_pair',
      label: '聽讀達標',
      skills: ['listening', 'reading'],
      kind: 'pair',
      requireCompleteSkills: true,
      proofSelection: 'highest_combined',
    },
    {
      id: 'sw_pair',
      label: '說寫達標',
      skills: ['speaking', 'writing'],
      kind: 'pair',
      requireCompleteSkills: true,
      proofSelection: 'highest_combined',
    },
  ];
}

function buildSkillDimensions(skillRows = []) {
  const bySkill = new Map((skillRows || []).map((r) => [r.skill, r]));
  return SKILL_META.map(({ skill, label }) => {
    const row = bySkill.get(skill);
    const rank = row?.minCefrRank != null && row.minCefrRank !== ''
      ? Number(row.minCefrRank)
      : 4;
    return {
      id: skill,
      label: `${label}達標`,
      skills: [skill],
      kind: 'skill',
      requireCompleteSkills: true,
      proofSelection: 'highest_rank',
      minCefrRank: Number.isFinite(rank) ? rank : 4,
    };
  });
}

function skillRowsFromDefinition(definition = {}) {
  const dims = Array.isArray(definition.dimensions) ? definition.dimensions : [];
  return SKILL_META.map(({ skill, label }) => {
    const dim = dims.find((d) => d.kind === 'skill' && (d.id === skill || d.skills?.[0] === skill));
    return {
      skill,
      label,
      minCefrRank: dim?.minCefrRank != null ? Number(dim.minCefrRank) : 4,
    };
  });
}

function buildDefinitionFromForm({
  sourceDefinition,
  dimensionPreset,
  timeWindow,
  academicYear,
  includeSkillBreakdown,
  notesText,
  instrumentRows,
  skillRows,
  gradeMin,
  gradeMax,
}) {
  const base = deepClone(sourceDefinition || {});
  // 成對政策才寫入 instruments 成對門檻；單項政策保留既有 instruments 供之後切回成對用
  const instruments = dimensionPreset === 'pair'
    ? applyInstrumentRows(base.instruments || {}, instrumentRows)
    : (base.instruments || {});

  const resolvedDimensions = dimensionPreset === 'skill'
    ? buildSkillDimensions(skillRows)
    : buildPairDimensions();

  const notes = String(notesText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const min = gradeMin === '' || gradeMin == null ? null : Number(gradeMin);
  const max = gradeMax === '' || gradeMax == null ? null : Number(gradeMax);

  return {
    ...base,
    schemaVersion: base.schemaVersion || 'kpi-policy.v1',
    academicYearLabel: academicYear || base.academicYearLabel || null,
    population: {
      ...(base.population || {}),
      gradeMin: Number.isFinite(min) ? min : null,
      gradeMax: Number.isFinite(max) ? max : null,
      note: (Number.isFinite(min) || Number.isFinite(max))
        ? `依選定學期在學名冊年級：${Number.isFinite(min) ? `大${min}` : '?'}${Number.isFinite(max) ? `至大${max}` : '以上'}`
        : '不限年級（名冊全體）',
    },
    evidence: {
      ...(base.evidence || {}),
      timeWindow: timeWindow || 'lifetime',
      status: 'valid',
      sittingKey: 'attemptId',
      academicYear: academicYear || base.evidence?.academicYear || null,
    },
    dimensions: resolvedDimensions,
    includeSkillBreakdown: dimensionPreset === 'pair'
      ? Boolean(includeSkillBreakdown)
      : false,
    instruments,
    notes,
  };
}

export default function KpiPolicyEditorModal({
  show,
  mode,
  policy = null,
  templatePolicy = null,
  onHide,
  onSubmit,
}) {
  const source = mode === 'edit' ? policy : (templatePolicy || policy);
  const readOnlyBuiltin = mode === 'edit' && policy?.isBuiltin;

  const [name, setName] = useState('');
  const [policyKey, setPolicyKey] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [description, setDescription] = useState('');
  const [timeWindow, setTimeWindow] = useState('lifetime');
  const [includeSkillBreakdown, setIncludeSkillBreakdown] = useState(true);
  const [dimensionPreset, setDimensionPreset] = useState('pair');
  const [notesText, setNotesText] = useState('');
  const [instrumentRows, setInstrumentRows] = useState([]);
  const [skillRows, setSkillRows] = useState(skillRowsFromDefinition());
  const [gradeMin, setGradeMin] = useState('');
  const [gradeMax, setGradeMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!show) return;
    const def = source?.definition || {};
    setName(mode === 'create'
      ? (source ? `${source.name || '政策'}（新建）` : '自訂 KPI 政策')
      : (source?.name || ''));
    setPolicyKey(mode === 'create'
      ? slugifyKey(source?.policyKey || source?.name || 'custom-kpi')
      : (source?.policyKey || ''));
    setAcademicYear(source?.academicYear || def.academicYearLabel || '');
    setDescription(source?.description || '');
    setTimeWindow(def.evidence?.timeWindow || 'lifetime');
    setIncludeSkillBreakdown(def.includeSkillBreakdown !== false);
    const kinds = (def.dimensions || []).map((d) => d.kind);
    const preset = kinds.includes('skill') && !kinds.includes('pair')
      ? 'skill'
      : (kinds.includes('pair') ? 'pair' : 'pair');
    setDimensionPreset(preset);
    setNotesText(Array.isArray(def.notes) ? def.notes.join('\n') : '');
    setGradeMin(def.population?.gradeMin != null ? String(def.population.gradeMin) : '');
    setGradeMax(def.population?.gradeMax != null ? String(def.population.gradeMax) : '');
    setInstrumentRows(flattenInstrumentRows(def.instruments));
    setSkillRows(skillRowsFromDefinition(def));
    setFormError('');
    setSaving(false);
  }, [show, mode, source]);

  const title = useMemo(() => {
    if (readOnlyBuiltin) return '內建政策（唯讀）';
    return mode === 'create' ? '新建 KPI 政策' : '編輯 KPI 政策';
  }, [mode, readOnlyBuiltin]);

  const updateInstrumentRow = (index, patch) => {
    setInstrumentRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const updateSkillRow = (index, patch) => {
    setSkillRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    if (readOnlyBuiltin) return;
    if (!name.trim()) {
      setFormError('請填寫政策名稱');
      return;
    }
    if (mode === 'create' && !policyKey.trim()) {
      setFormError('請填寫政策鍵（policyKey）');
      return;
    }
    if (dimensionPreset === 'pair' && instrumentRows.length === 0) {
      setFormError('成對政策需要英檢成對門檻列，請以既有政策為範本再建。');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const definition = buildDefinitionFromForm({
        sourceDefinition: source?.definition,
        dimensionPreset,
        timeWindow,
        academicYear: academicYear.trim() || null,
        includeSkillBreakdown,
        notesText,
        instrumentRows,
        skillRows,
        gradeMin,
        gradeMax,
      });
      const payload = {
        name: name.trim(),
        academicYear: academicYear.trim() || null,
        description: description.trim() || null,
        definition,
      };
      if (mode === 'create') {
        payload.policyKey = policyKey.trim();
      }
      await onSubmit(payload);
      onHide();
    } catch (e) {
      setFormError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {readOnlyBuiltin ? (
          <Alert variant="warning" className="mb-3">
            這是內建政策，不可直接修改或封存。請先「複製政策」再編輯副本。
          </Alert>
        ) : null}
        {formError ? <Alert variant="danger">{formError}</Alert> : null}

        <div className="row g-3">
          <div className="col-md-6">
            <Form.Label>政策名稱</Form.Label>
            <Form.Control
              value={name}
              disabled={readOnlyBuiltin}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <Form.Label>政策鍵（唯一）</Form.Label>
            <Form.Control
              value={policyKey}
              disabled={mode === 'edit' || readOnlyBuiltin}
              onChange={(e) => setPolicyKey(e.target.value)}
            />
            {mode === 'edit' ? (
              <div className="form-text">建立後不可改 policyKey。</div>
            ) : null}
          </div>
          <div className="col-md-4">
            <Form.Label>學年標籤</Form.Label>
            <Form.Control
              value={academicYear}
              placeholder="例：115"
              disabled={readOnlyBuiltin}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <Form.Label>成績時間窗</Form.Label>
            <Form.Select
              value={timeWindow}
              disabled={readOnlyBuiltin}
              onChange={(e) => setTimeWindow(e.target.value)}
            >
              {TIME_WINDOWS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>達標單元</Form.Label>
            <Form.Select
              value={dimensionPreset}
              disabled={readOnlyBuiltin}
              onChange={(e) => setDimensionPreset(e.target.value)}
            >
              <option value="pair">聽讀／說寫兩欄（同場合計）</option>
              <option value="skill">聽／讀／說／寫四欄（單項）</option>
            </Form.Select>
            <div className="form-text">
              {dimensionPreset === 'skill'
                ? '下方改為四技能單項 CEFR 門檻（不成對）。'
                : '下方為各英檢 LR／SW 成對門檻。'}
            </div>
          </div>
          <div className="col-md-4">
            <Form.Label>名冊年級（起）</Form.Label>
            <Form.Select
              value={gradeMin}
              disabled={readOnlyBuiltin}
              onChange={(e) => setGradeMin(e.target.value)}
            >
              <option value="">不限</option>
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{`大${g}`}</option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>名冊年級（迄）</Form.Label>
            <Form.Select
              value={gradeMax}
              disabled={readOnlyBuiltin}
              onChange={(e) => setGradeMax(e.target.value)}
            >
              <option value="">不限</option>
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{`大${g}`}</option>
              ))}
            </Form.Select>
            <div className="form-text">
              依「選定學期」在學名冊的年級篩選（例：115 學年官方為大二至大四）。
            </div>
          </div>
          {dimensionPreset === 'pair' ? (
            <div className="col-md-4 d-flex align-items-end">
              <Form.Check
                type="switch"
                id="kpi-include-skill-breakdown"
                label="附分項對照（單項 B2）"
                checked={includeSkillBreakdown}
                disabled={readOnlyBuiltin}
                onChange={(e) => setIncludeSkillBreakdown(e.target.checked)}
              />
            </div>
          ) : null}
          <div className="col-12">
            <Form.Label>說明</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={description}
              disabled={readOnlyBuiltin}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="col-12">
            <Form.Label>備註（每行一則，會印在報表）</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notesText}
              disabled={readOnlyBuiltin}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
        </div>

        {dimensionPreset === 'skill' ? (
          <>
            <h6 className="mt-4 mb-2">單項門檻（聽／讀／說／寫）</h6>
            <p className="small text-muted mb-2">
              各技能以歷史最佳 CEFR rank 判定（預設 4＝B2）。不同英檢分數會先換成 CEFR，再與門檻比較，因此這裡不成對、也不填合計分。
            </p>
            <div className="table-responsive">
              <Table size="sm" bordered hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>技能</th>
                    <th>CEFR rank 門檻</th>
                    <th>說明</th>
                  </tr>
                </thead>
                <tbody>
                  {skillRows.map((row, index) => (
                    <tr key={row.skill}>
                      <td className="fw-semibold">{row.label}</td>
                      <td style={{ maxWidth: 120 }}>
                        <Form.Control
                          size="sm"
                          type="number"
                          min={1}
                          max={6}
                          value={row.minCefrRank}
                          disabled={readOnlyBuiltin}
                          onChange={(e) => updateSkillRow(index, { minCefrRank: e.target.value })}
                        />
                      </td>
                      <td className="small text-muted">
                        {Number(row.minCefrRank) >= 4 ? '達 B2 以上' : `rank ≥ ${row.minCefrRank}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        ) : (
          <>
            <h6 className="mt-4 mb-2">成對門檻（聽讀／說寫）</h6>
            <p className="small text-muted mb-2">
              同一次測驗內，依各英檢的 LR 或 SW 規則判定（合計或兩科 CEFR）。
            </p>
            <div className="table-responsive">
              <Table size="sm" bordered hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>工具</th>
                    <th>成對</th>
                    <th>判定方式</th>
                    <th>合計門檻</th>
                    <th>CEFR rank</th>
                  </tr>
                </thead>
                <tbody>
                  {instrumentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted">尚無門檻列（請從既有政策複製再建）</td>
                    </tr>
                  ) : instrumentRows.map((row, index) => (
                    <tr key={`${row.code}-${row.pairKey}`}>
                      <td>
                        <div className="fw-semibold">{row.code}</div>
                        <div className="small text-muted">{row.label}</div>
                      </td>
                      <td>{row.pairKey}</td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={row.passMode}
                          disabled={readOnlyBuiltin}
                          onChange={(e) => updateInstrumentRow(index, { passMode: e.target.value })}
                        >
                          {PASS_MODES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Form.Select>
                      </td>
                      <td style={{ minWidth: 96 }}>
                        <Form.Control
                          size="sm"
                          type="number"
                          value={row.minTotal}
                          disabled={readOnlyBuiltin || row.passMode === 'both_cefr'}
                          onChange={(e) => updateInstrumentRow(index, { minTotal: e.target.value })}
                        />
                      </td>
                      <td style={{ minWidth: 88 }}>
                        <Form.Control
                          size="sm"
                          type="number"
                          value={row.minCefrRank}
                          disabled={readOnlyBuiltin || row.passMode === 'sum_raw'}
                          onChange={(e) => updateInstrumentRow(index, { minCefrRank: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>
          關閉
        </Button>
        {!readOnlyBuiltin ? (
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                儲存中…
              </>
            ) : '儲存'}
          </Button>
        ) : null}
      </Modal.Footer>
    </Modal>
  );
}
