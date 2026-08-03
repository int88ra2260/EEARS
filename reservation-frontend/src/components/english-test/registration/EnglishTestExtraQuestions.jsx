import React from 'react';

function optionValue(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  return opt.value ?? opt.label ?? '';
}

function optionLabel(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  return opt.label ?? opt.value ?? '';
}

/**
 * 渲染報名表單的自訂題（schema 中 system=false）。
 * 答案寫入 formData.extraAnswers[fieldKey]。
 */
export default function EnglishTestExtraQuestions({
  questions = [],
  sections = [],
  extraAnswers = {},
  onChange,
  errors = {},
  disabled = false,
  getFieldRef,
}) {
  if (!questions.length) return null;

  const sectionTitle = (sectionId) => {
    const s = (sections || []).find((x) => x.id === sectionId);
    return s?.title || '其他題目';
  };

  const bySection = questions.reduce((acc, q) => {
    const key = q.sectionId || 'custom';
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const setAnswer = (fieldKey, value) => {
    onChange({
      ...extraAnswers,
      [fieldKey]: value,
    });
  };

  const toggleCheckbox = (fieldKey, option, checked) => {
    const current = Array.isArray(extraAnswers[fieldKey]) ? [...extraAnswers[fieldKey]] : [];
    const next = checked ? [...current, option] : current.filter((v) => v !== option);
    setAnswer(fieldKey, next);
  };

  return (
    <div className="mt-4">
      {Object.entries(bySection).map(([sectionId, qs]) => (
        <div key={sectionId} className="mb-4">
          <h4
            className="mb-3"
            style={{ color: '#FF6B6B', borderBottom: '2px solid #FF6B6B', paddingBottom: '0.5rem' }}
          >
            {sectionTitle(sectionId)}
          </h4>
          {qs
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((q) => {
              const value = extraAnswers[q.fieldKey];
              const errKey = `extra.${q.fieldKey}`;
              return (
                <div
                  key={q.id}
                  className="mb-3"
                  ref={typeof getFieldRef === 'function' ? getFieldRef(errKey) : undefined}
                >
                  <label className="form-label">
                    {q.label}
                    {q.required ? <span style={{ color: 'red' }}> *</span> : null}
                  </label>
                  {q.helpText ? <div className="form-text mb-1">{q.helpText}</div> : null}

                  {q.type === 'textarea' && (
                    <textarea
                      className={`form-control ${errors[errKey] ? 'is-invalid' : ''}`}
                      rows={3}
                      disabled={disabled}
                      value={value || ''}
                      onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                    />
                  )}

                  {(q.type === 'text' || q.type === 'email' || q.type === 'date' || q.type === 'number') && (
                    <input
                      type={q.type === 'text' ? 'text' : q.type}
                      className={`form-control ${errors[errKey] ? 'is-invalid' : ''}`}
                      disabled={disabled}
                      value={value || ''}
                      onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                    />
                  )}

                  {q.type === 'select' && (
                    <select
                      className={`form-select ${errors[errKey] ? 'is-invalid' : ''}`}
                      disabled={disabled}
                      value={value || ''}
                      onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                    >
                      <option value="">請選擇</option>
                      {(q.options || []).map((opt) => (
                        <option key={optionValue(opt)} value={optionValue(opt)}>
                          {optionLabel(opt)}
                        </option>
                      ))}
                    </select>
                  )}

                  {q.type === 'radio' && (
                    <div>
                      {(q.options || []).map((opt) => {
                        const v = optionValue(opt);
                        return (
                          <div className="form-check" key={v}>
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`extra_${q.fieldKey}`}
                              id={`extra_${q.fieldKey}_${v}`}
                              disabled={disabled}
                              checked={value === v}
                              onChange={() => setAnswer(q.fieldKey, v)}
                            />
                            <label className="form-check-label" htmlFor={`extra_${q.fieldKey}_${v}`}>
                              {optionLabel(opt)}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'checkbox' && (
                    <div>
                      {(q.options || []).map((opt) => {
                        const v = optionValue(opt);
                        const checked = Array.isArray(value) && value.includes(v);
                        return (
                          <div className="form-check" key={v}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`extra_${q.fieldKey}_${v}`}
                              disabled={disabled}
                              checked={checked}
                              onChange={(e) => toggleCheckbox(q.fieldKey, v, e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={`extra_${q.fieldKey}_${v}`}>
                              {optionLabel(opt)}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {errors[errKey] ? <div className="invalid-feedback d-block">{errors[errKey]}</div> : null}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export function validateExtraAnswers(questions, extraAnswers) {
  const errors = {};
  for (const q of questions || []) {
    if (!q.required || q.visible === false) continue;
    const value = extraAnswers?.[q.fieldKey];
    const empty =
      value == null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      errors[`extra.${q.fieldKey}`] = '此欄位為必填';
    }
  }
  return errors;
}
