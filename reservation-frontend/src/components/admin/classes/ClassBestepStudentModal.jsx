import React from 'react';
import { Badge, Button, Col, Modal, Row } from 'react-bootstrap';
import { formatLevelBadge, renderPersonalRegistrationBadge } from '../../../utils/classBestepDisplayHelpers';

function AttendanceDetail({ attendance }) {
  if (!attendance || Object.keys(attendance).length === 0) {
    return <p className="text-muted">未匯入</p>;
  }
  return (
    <div>
      {(attendance.L || attendance.R) && (
        <div className="mb-2">
          <strong>LR（聽讀）:</strong>
          {attendance.L && (
            <Badge bg={attendance.L.attended ? 'success' : 'danger'} className="ms-2">
              L {attendance.L.attended ? '出席' : '缺席'}
            </Badge>
          )}
          {attendance.R && (
            <Badge bg={attendance.R.attended ? 'success' : 'danger'} className="ms-2">
              R {attendance.R.attended ? '出席' : '缺席'}
            </Badge>
          )}
        </div>
      )}
      {(attendance.S || attendance.W) && (
        <div className="mb-2">
          <strong>SW（說寫）:</strong>
          {attendance.S && (
            <Badge bg={attendance.S.attended ? 'success' : 'danger'} className="ms-2">
              S {attendance.S.attended ? '出席' : '缺席'}
            </Badge>
          )}
          {attendance.W && (
            <Badge bg={attendance.W.attended ? 'success' : 'danger'} className="ms-2">
              W {attendance.W.attended ? '出席' : '缺席'}
            </Badge>
          )}
        </div>
      )}
      {attendance.LR && !attendance.L && !attendance.R && (
        <div className="mb-2">
          <strong>LR（聽讀）:</strong>
          <Badge bg={attendance.LR.attended ? 'success' : 'danger'} className="ms-2">
            {attendance.LR.attended ? '出席' : '缺席'}
          </Badge>
          <p className="mb-0 mt-1"><small>日期: {attendance.LR.examDate}</small></p>
          {attendance.LR.absentReason && (
            <p className="mb-0"><small>缺席原因: {attendance.LR.absentReason}</small></p>
          )}
        </div>
      )}
      {attendance.SW && !attendance.S && !attendance.W && (
        <div>
          <strong>SW（說寫）:</strong>
          <Badge bg={attendance.SW.attended ? 'success' : 'danger'} className="ms-2">
            {attendance.SW.attended ? '出席' : '缺席'}
          </Badge>
          <p className="mb-0 mt-1"><small>日期: {attendance.SW.examDate}</small></p>
          {attendance.SW.absentReason && (
            <p className="mb-0"><small>缺席原因: {attendance.SW.absentReason}</small></p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClassBestepStudentModal({
  show,
  student,
  onHide,
  onOpenRegistration,
}) {
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {student?.studentName} ({student?.studentId}) - BESTEP 詳細資訊
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {student && (
          <div>
            <Row className="mb-3">
              <Col md={6}>
                <h6>個人報名</h6>
                {student.personalRegistration ? (
                  <div>
                    <p>狀態: {renderPersonalRegistrationBadge(student.personalRegistration)}</p>
                    <p>報考項目: {student.personalRegistration.examTypeLabel || '—'}</p>
                    <p>抵免項目: {student.personalRegistration.exemptionType ?? '無'}</p>
                    <p>報名 ID: {student.personalRegistration.regId}</p>
                    <p>更新時間: {new Date(student.personalRegistration.updatedAt).toLocaleString('zh-TW')}</p>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="mt-1"
                      onClick={() => onOpenRegistration(student.personalRegistration.regId)}
                    >
                      開啟此筆報名（管理）
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted">未報名</p>
                )}
              </Col>
              <Col md={6}>
                <h6>團體報名</h6>
                {student.groupRegistration ? (
                  <div>
                    <p>隊伍名稱: <Badge bg="info">{student.groupRegistration.teamName}</Badge></p>
                    <p>角色: {student.groupRegistration.role === 'leader' ? '隊長' : '隊員'}</p>
                    {student.groupRegistration.rank && (
                      <>
                        <p>名次: {student.groupRegistration.rank}</p>
                        {student.groupRegistration.rewardAmount && (
                          <p>獎勵金額: {student.groupRegistration.rewardAmount} 元</p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">無</p>
                )}
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <h6>出席狀況</h6>
                <AttendanceDetail attendance={student.attendance} />
              </Col>
              <Col md={6}>
                <h6>成績</h6>
                {student.score ? (
                  <div>
                    <p>總分: <strong>{student.score.totalScore || '-'}</strong></p>
                    <p>整體等級: {formatLevelBadge(student.score.overallLevel)}</p>
                    <p>
                      達標: {student.score.passed
                        ? <Badge bg="success">是</Badge>
                        : <Badge bg="danger">否</Badge>}
                    </p>
                    <hr />
                    <p><strong>各項成績:</strong></p>
                    <p>聽力: {student.score.listeningScore || '-'} {formatLevelBadge(student.score.listeningLevel)}</p>
                    <p>閱讀: {student.score.readingScore || '-'} {formatLevelBadge(student.score.readingLevel)}</p>
                    <p>口說: {student.score.speakingScore || '-'} {formatLevelBadge(student.score.speakingLevel)}</p>
                    <p>寫作: {student.score.writingScore || '-'} {formatLevelBadge(student.score.writingLevel)}</p>
                  </div>
                ) : (
                  <p className="text-muted">未匯入</p>
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>關閉</Button>
      </Modal.Footer>
    </Modal>
  );
}
