import React from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import {
  BASELINE_LEVEL_OPTIONS,
  DEFAULT_LA_FILTERS,
  EVIDENCE_QUALITY_OPTIONS,
  EXPOSURE_LEVEL_OPTIONS,
  FILTER_FIELD_HINTS,
  FILTER_LABELS,
  FILTER_PARAM_KEYS,
  INSTRUMENT_OPTIONS,
  SKILL_OPTIONS,
  TRI_STATE_OPTIONS,
  countActiveFilters,
} from './learningAnalyticsFilterConstants';

function buildSelectOptions(items = [], emptyLabel = '全部') {
  const list = Array.isArray(items) ? items : [];
  return [
    { value: '', label: emptyLabel },
    ...list.map((item) => ({
      value: item.value,
      label: item.label || item.value,
    })),
  ];
}

export { DEFAULT_LA_FILTERS };

function FilterHintIcon({ hint, hintId }) {
  if (!hint) return null;
  return (
    <OverlayTrigger
      placement="top"
      trigger={['hover', 'focus', 'click']}
      overlay={<Tooltip id={hintId}>{hint}</Tooltip>}
    >
      <button
        type="button"
        className="la-filter-hint-btn"
        aria-label="欄位說明"
        onClick={(e) => e.preventDefault()}
      >
        !
      </button>
    </OverlayTrigger>
  );
}

function FilterField({ label, hint, hintId, children }) {
  return (
    <Form.Group className="la-filter-field mb-0">
      <Form.Label className="small text-muted mb-1 la-filter-label d-inline-flex align-items-center gap-1 flex-wrap">
        <span>{label}</span>
        <FilterHintIcon hint={hint} hintId={hintId} />
      </Form.Label>
      {children}
    </Form.Group>
  );
}

