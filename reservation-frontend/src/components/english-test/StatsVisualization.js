// components/english-test/StatsVisualization.js
import React from 'react';

function StatCard({
  title,
  value,
  active,
  onActivate,
  borderColor,
  textColor,
  backgroundColor,
  barColor,
  barRatio,
  children,
}) {
  const activate = () => onActivate?.();
  return (
    <div className="col-md-2 col-6 mb-3">
      <div
        className={`card text-center h-100 ${active ? 'shadow-sm' : ''}`}
        style={{
          cursor: 'pointer',
          borderWidth: active ? 2 : 1,
          borderColor,
          borderStyle: 'solid',
          backgroundColor: backgroundColor || undefined,
        }}
        role="button"
        tabIndex={0}
        aria-pressed={active || undefined}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        <div className="card-body">
          <h5 className="card-title mb-2" style={textColor ? { color: textColor } : undefined}>
            {title}
          </h5>
          <h3 className="mb-1" style={{ color: textColor }}>{value}</h3>
          {typeof barRatio === 'number' && barRatio >= 0 && (
            <div className="progress" style={{ height: '6px' }}>
              <div
                className="progress-bar"
                style={{ width: `${barRatio * 100}%`, backgroundColor: barColor }}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, hint }) {
  return (
    <div className="col-12 mb-2 mt-1">
      <div className="d-flex flex-wrap align-items-baseline gap-2">
        <h6 className="mb-0 text-secondary fw-semibold">{title}</h6>
        <small className="text-muted">{hint}</small>
      </div>
    </div>
  );
}

export default function StatsVisualization({
  stats,
  onFilterClick,
  todayNewCount = 0,
  currentStatusFilter = 'all',
  currentExamTypes = [],
}) {
  const handleCardClick = (filterType, filterValue) => {
    onFilterClick && onFilterClick(filterType, filterValue);
  };

  const processedCount = (stats.approved ?? 0) + (stats.revision ?? 0) + (stats.success ?? 0) + (stats.failed ?? 0);
  const totalEligible = Math.max(0, (stats.total ?? 0) - (stats.nonExam ?? 0));
  const inconsistentNon = stats.nonExamInconsistent ?? 0;

  const reviewProgress =
    currentStatusFilter === 'all' && totalEligible > 0
      ? Math.round((processedCount / totalEligible) * 100)
      : null;
  const shouldShowProgress = reviewProgress !== null;

  const CARD_COLORS = {
    total: { border: '#2a5d9f', text: '#2a5d9f', bar: '#2a5d9f' },
    pending: { border: '#ffc107', text: '#856404', bar: '#ffc107', bg: '#fff9e6' },
    approved: { border: '#0dcaf0', text: '#087990', bar: '#0dcaf0' },
    revision: { border: '#6f42c1', text: '#6f42c1', bar: '#6f42c1' },
    success: { border: '#198754', text: '#198754', bar: '#198754' },
    failed: { border: '#dc3545', text: '#dc3545', bar: '#dc3545' },
    nonExam: { border: '#212529', text: '#212529' },
    examLR: { border: '#dee2e6', text: '#212529', bg: '#fff' },
    examSW: { border: '#dee2e6', text: '#212529', bg: '#fff' },
  };

  const ratio = (n) => (stats.total > 0 ? n / stats.total : undefined);
  const examActive = (value) => Array.isArray(currentExamTypes) && currentExamTypes.includes(value);
  const examTypesActive = Array.isArray(currentExamTypes) && currentExamTypes.length > 0;

  return (
    <div className="mb-4">
      <div
        className="rounded border bg-light-subtle p-3 mb-3"
        style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
      >
        <div className="row">
          <SectionHeader
            title="審核狀態"
            hint="互斥分類 · 點選會切換上方狀態分頁，並清除「測驗類型」篩選"
          />

          <StatCard
            title="總報名人數"
            value={stats.total}
            active={currentStatusFilter === 'all' && !examTypesActive}
            borderColor={CARD_COLORS.total.border}
            textColor={CARD_COLORS.total.text}
            onActivate={() => handleCardClick('status', 'all')}
          >
            {todayNewCount > 0 && (
              <small className="text-success">
                <i className="fas fa-arrow-up me-1" aria-hidden /> 今日新增 {todayNewCount}
              </small>
            )}
          </StatCard>

          <StatCard
            title="審核中"
            value={stats.pending}
            active={currentStatusFilter === 'pending' && !examTypesActive}
            borderColor={CARD_COLORS.pending.border}
            textColor={CARD_COLORS.pending.text}
            backgroundColor={
              currentStatusFilter === 'pending'
                ? CARD_COLORS.pending.bg
                : stats.pending > 0
                  ? '#fffbf0'
                  : 'white'
            }
            barColor={CARD_COLORS.pending.bar}
            barRatio={ratio(stats.pending)}
            onActivate={() => handleCardClick('status', 'pending')}
          />

          <StatCard
            title="已通過"
            value={stats.approved}
            active={currentStatusFilter === 'approved' && !examTypesActive}
            borderColor={CARD_COLORS.approved.border}
            textColor={CARD_COLORS.approved.text}
            barColor={CARD_COLORS.approved.bar}
            barRatio={ratio(stats.approved)}
            onActivate={() => handleCardClick('status', 'approved')}
          />

          <StatCard
            title="請修正"
            value={stats.revision ?? 0}
            active={currentStatusFilter === 'revision' && !examTypesActive}
            borderColor={CARD_COLORS.revision.border}
            textColor={CARD_COLORS.revision.text}
            barColor={CARD_COLORS.revision.bar}
            barRatio={ratio(stats.revision ?? 0)}
            onActivate={() => handleCardClick('status', 'revision')}
          />

          <StatCard
            title="報名成功"
            value={stats.success ?? 0}
            active={currentStatusFilter === 'success' && !examTypesActive}
            borderColor={CARD_COLORS.success.border}
            textColor={CARD_COLORS.success.text}
            barColor={CARD_COLORS.success.bar}
            barRatio={ratio(stats.success ?? 0)}
            onActivate={() => handleCardClick('status', 'success')}
          />

          <StatCard
            title="報名失敗"
            value={stats.failed ?? 0}
            active={currentStatusFilter === 'failed' && !examTypesActive}
            borderColor={CARD_COLORS.failed.border}
            textColor={CARD_COLORS.failed.text}
            barColor={CARD_COLORS.failed.bar}
            barRatio={ratio(stats.failed ?? 0)}
            onActivate={() => handleCardClick('status', 'failed')}
          />

          {shouldShowProgress && (
            <div className="col-12 mt-1">
              <div className="card border-0 shadow-none" style={{ backgroundColor: 'transparent' }}>
                <div className="card-body px-0 py-2">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong className="small">審核進度</strong>
                    <span className={`badge bg-${reviewProgress === 100 ? 'success' : reviewProgress === 0 ? 'warning' : 'primary'}`}>
                      {reviewProgress}%
                    </span>
                  </div>
                  <div className="progress" style={{ height: '12px' }}>
                    <div
                      className={`progress-bar ${reviewProgress === 100 ? 'bg-success' : reviewProgress === 0 ? 'bg-warning' : 'bg-success'}`}
                      role="progressbar"
                      style={{ width: `${reviewProgress}%` }}
                      aria-valuenow={reviewProgress}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      {reviewProgress}%
                    </div>
                  </div>
                  <small className="text-muted">
                    已處理 {processedCount} / {totalEligible} 筆（分母已排除不報考；已通過 + 請修正 + 報名成功 + 報名失敗）
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded border p-3"
        style={{ backgroundColor: '#fff', borderColor: '#dee2e6' }}
      >
        <div className="row">
          <SectionHeader
            title="報考項目"
            hint="可重疊（四項全考會同時計入聽讀與說寫）· 點選會套用進階「測驗類型」並切到「全部」狀態"
          />

          <StatCard
            title="不報考"
            value={stats.nonExam}
            active={examActive('NON')}
            borderColor={examActive('NON') ? '#0d6efd' : CARD_COLORS.nonExam.border}
            textColor={CARD_COLORS.nonExam.text}
            onActivate={() => handleCardClick('examType', 'NON')}
          />

          <StatCard
            title="報名聽讀"
            value={stats.listeningReading}
            active={examActive('LR')}
            borderColor={examActive('LR') ? '#0d6efd' : CARD_COLORS.examLR.border}
            textColor={CARD_COLORS.examLR.text}
            backgroundColor={CARD_COLORS.examLR.bg}
            onActivate={() => handleCardClick('examType', 'LR')}
          />

          <StatCard
            title="報名說寫"
            value={stats.speakingWriting}
            active={examActive('SW')}
            borderColor={examActive('SW') ? '#0d6efd' : CARD_COLORS.examSW.border}
            textColor={CARD_COLORS.examSW.text}
            backgroundColor={CARD_COLORS.examSW.bg}
            onActivate={() => handleCardClick('examType', 'SW')}
          />

          {inconsistentNon > 0 && (
            <div className="col-12">
              <div className="alert alert-warning py-2 mb-0 small" role="status">
                發現 {inconsistentNon} 筆「不報考」但仍為已通過／報名成功。
                點「不報考」卡片可列出（會切到全部狀態）；請在詳情改為不報考後系統會自動落到「請修正」。
              </div>
            </div>
          )}
        </div>
      </div>

      {!shouldShowProgress && stats.total === 0 && (
        <div className="alert alert-info mb-0 mt-3">
          <i className="fas fa-info-circle me-2"></i>
          目前沒有符合篩選條件的資料
        </div>
      )}
    </div>
  );
}
