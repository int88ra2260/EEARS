import React from 'react';
import DiagnosticsPanel from '../../components/learningJourneyV3/hub/DiagnosticsPanel';
import { EmptyState, ErrorState, LoadingState } from '../../components/learningJourneyV3/hub/HubUi';
import ProfileSummary from '../../components/learningJourneyV3/hub/ProfileSummary';
import SemesterOverview from '../../components/learningJourneyV3/hub/SemesterOverview';
import StudentsTab from '../../components/learningJourneyV3/hub/StudentsTab';
import useLearningJourneyHub from '../../hooks/useLearningJourneyHub';

export default function LearningJourneyHubPage() {
  const {
    activeTab,
    canViewDiagnostics,
    diagnostics,
    historyRecords,
    loadDiagnosticReadiness,
    loadDiagnosticStatus,
    loadOverview,
    loadProfile,
    loadStudents,
    overviewState,
    profileState,
    rebuild,
    rebuildError,
    rebuildResult,
    rebuilding,
    selectTab,
    semesterInput,
    semesters,
    setSemesterInput,
    setStudentFilters,
    setStudentInput,
    studentFilters,
    studentInput,
    studentsState,
    tabItems,
  } = useLearningJourneyHub();

  return (
    <div className="container-fluid py-3">
      <div className="mb-3">
        <h4 className="mb-1">英語學習歷程中心</h4>
        <p className="text-muted mb-0">
          整合 BESTEP、培力英檢、CEFR 與活動參與資料，查詢學生學習歷程與學期整體狀態。
        </p>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-lg-4 col-md-6">
              <label className="form-label small mb-1">學號</label>
              <input
                className="form-control"
                value={studentInput}
                onChange={(e) => setStudentInput(e.target.value)}
                placeholder="例如：D11400001"
              />
            </div>
            <div className="col-lg-3 col-md-6">
              <label className="form-label small mb-1">學期</label>
              {semesters.length > 0 ? (
                <select className="form-select" value={semesterInput} onChange={(e) => setSemesterInput(e.target.value)}>
                  {semesters.map((semester) => (
                    <option key={semester.id || semester.code} value={semester.id || semester.code}>
                      {semester.name || semester.code || semester.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="form-control" value={semesterInput} onChange={(e) => setSemesterInput(e.target.value)} placeholder="114-1" />
              )}
            </div>
            <div className="col-lg-3 col-md-6">
              <button type="button" className="btn btn-primary w-100" disabled={profileState.status === 'loading'} onClick={loadProfile}>
                查詢學生學習歷程
              </button>
            </div>
            <div className="col-lg-2 col-md-6">
              <button type="button" className="btn btn-outline-secondary w-100" disabled={overviewState.status === 'loading'} onClick={loadOverview}>
                查看學期總覽
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="fw-semibold mb-2">使用方式：</div>
          <ol className="mb-0">
            <li>輸入學生學號並選擇學期</li>
            <li>點擊「查詢學生學習歷程」</li>
            <li>查看該學生的 CEFR、BESTEP、活動參與與風險狀態</li>
          </ol>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        {tabItems.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button type="button" className={`nav-link ${activeTab === tab.id ? 'active' : ''}`} onClick={() => selectTab(tab.id)}>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'student' ? (
        <>
          {profileState.status === 'idle' ? <EmptyState>尚未查詢資料，請輸入學號與學期後開始查詢。</EmptyState> : null}
          {profileState.status === 'loading' ? <LoadingState /> : null}
          {profileState.status === 'empty' ? <EmptyState>查無此學生於該學期的學習歷程資料。</EmptyState> : null}
          {profileState.status === 'error' ? <ErrorState message={profileState.error} requestId={profileState.requestId} /> : null}
          {profileState.status === 'success' ? <ProfileSummary profile={profileState.data} studentInput={studentInput} semesterInput={semesterInput} /> : null}
        </>
      ) : null}

      {activeTab === 'overview' ? (
        <>
          {overviewState.status === 'idle' ? <EmptyState>尚未取得學期總覽，請選擇學期後點擊「查看學期總覽」。</EmptyState> : null}
          {overviewState.status === 'loading' ? <LoadingState>正在載入學期總覽資料...</LoadingState> : null}
          {overviewState.status === 'error' ? <ErrorState message={overviewState.error} requestId={overviewState.requestId} /> : null}
          {overviewState.status === 'success' ? (
            <SemesterOverview
              overview={overviewState.summary}
              quality={overviewState.quality}
              riskData={overviewState.risk}
              historyRecords={historyRecords}
            />
          ) : null}
        </>
      ) : null}

      {activeTab === 'students' ? (
        <StudentsTab
          state={studentsState}
          filters={studentFilters}
          onFilterChange={(patch) => setStudentFilters((prev) => ({ ...prev, ...patch }))}
          onQuery={(patch) => loadStudents(patch)}
          onPage={(offset) => loadStudents({ offset })}
        />
      ) : null}

      {activeTab === 'diagnostics' && canViewDiagnostics ? (
        <DiagnosticsPanel
          canViewDiagnostics={canViewDiagnostics}
          diagnostics={diagnostics}
          importHistories={overviewState.importHistories}
          quality={overviewState.quality}
          rebuilding={rebuilding}
          rebuildResult={rebuildResult}
          rebuildError={rebuildError}
          onRebuild={rebuild}
          onLoadStatus={loadDiagnosticStatus}
          onLoadReadiness={loadDiagnosticReadiness}
        />
      ) : null}

      {activeTab !== 'diagnostics' ? (
        <DiagnosticsPanel
          canViewDiagnostics={canViewDiagnostics}
          diagnostics={diagnostics}
          importHistories={overviewState.importHistories}
          quality={overviewState.quality}
          rebuilding={rebuilding}
          rebuildResult={rebuildResult}
          rebuildError={rebuildError}
          onRebuild={rebuild}
          onLoadStatus={loadDiagnosticStatus}
          onLoadReadiness={loadDiagnosticReadiness}
        />
      ) : null}
    </div>
  );
}
