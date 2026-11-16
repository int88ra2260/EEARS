import React, { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';

function sameKeys(left = [], right = []) {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((key) => set.has(key));
}

function cellTitle(cell) {
  if (!cell || cell.n === 0) return '這個格子沒有量表分數';
  if (cell.suppressed) return `人數 ${cell.n}，少於門檻，不顯示平均`;
  if (cell.sd == null) return `平均 ${cell.mean}，人數 ${cell.n}`;
  return `平均 ${cell.mean}，標準差 ${cell.sd}，人數 ${cell.n}`;
}

function rhoTitle(cell) {
  if (!cell) return '';
  if (cell.suppressed) return `配對人數 ${cell.n}，少於門檻`;
  if (cell.reason === 'NO_VARIANCE') return '分數沒有差異，無法計算相關';
  return `Spearman ρ ${Number(cell.rho).toFixed(2)}，配對人數 ${cell.n}`;
}

export function associationCellStyle(rho) {
  if (rho == null || Number.isNaN(Number(rho))) {
    return { background: '#f8f9fa', color: '#6c757d' };
  }
  const magnitude = Math.min(1, Math.abs(Number(rho)));
  if (Number(rho) >= 0) {
    return {
      background: `rgb(${Math.round(255 - magnitude * 180)}, ${Math.round(255 - magnitude * 120)}, ${Math.round(255 - magnitude * 180)})`,
      color: magnitude > 0.75 ? '#fff' : '#1f2933',
    };
  }
  return {
    background: `rgb(${Math.round(255 - magnitude * 40)}, ${Math.round(255 - magnitude * 180)}, ${Math.round(255 - magnitude * 180)})`,
    color: magnitude > 0.75 ? '#fff' : '#1f2933',
  };
}

function MeanCell({ cell }) {
  if (!cell || cell.n === 0) return <span className="text-muted">—</span>;
  if (cell.suppressed) {
    return (
      <span className="text-muted" title={cellTitle(cell)}>
        人數不足
        <span className="d-block">n={cell.n}</span>
      </span>
    );
  }
  return (
    <span title={cellTitle(cell)}>
      {cell.mean}
      <span className="text-muted"> n={cell.n}</span>
    </span>
  );
}

export default function SurveyAssociationPanel({
  versionId,
  relations,
  loading,
  error,
  groupBy,
  onGroupByChange,
}) {
  const [selected, setSelected] = useState([]);
  const suggestedKey = (relations?.suggestedQuestionKeys || []).join('|');

  useEffect(() => {
    if (!versionId) {
      setSelected([]);
      return;
    }
    setSelected(suggestedKey ? suggestedKey.split('|') : []);
  }, [suggestedKey, versionId]);

  if (!versionId) {
    return (
      <div className="text-muted">
        請先在上方選擇問卷版本。題目關聯只計算同一個版本，避免把不同問卷裡同名的題號放在一起。
      </div>
    );
  }

  if (loading && !relations) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (error) return <div className="text-danger small">{error}</div>;
  if (!relations) return null;
  if (relations.message) return <div className="text-muted">{relations.message}</div>;

  const questions = relations.questions || [];
  const selectedQuestions = questions.filter((question) => selected.includes(question.key));
  const activeGroupBy = groupBy || relations.groupBy || '';

  function toggleQuestion(key) {
    setSelected((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  }

  return (
    <div>
      <p className="small text-muted mb-3">{relations.note}</p>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <Form.Label className="small mb-1">分組</Form.Label>
          <Form.Select
            aria-label="關聯分組"
            value={activeGroupBy}
            onChange={(event) => onGroupByChange(event.target.value)}
          >
            {(relations.groupOptions || []).map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </Form.Select>
        </div>
        <div className="col-md-8 d-flex align-items-end flex-wrap gap-2">
          {(relations.constructs || []).map((construct) => (
            <Button
              key={construct.id}
              size="sm"
              variant={sameKeys(selected, construct.keys) ? 'primary' : 'outline-primary'}
              onClick={() => setSelected(construct.keys)}
            >
              {construct.label}
            </Button>
          ))}
          <Badge bg="light" text="dark">人數門檻 {relations.minN}</Badge>
          {loading ? <span className="small text-muted">更新中</span> : null}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="small fw-semibold mb-2">納入題目</div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {questions.map((question) => (
              <Form.Check
                key={question.key}
                id={`survey-rel-${question.key}`}
                type="checkbox"
                className="small"
                label={`${question.shortLabel} ${question.label}`}
                checked={selected.includes(question.key)}
                onChange={() => toggleQuestion(question.key)}
              />
            ))}
          </div>
        </div>
        <div className="col-lg-8">
          {selectedQuestions.length === 0 ? (
            <div className="text-muted small">請至少勾選一題量表。</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>{relations.groupByLabel || '分組'}</th>
                    <th>人數</th>
                    {selectedQuestions.map((question) => (
                      <th key={question.key} title={question.label}>{question.shortLabel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(relations.groups || []).map((group) => (
                    <tr key={group.key}>
                      <td>{group.label}</td>
                      <td>{group.responseCount}</td>
                      {selectedQuestions.map((question) => (
                        <td key={question.key}>
                          <MeanCell cell={group.cells?.[question.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(relations.groups || []).length === 0 ? (
            <div className="text-muted small mt-2">這個版本在目前篩選下沒有作答。</div>
          ) : null}
        </div>
      </div>

      {selectedQuestions.length >= 2 ? (
        <div className="mt-4">
          <div className="small fw-semibold mb-2">題目相關</div>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle mb-2">
              <thead>
                <tr>
                  <th />
                  {selectedQuestions.map((question) => (
                    <th key={question.key} className="text-center" title={question.label}>{question.shortLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedQuestions.map((row) => (
                  <tr key={row.key}>
                    <th title={row.label}>{row.shortLabel}</th>
                    {selectedQuestions.map((column) => {
                      const cell = relations.matrix?.[row.key]?.[column.key];
                      const text = !cell || cell.suppressed || cell.rho == null ? '—' : Number(cell.rho).toFixed(2);
                      return (
                        <td
                          key={column.key}
                          className="text-center small"
                          style={associationCellStyle(cell && !cell.suppressed ? cell.rho : null)}
                          title={rhoTitle(cell)}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="small text-muted">綠色偏正相關，紅色偏負相關。橫線代表人數不足，或這題分數沒有差異。</div>
        </div>
      ) : null}
    </div>
  );
}