function SelectField({
  label,
  hint,
  hintId,
  value,
  onChange,
  options,
  disabled,
}) {
  return (
    <FilterField label={label} hint={hint} hintId={hintId}>
      <Form.Select value={value} onChange={onChange} disabled={disabled}>
        {options.map((opt) => (
          <option key={opt.value || '__all__'} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    </FilterField>
  );
}

function resolveFilterHint(key, filterOptions, matchingCaliperDefault) {
  const fromMeta = filterOptions?.notes?.[key];
  if (fromMeta) return fromMeta;
  if (key === 'matching_caliper') {
    const base = FILTER_FIELD_HINTS.matching_caliper;
    return matchingCaliperDefault != null
      ? `${base}（目前預設 ${matchingCaliperDefault}）`
      : base;
  }
  return FILTER_FIELD_HINTS[key] || '';
}

export default function LearningAnalyticsFilters({
  filters,
  onChange,
  onSubmit,
  onReset,
  loading,
  filterTitle = '群體分析篩選',
  submitLabel = '查詢',
  showAdvanced = true,
  intro = null,
  filterOptions = null,
  matchingCaliperDefault = 0.35,
}) {
  const semesterOptions = buildSelectOptions(
    filterOptions?.semesters?.length ? filterOptions.semesters : SEMESTER_OPTIONS.filter((o) => o.value),
    '全部／不篩學期'
  );
  const cohortOptions = buildSelectOptions(filterOptions?.cohorts, '全部入學年度');
  const collegeOptions = buildSelectOptions(filterOptions?.colleges, '全部學院');
  const departmentOptions = buildSelectOptions(filterOptions?.departments, '全部系所');
  const activeCount = countActiveFilters(filters);

  const patch = (partial) => onChange({ ...filters, ...partial });
  const hint = (key) => resolveFilterHint(key, filterOptions, matchingCaliperDefault);

  return (
    <div className="la-filters border rounded p-3 bg-white">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="fw-semibold small">{filterTitle}</div>
        {activeCount > 0 ? (
          <Badge bg="secondary" pill>{activeCount} 項條件</Badge>
        ) : (
          <span className="small text-muted">未套用額外條件（顯示全部納入分析的學生）</span>
        )}
      </div>
      {intro ? <p className="small text-muted mb-2 mb-md-3">{intro}</p> : null}
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <Row className="g-2 la-filter-row">
          <Col xs={12} sm={6} lg={4}>
            <SelectField
              label={FILTER_LABELS.semester}
              hint={hint('semester')}
              hintId="la-filter-hint-semester"
              value={filters.semester}
              onChange={(e) => patch({ semester: e.target.value })}
              options={semesterOptions}
              disabled={loading}
            />
          </Col>
          <Col xs={6} sm={6} lg={2}>
            <SelectField
              label={FILTER_LABELS.cohort}
              hint={hint('cohort')}
              hintId="la-filter-hint-cohort"
              value={filters.cohort}
              onChange={(e) => patch({ cohort: e.target.value })}
              options={cohortOptions}
              disabled={loading}
            />
          </Col>
          <Col xs={6} sm={6} lg={3}>
            <SelectField
              label={FILTER_LABELS.department}
              hint={hint('department')}
              hintId="la-filter-hint-department"
              value={filters.department}
              onChange={(e) => patch({ department: e.target.value })}
              options={departmentOptions}
              disabled={loading}
            />
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <SelectField
              label={FILTER_LABELS.college}
              hint={hint('college')}
              hintId="la-filter-hint-college"
              value={filters.college}
              onChange={(e) => patch({ college: e.target.value })}
              options={collegeOptions}
              disabled={loading}
            />
          </Col>
        </Row>

        <Row className="g-2 la-filter-row mt-1">
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.baseline_level}
              hint={hint('baseline_level')}
              hintId="la-filter-hint-baseline"
              value={filters.baseline_level}
              onChange={(e) => patch({ baseline_level: e.target.value })}
              options={BASELINE_LEVEL_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.exposure_level}
              hint={hint('exposure_level')}
              hintId="la-filter-hint-exposure"
              value={filters.exposure_level}
              onChange={(e) => patch({ exposure_level: e.target.value })}
              options={EXPOSURE_LEVEL_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.retest_flag}
              hint={hint('retest_flag')}
              hintId="la-filter-hint-retest"
              value={filters.retest_flag}
              onChange={(e) => patch({ retest_flag: e.target.value })}
              options={TRI_STATE_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.is_b2plus}
              hint={hint('is_b2plus')}
              hintId="la-filter-hint-b2plus"
              value={filters.is_b2plus}
              onChange={(e) => patch({ is_b2plus: e.target.value })}
              options={TRI_STATE_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.instrument}
              hint={hint('instrument')}
              hintId="la-filter-hint-instrument"
              value={filters.instrument}
              onChange={(e) => patch({ instrument: e.target.value })}
              options={INSTRUMENT_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.skill}
              hint={hint('skill')}
              hintId="la-filter-hint-skill"
              value={filters.skill}
              onChange={(e) => patch({ skill: e.target.value })}
              options={SKILL_OPTIONS}
              disabled={loading}
            />
          </Col>
          <Col md={2} sm={6}>
            <SelectField
              label={FILTER_LABELS.evidence_quality}
              hint={hint('evidence_quality')}
              hintId="la-filter-hint-quality"
              value={filters.evidence_quality}
              onChange={(e) => patch({ evidence_quality: e.target.value })}
              options={EVIDENCE_QUALITY_OPTIONS}
              disabled={loading}
            />
          </Col>
          {showAdvanced ? (
            <Col md={2} sm={6}>
              <FilterField
                label={FILTER_LABELS.matching_caliper}
                hint={hint('matching_caliper')}
                hintId="la-filter-hint-caliper"
              >
                <Form.Control
                  type="number"
                  step="0.05"
                  min="0"
                  max="2"
                  value={filters.matching_caliper}
                  onChange={(e) => patch({ matching_caliper: e.target.value })}
                  placeholder={`預設 ${matchingCaliperDefault}`}
                  disabled={loading}
                />
              </FilterField>
            </Col>
          ) : null}
        </Row>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            disabled={loading}
            onClick={() => onReset?.()}
          >
            重設
          </Button>
          <span className="small text-muted align-self-center">
            調整條件後請按「{submitLabel}」；圖表與數字會依<strong>已套用</strong>的條件更新（修改選項時不會自動重算）。
          </span>
        </div>
      </Form>
    </div>
  );
}

export function LearningAnalyticsActiveFilters({ filters }) {
  const chips = FILTER_PARAM_KEYS.filter((key) => {
    if (key === 'snapshot_version') return false;
    const value = filters?.[key];
    return value !== undefined && value !== null && value !== '';
  }).map((key) => {
    const raw = filters[key];
    let display = raw;
    if (key === 'retest_flag' || key === 'is_b2plus') {
      display = raw === 'true' ? '是' : raw === 'false' ? '否' : raw;
    }
    if (key === 'exposure_level') {
      display = EXPOSURE_LEVEL_OPTIONS.find((o) => o.value === raw)?.label || raw;
    }
    if (key === 'evidence_quality') {
      display = EVIDENCE_QUALITY_OPTIONS.find((o) => o.value === raw)?.label || raw;
    }
    if (key === 'skill') {
      display = SKILL_OPTIONS.find((o) => o.value === raw)?.label || raw;
    }
    if (key === 'baseline_level') {
      display = BASELINE_LEVEL_OPTIONS.find((o) => o.value === raw)?.label || raw;
    }
    return { key, label: FILTER_LABELS[key] || key, display };
  });

  if (!chips.length) return null;

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mt-2 mb-1">
      <span className="small text-muted">已套用：</span>
      {chips.map(({ key, label, display }) => (
        <Badge key={key} bg="light" text="dark" className="border fw-normal">
          {label}：{display}
        </Badge>
      ))}
    </div>
  );
}
