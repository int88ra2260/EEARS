import React from 'react';
import SchemaContentBlock from './SchemaContentBlock';
import { evaluateVisibleWhen } from '../../../utils/englishTestVisibleWhen';

/** 步驟 4（詳細資料表）內建區塊 id；自訂題應插入對應區塊，而非整批置底 */
export const ENGLISH_TEST_DETAIL_SECTION_IDS = Object.freeze([
  'contact',
  'academic',
  'special',
  'photo',
  'info',
]);

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

function filterQuestions(questions, { sectionFilter, excludeSectionIds, answers } = {}) {
  let list = (questions || []).filter((q) => q && q.visible !== false);
  if (sectionFilter != null) {
    const allowed = new Set(Array.isArray(sectionFilter) ? sectionFilter : [sectionFilter]);
    list = list.filter((q) => allowed.has(q.sectionId || 'custom'));
  }
  if (excludeSectionIds && excludeSectionIds.length) {
    const blocked = new Set(excludeSectionIds);
    list = list.filter((q) => !blocked.has(q.sectionId || 'custom'));
  }
  if (answers && typeof answers === 'object') {
    list = list.filter((q) => {
      if (!q.visibleWhen) return true;
      return evaluateVisibleWhen(q.visibleWhen, answers);
    });
  }
  return list;
}

/**
 * 渲染報名表單的自訂題（schema 中 system=false）。
 * 答案寫入 formData.extraAnswers[fieldKey]。
 *
 * - sectionFilter：只渲染指定區塊（字串或陣列），用於插入 A/B/C… 內
 * - excludeSectionIds：排除已內嵌的區塊，用於渲染其餘自訂階段
 * - showSectionTitles：內嵌時通常為 false，避免重複區塊標題
 */
export default function EnglishTestExtraQuestions({
  questions = [],
  sections = [],
  sectionFilter = null,
  excludeSectionIds = null,
  showSectionTitles = true,
  extraAnswers = {},
  formAnswers = null,
  onChange,
  errors = {},
  disabled = false,
  getFieldRef,
}) {
  const linkageAnswers = formAnswers || extraAnswers || {};
  const filtered = filterQuestions(questions, {
    sectionFilter,
    excludeSectionIds,
    answers: linkageAnswers,
  });
  if (!filtered.length) return null;

  const sectionTitle = (sectionId) => {
    const s = (sections || []).find((x) => x.id === sectionId);
    return s?.title || '其他題目';
  };

  const bySection = filtered.reduce((acc, q) => {
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

  const renderQuestion = (q) => {
    const value = extraAnswers[q.fieldKey];
    const errKey = `extra.${q.fieldKey}`;

    if (q.type === 'content_block') {
      return (
        <div
          key={q.id}
          className="mb-3"
          ref={typeof getFieldRef === 'function' ? getFieldRef(errKey) : undefined}
        >
          <SchemaContentBlock question={q} />
        </div>
      );
    }

    return (
      <div
        key={q.id}
        className="mb-3"
        ref={typeof getFieldRef === 'function' ? getFieldRef(errKey) : undefined}
      >
        {q.type !== 'checkbox_confirm' ? (
          <label className="form-label">
            {q.label}
            {q.required ? <span style={{ color: 'red' }}> *</span> : null}
          </label>
        ) : null}
        {q.helpText && q.type !== 'checkbox_confirm' ? (
          <div className="form-text mb-1">{q.helpText}</div>
        ) : null}

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

        {q.type === 'checkbox_single' && (
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id={`extra_${q.fieldKey}_agree`}
              disabled={disabled}
              checked={value === true || value === 'true'}
              onChange={(e) => setAnswer(q.fieldKey, e.target.checked)}
            />
            <label className="form-check-label" htmlFor={`extra_${q.fieldKey}_agree`}>
              {q.helpText || '我已閱讀並同意'}
              {q.required ? <span style={{ color: 'red' }}> *</span> : null}
            </label>
          </div>
        )}

        {q.type === 'checkbox_confirm' && (
          <div className="form-check" style={{ alignItems: 'flex-start' }}>
            <input
              className="form-check-input"
              type="checkbox"
              id={`extra_${q.fieldKey}_confirm`}
              disabled={disabled}
              checked={value === true || value === 'true'}
              onChange={(e) => setAnswer(q.fieldKey, e.target.checked)}
              style={{ marginTop: '0.35rem' }}
            />
            <label className="form-check-label" htmlFor={`extra_${q.fieldKey}_confirm`}>
              {q.label}
              {q.required ? <span style={{ color: 'red' }}> *</span> : null}
              {q.helpText ? <div className="form-text mt-1 mb-0">{q.helpText}</div> : null}
            </label>
          </div>
        )}

        {errors[errKey] ? <div className="invalid-feedback d-block">{errors[errKey]}</div> : null}
      </div>
    );
  };

  const sectionEntries = Object.entries(bySection);

  if (!showSectionTitles) {
    return (
      <div className="mt-2">
        {sectionEntries.flatMap(([, qs]) =>
          qs.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(renderQuestion)
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {sectionEntries.map(([sectionId, qs]) => (
        <div key={sectionId} className="mb-4">
          <h4
            className="mb-3"
            style={{ color: '#FF6B6B', borderBottom: '2px solid #FF6B6B', paddingBottom: '0.5rem' }}
          >
            {sectionTitle(sectionId)}
          </h4>
          {qs
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(renderQuestion)}
        </div>
      ))}
    </div>
  );
}

export function validateExtraAnswers(questions, extraAnswers, formAnswers = null) {
  const errors = {};
  const answers = { ...(formAnswers || {}), ...(extraAnswers || {}) };
  for (const q of questions || []) {
    if (!q.required || q.visible === false) continue;
    if (q.type === 'content_block') continue;
    if (q.visibleWhen && !evaluateVisibleWhen(q.visibleWhen, answers)) continue;
    const value = extraAnswers?.[q.fieldKey];
    if (q.type === 'checkbox_single' || q.type === 'checkbox_confirm') {
      if (value !== true && value !== 'true') {
        errors[`extra.${q.fieldKey}`] = '請勾選同意後再繼續';
      }
      continue;
    }
    const empty =
      value == null
      || value === ''
      || (Array.isArray(value) && value.length === 0);
    if (empty) {
      errors[`extra.${q.fieldKey}`] = '此欄位為必填';
    }
  }
  return errors;
}
