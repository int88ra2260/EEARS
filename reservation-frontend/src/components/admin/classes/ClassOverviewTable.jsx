import React from 'react';
import { Button, Card, ProgressBar, Spinner, Table } from 'react-bootstrap';

export default function ClassOverviewTable({
  loading,
  data,
  filters,
  pagination,
  canManageClasses,
  onFilterChange,
  onViewDetail,
  onViewBestep,
  onDelete,
}) {
  return (
    <Card>
      <Card.Header><h5>班級統計</h5></Card.Header>
      <Card.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2">載入中...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted">沒有找到符合條件的資料</p>
          </div>
        ) : (
          <>
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>班級名稱</th>
                  <th>老師姓名</th>
                  <th>名冊人數</th>
                  <th>至少參與人數</th>
                  <th>參與率</th>
                  <th>簽到總次數</th>
                  <th>平均參與次數</th>
                  <th>No-shows總數</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.classId}>
                    <td>{item.className}</td>
                    <td>{item.teacherName || '-'}</td>
                    <td>{item.studentCount}</td>
                    <td>{item.participatedCount}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <ProgressBar
                          now={item.coverage}
                          style={{ width: '60px', height: '20px' }}
                          className="me-2"
                        />
                        <span>{item.coverage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>{item.attendedCountTotal}</td>
                    <td>{item.avgAttendPerStudent}</td>
                    <td>{item.noShowCountTotal}</td>
                    <td>
                      <div>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => onViewDetail(item.classId)}
                        >
                          查看明細
                        </Button>
                        <Button
                          variant="outline-info"
                          size="sm"
                          className="me-2"
                          onClick={() => onViewBestep(item.classId)}
                        >
                          BESTEP
                        </Button>
                      </div>
                      {canManageClasses && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => onDelete(item)}
                        >
                          刪除資料
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
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
