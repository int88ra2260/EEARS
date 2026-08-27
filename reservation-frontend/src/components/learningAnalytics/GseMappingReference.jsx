import React, { useState } from 'react';
import Collapse from 'react-bootstrap/Collapse';

function formatGseRange(min, max) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}

function ExamMappingDetail({ mapping }) {
  if (mapping.mappingType === 'score_anchors') {
    const skills = Object.entries(mapping.skills || {});
    if (!skills.length) return <p className="small text-muted mb-0">無錨點資料</p>;
    return (
      <div className="table-responsive">
        {skills.map(([skill, anchors]) => (
          <div key={skill} className="mb-2">
            <div className="small fw-semibold text-capitalize">{skill}</div>
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>原始分 ≥</th>
                  <th className="text-end">GSE</th>
                </tr>
              </thead>
              <tbody>
                {(anchors || []).map((anchor) => (
                  <tr key={`${skill}-${anchor.rawMin}-${anchor.gse}`}>
                    <td>{anchor.rawMin}</td>
                    <td className="text-end">{anchor.gse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  const levels = mapping.levels || [];
  if (!levels.length) return <p className="small text-muted mb-0">無等級對照</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>等級／模式</th>
            <th>CEFR</th>
            <th className="text-end">GSE 中位</th>
            <th className="text-end">GSE 區間</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((row) => (
            <tr key={`${row.cefr}-${(row.patterns || []).join('|')}`}>
              <td className="small">{(row.patterns || []).join('、')}</td>
              <td>{row.cefr}</td>
              <td className="text-end">{row.gseMidpoint ?? '—'}</td>
              <td className="text-end">
                {formatGseRange(row.gseRange?.gseMin, row.gseRange?.gseMax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExamMappingSection({ mapping }) {
  const [open, setOpen] = useState(false);
  const confidenceLabel = mapping.confidence === 'official' ? '官方對照' : '估計對照';

  return (
    <div className="border rounded mb-2">
      <button
        type="button"
        className="w-100 text-start border-0 bg-transparent px-3 py-2 d-flex flex-wrap align-items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="la-settings-section__chevron" aria-hidden>{open ? '▼' : '▶'}</span>
        <span className="fw-semibold small">{mapping.label || mapping.examType}</span>
        <span className="la-tag la-tag-pastel-yellow">{confidenceLabel}</span>
        <span className="small text-muted ms-auto">{mapping.mappingType === 'score_anchors' ? '分數錨點' : '等級中位'}</span>
      </button>
      <Collapse in={open}>
        <div className="px-3 pb-3">
          <p className="small text-muted mb-2">
            來源：{mapping.source || '—'}
            {mapping.version ? ` · 版本 ${mapping.version}` : ''}
          </p>
          <ExamMappingDetail mapping={mapping} />
        </div>
      </Collapse>
    </div>
  );
}

/**
 * 唯讀顯示 GSE 對照參考（來自設定 API 的 gseMapping）
 */
export default function GseMappingReference({ gseMapping, embedded = false }) {
  if (!gseMapping) return null;

  const { cefrBands = [], examMappings = [], scaleRange, references = [], version, verifiedAt, toeflIbtCutoffDate } = gseMapping;

  const meta = (
    <p className="small text-muted mb-3">
      GSE 量尺 {formatGseRange(scaleRange?.min, scaleRange?.max)}
      {version ? ` · 對照版本 ${version}` : ''}
      {verifiedAt ? ` · 驗證日 ${verifiedAt}` : ''}
      {toeflIbtCutoffDate ? ` · TOEFL iBT 分界 ${toeflIbtCutoffDate}` : ''}
    </p>
  );

  const cefrTable = (
    <div className="table-responsive mb-3">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>CEFR 等級</th>
            <th className="text-end">GSE 下限</th>
            <th className="text-end">GSE 上限</th>
            <th className="text-end">中位數</th>
          </tr>
        </thead>
        <tbody>
          {cefrBands.map((band) => (
            <tr key={`${band.cefr}-${band.subLevel || band.label}`}>
              <td className="fw-semibold">{band.label || band.cefr}</td>
              <td className="text-end">{band.gseMin ?? '—'}</td>
              <td className="text-end">{band.gseMax ?? '—'}</td>
              <td className="text-end text-muted">{band.midpoint ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const examSection = examMappings.length > 0 ? (
  <div className="mb-3">
    <div className="fw-semibold small mb-2">英檢 → GSE 對照</div>
    {examMappings.map((mapping) => (
      <ExamMappingSection key={mapping.examType} mapping={mapping} />
    ))}
  </div>
  ) : null;

  const refsSection = references.length > 0 ? (
    <div>
      <div className="fw-semibold small mb-2">參考文獻</div>
      <ul className="small mb-0 ps-3">
        {references.map((ref) => (
          <li key={ref.id}>
            {ref.url ? (
              <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>
            ) : (
              ref.title
            )}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  if (embedded) {
    return (
      <div>
        <p className="small text-muted la-panel-lead mb-2">
          把不同英檢換成同一把能力尺，才能比進步。此表唯讀。
        </p>
        {meta}
        <div className="fw-semibold small mb-2">程度對照（能力分數）</div>
        {cefrTable}
        {examSection}
        {refsSection}
      </div>
    );
  }

  return (
    <div className="la-panel mb-3">
      <div className="la-panel-title mb-1">英檢換算表</div>
      <p className="small text-muted la-panel-lead mb-2">
        把不同英檢換成同一把能力尺，才能比進步。此表唯讀。
      </p>
      {meta}
      <div className="fw-semibold small mb-2">程度對照（能力分數）</div>
      {cefrTable}
      {examSection}
      {refsSection}
    </div>
  );
}
