// components/LearningPartnerManagement.js
// 學習有伴團體報名管理頁面（管理端）
import React, { useEffect } from 'react';
import useLearningPartnerManagement from '../hooks/useLearningPartnerManagement';
import useLearningPartnerOpsAttention from '../hooks/useLearningPartnerOpsAttention';
import LearningPartnerAdminTabs from './learning-partner/LearningPartnerAdminTabs';
import LearningPartnerTeamsToolbar from './learning-partner/LearningPartnerTeamsToolbar';
import LearningPartnerTeamsGrid from './learning-partner/LearningPartnerTeamsGrid';
import LearningPartnerTeamsPagination from './learning-partner/LearningPartnerTeamsPagination';
import LearningPartnerTeamDetailModal from './learning-partner/LearningPartnerTeamDetailModal';
import LearningPartnerTeamRankingPanel from './learning-partner/LearningPartnerTeamRankingPanel';
import LearningPartnerFunnelPanel from './learning-partner/LearningPartnerFunnelPanel';

export default function LearningPartnerManagement({ token, accessProfile }) {
  const lp = useLearningPartnerManagement(token);
  const { showAttention, markSeen } = useLearningPartnerOpsAttention(accessProfile);

  useEffect(() => {
    if (lp.adminView === 'funnel' && showAttention) {
      markSeen();
    }
  }, [lp.adminView, showAttention, markSeen]);

  if (lp.loading && lp.teams.length === 0 && lp.adminView === 'teams') {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-3 text-muted">載入團體列表中...</p>
      </div>
    );
  }

  return (
    <div>
      <LearningPartnerAdminTabs
        adminView={lp.adminView}
        onViewChange={lp.setAdminView}
        showFunnelAttention={showAttention}
      />

      {lp.adminView === 'funnel' && (
        <LearningPartnerFunnelPanel
          token={token}
          semester={lp.rankingSemester}
          onSemesterChange={lp.handleSemesterChange}
        />
      )}

      {lp.adminView === 'ranking' && (
        <LearningPartnerTeamRankingPanel
          token={token}
          semester={lp.rankingSemester}
          onSemesterChange={lp.setSemesterFilter}
          showWorkflowHint
        />
      )}

      {lp.adminView === 'teams' && (
        <>
          <LearningPartnerTeamsToolbar
            semesterFilter={lp.semesterFilter}
            onSemesterChange={lp.handleSemesterChange}
            statusFilter={lp.statusFilter}
            onStatusFilterChange={lp.handleStatusFilterChange}
            statusCounts={lp.statusCounts}
            searchTerm={lp.searchTerm}
            onSearchTermChange={lp.handleSearchTermChange}
            exporting={lp.exporting}
            onExport={lp.handleExport}
            teamsCount={lp.teams.length}
          />
          <LearningPartnerTeamsGrid teams={lp.teams} onViewDetail={lp.handleViewDetail} />
          <LearningPartnerTeamsPagination
            currentPage={lp.currentPage}
            totalPages={lp.totalPages}
            onPageChange={lp.setCurrentPage}
          />
        </>
      )}

      {lp.showDetailModal && lp.selectedTeam && (
        <LearningPartnerTeamDetailModal
          team={lp.selectedTeam}
          semesterFilter={lp.semesterFilter}
          onClose={lp.closeDetailModal}
        />
      )}
    </div>
  );
}
