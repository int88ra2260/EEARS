import React from 'react';
import { Badge, Button, Card, Spinner, Table } from 'react-bootstrap';
import { formatTotalHours } from '../../../utils/classDetailHelpers';

export default function ClassDetailStudentsTable({
  loading,
  data,
  filters,
  pagination,
  onFilterChange,
  onOpenStudentJourney,
}) {
  return (
    <Card>
      <Card.Header>
        <h5>學生明細</h5>
      </Card.Header>
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
            <div className="table-responsive">
              <Table striped hover>
                <thead>
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    <th>系所</th>
                    <th>總時數</th>
                    <th>計點數</th>
                    <th>最後簽到日</th>
                    <th>黑名單</th>
                    <th>教學評估</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((student, index) => (
                    <tr key={student.studentId || index}>
                      <td>{student.studentId}</td>
                      <td>{student.studentName}</td>
                      <td>{student.department || '-'}</td>
                      <td>{formatTotalHours(student.totalHours)}</td>
                      <td>{student.pointScore || '0'}</td>
                      <td>{student.lastAttendAt || '-'}</td>
                      <td>
                        {student.isBlacklisted ? (
                          <Badge bg="danger">是</Badge>
                        ) : (
                          <Badge bg="secondary">否</Badge>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => onOpenStudentJourney(student.studentId)}
                        >
                          查看學生歷程
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
                  顯示第 {(filters.page - 1) * filters.pageSize + 1} -{' '}
                  {Math.min(filters.page * filters.pageSize, pagination.total)} 筆，
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
