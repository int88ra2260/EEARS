import React from 'react';
import { Badge, Button, Card, Spinner, Table } from 'react-bootstrap';
import {
  formatAttendanceCell,
  formatExamTypeLabel,
  formatLevelBadge,
  renderPersonalRegistrationBadge,
} from '../../../utils/classBestepDisplayHelpers';

export default function ClassBestepStudentsTable({
  loading,
  students,
  filters,
  pagination,
  exporting,
  onFilterChange,
  onExport,
  onShowStudentDetail,
  onOpenStudentJourney,
}) {
  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <h5 className="mb-0">學生 BESTEP 資訊</h5>
        <Button
          variant="outline-success"
          onClick={onExport}
          disabled={exporting || students.length === 0}
        >
          {exporting ? (
            <>
              <Spinner size="sm" className="me-2" />
              匯出中...
            </>
          ) : (
            <>
              <i className="fas fa-download me-2" />
              匯出 BESTEP Excel
            </>
          )}
        </Button>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2">載入中...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted">沒有找到符合條件的資料</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <Table striped hover>
                <thead>
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    <th>系所</th>
                    <th>報考項目</th>
                    <th>抵免項目</th>
                    <th>個人報名</th>
                    <th>團體報名</th>
                    <th>出席狀況</th>
                    <th>成績</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.studentId || index}>
                      <td>{student.studentId}</td>
                      <td>{student.studentName}</td>
                      <td>{student.department || '-'}</td>
                      <td>{formatExamTypeLabel(student.personalRegistration)}</td>
                      <td>{student.personalRegistration?.exemptionType ?? '無'}</td>
                      <td>{renderPersonalRegistrationBadge(student.personalRegistration)}</td>
                      <td>
                        {student.groupRegistration ? (
                          <div>
                            <Badge bg="info">{student.groupRegistration.teamName}</Badge>
                            {student.groupRegistration.rank && (
                              <div className="mt-1">
                                <small className="text-muted">
                                  名次: {student.groupRegistration.rank}
                                  {student.groupRegistration.rewardAmount
                                    && ` (獎勵: ${student.groupRegistration.rewardAmount}元)`}
                                </small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge bg="secondary">無</Badge>
                        )}
                      </td>
                      <td>{formatAttendanceCell(student.attendance)}</td>
                      <td>
                        {student.score ? (
                          <div>
                            <div className="mb-1">
                              <small>總分: <strong>{student.score.totalScore || '-'}</strong></small>
                            </div>
                            <div className="mb-1">
                              <small>
                                L: {formatLevelBadge(student.score.listeningLevel)} /
                                R: {formatLevelBadge(student.score.readingLevel)} /
                                S: {formatLevelBadge(student.score.speakingLevel)} /
                                W: {formatLevelBadge(student.score.writingLevel)}
                              </small>
                            </div>
                            {student.score.passed && <Badge bg="success">達標</Badge>}
                          </div>
                        ) : (
                          <Badge bg="secondary">未匯入</Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => onShowStudentDetail(student)}
                        >
                          查看詳情
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onOpenStudentJourney(student.studentId)}
                        >
                          學生歷程
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  顯示第 {(filters.page - 1) * filters.pageSize + 1} - {Math.min(filters.page * filters.pageSize, pagination.total)} 筆，
                  共 {pagination.total} 筆
                </div>
                <div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={filters.page === 1}
                    onClick={() => onFilterChange('page', filters.page - 1)}
                  >
                    上一頁
                  </Button>
                  <span className="mx-2">
                    第 {filters.page} 頁，共 {pagination.totalPages} 頁
                  </span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={filters.page === pagination.totalPages}
                    onClick={() => onFilterChange('page', filters.page + 1)}
                  >
                    下一頁
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
