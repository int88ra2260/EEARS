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

export default function StatsVisualization({
  stats,
  onFilterClick,
  todayNewCount = 0,
  currentStatusFilter = 'all',
}) {
  const handleCardClick = (filterType, filterValue) => {
    onFilterClick && onFilterClick(filterType, filterValue);
  };

  const processedCount = (stats.approved ?? 0) + (stats.revision ?? 0) + (stats.success ?? 0) + (stats.failed ?? 0);
  const totalEligible = Math.max(0, (stats.total ?? 0) - (stats.nonExam ?? 0));

  const reviewProgress =
    currentStatusFilter === 'all' && totalEligible > 0
      ? Math.round((processedCount / totalEligible) * 100)
      : null;
  const shouldShowProgress = reviewProgress !== null;

  const CARD_COLORS = {
    total: { border: '#0d6efd', text: '#0d6efd', bar: '#0d6efd' },
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

  return (
    <div className="row mb-4">
      <StatCard
        title="總報名人數"
        value={stats.total}
        active={currentStatusFilter === 'all'}
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
        active={currentStatusFilter === 'pending'}
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
        active={currentStatusFilter === 'approved'}
        borderColor={CARD_COLORS.approved.border}
        textColor={CARD_COLORS.approved.text}
        barColor={CARD_COLORS.approved.bar}
        barRatio={ratio(stats.approved)}
        onActivate={() => handleCardClick('status', 'approved')}
      />

      <StatCard
        title="請修正"
        value={stats.revision ?? 0}
        active={currentStatusFilter === 'revision'}
        borderColor={CARD_COLORS.revision.border}
        textColor={CARD_COLORS.revision.text}
        barColor={CARD_COLORS.revision.bar}
        barRatio={ratio(stats.revision ?? 0)}
        onActivate={() => handleCardClick('status', 'revision')}
      />

      <StatCard
        title="報名成功"
        value={stats.success ?? 0}
        active={currentStatusFilter === 'success'}
        borderColor={CARD_COLORS.success.border}
        textColor={CARD_COLORS.success.text}
        barColor={CARD_COLORS.success.bar}
        barRatio={ratio(stats.success ?? 0)}
        onActivate={() => handleCardClick('status', 'success')}
      />

      <StatCard
        title="報名失敗"
        value={stats.failed ?? 0}
        active={currentStatusFilter === 'failed'}
        borderColor={CARD_COLORS.failed.border}
        textColor={CARD_COLORS.failed.text}
        barColor={CARD_COLORS.failed.bar}
        barRatio={ratio(stats.failed ?? 0)}
        onActivate={() => handleCardClick('status', 'failed')}
      />

      <StatCard
        title="不報考"
        value={stats.nonExam}
        borderColor={CARD_COLORS.nonExam.border}
        textColor={CARD_COLORS.nonExam.text}
        onActivate={() => handleCardClick('examType', 'NON')}
      />

      <StatCard
        title="報名聽讀"
        value={stats.listeningReading}
        borderColor={CARD_COLORS.examLR.border}
        textColor={CARD_COLORS.examLR.text}
        backgroundColor={CARD_COLORS.examLR.bg}
        onActivate={() => handleCardClick('examType', 'LR')}
      />

      <StatCard
        title="報名說寫"
        value={stats.speakingWriting}
        borderColor={CARD_COLORS.examSW.border}
        textColor={CARD_COLORS.examSW.text}
        backgroundColor={CARD_COLORS.examSW.bg}
        onActivate={() => handleCardClick('examType', 'SW')}
      />

      {shouldShowProgress && (
        <div className="col-12 mt-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>審核進度</strong>
                <span className={`badge bg-${reviewProgress === 100 ? 'success' : reviewProgress === 0 ? 'warning' : 'primary'}`}>
                  {reviewProgress}%
                </span>
              </div>
              <div className="progress" style={{ height: '20px' }}>
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

      {!shouldShowProgress && stats.total === 0 && (
        <div className="col-12 mt-3">
          <div className="alert alert-info mb-0">
            <i className="fas fa-info-circle me-2"></i>
            目前沒有符合篩選條件的資料
          </div>
        </div>
      )}
    </div>
  );
}
