import React from 'react';
import { Badge, Button, Card, Spinner, Table } from 'react-bootstrap';
import { formatTotalHours } from '../../../utils/classDetailHelpers';

function AllocationStatusBadge({ status, label }) {
  if (!label) return <span className="text-muted">—</span>;
  if (status === 'unallocated') return <Badge bg="warning" text="dark">{label}</Badge>;
  if (status === 'pending') return <Badge bg="secondary">{label}</Badge>;
  if (status === 'allocated_elsewhere') return <Badge bg="info">{label}</Badge>;
  return <Badge bg="success">{label}</Badge>;
}

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
        <h5 className="mb-1">學生明細</h5>
        <div className="small text-muted">
          「總時數」為課堂加分依據；「全站累計」僅供參考，不可兩邊重複加分。
        </div>
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
                    <th>總點數</th>
                    <th>全站累計時數（僅參考）</th>
                    <th>全站累計計點（僅參考）</th>
                    <th>配置狀態</th>
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
                      <td className="text-muted">{formatTotalHours(student.siteTotalHours)}</td>
                      <td className="text-muted">{student.sitePointScore || '0'}</td>
                      <td>
                        <AllocationStatusBadge
                          status={student.allocationStatus}
                          label={student.allocationStatusLabel}
                        />
                      </td>
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
                    disabled={filters.page <= 1}
                    onClick={() => onFilterChange('page', filters.page - 1)}
                    className="me-2"
                  >
                    上一頁
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={filters.page >= pagination.totalPages}
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
