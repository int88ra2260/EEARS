import React, { useMemo } from 'react';
import { Alert, Button, Form, Modal, Nav, Spinner, Table, Tab } from 'react-bootstrap';
import ImportCenterNotice from '../import/ImportCenterNotice';
import ImportUploadPanel from '../import/ImportUploadPanel';
import { getCurrentSemester, SEMESTER_OPTIONS as SEMESTER_OPTIONS_UTILS } from '../../../utils/semesterUtils';

function CourseMetaFields({
  semester,
  courseName,
  courseCode,
  teacherName,
  disabled,
  onSemesterChange,
  onCourseNameChange,
  onCourseCodeChange,
  onTeacherNameChange,
  semesterHint,
}) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>學期 <span className="text-danger">*</span></Form.Label>
        <Form.Select
          value={semester}
          onChange={(e) => onSemesterChange(e.target.value)}
          disabled={disabled}
        >
          {SEMESTER_OPTIONS_UTILS.filter((opt) => opt.value !== '').map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Form.Select>
        <Form.Text className="text-muted">
          {semesterHint || `預設為當前學期（${getCurrentSemester() || '114-1'}），可手動選擇其他學期`}
        </Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>課程名稱 <span className="text-danger">*</span></Form.Label>
        <Form.Control
          type="text"
          placeholder="例如：賞析音樂學英語（中級）"
          value={courseName}
          onChange={(e) => onCourseNameChange(e.target.value)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>課程代碼 <span className="text-danger">*</span></Form.Label>
        <Form.Control
          type="text"
          placeholder="例如：GEAIE610"
          value={courseCode}
          onChange={(e) => onCourseCodeChange(e.target.value)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>老師姓名 <span className="text-danger">*</span></Form.Label>
        <Form.Control
          type="text"
          placeholder="請輸入老師姓名"
          value={teacherName}
          onChange={(e) => onTeacherNameChange(e.target.value)}
          disabled={disabled}
        />
        <Form.Text className="text-muted">此老師將負責此班級的學生參與狀況追蹤</Form.Text>
      </Form.Group>
    </>
  );
}

function PdfPreviewTable({ students }) {
  const rows = Array.isArray(students) ? students : [];
  if (!rows.length) {
    return <p className="small text-muted mb-0">尚未解析出學生資料</p>;
  }
  return (
    <div className="table-responsive" style={{ maxHeight: 280 }}>
      <Table size="sm" bordered hover className="mb-0 align-middle">
        <thead className="table-light sticky-top">
          <tr>
            <th style={{ width: 48 }}>#</th>
            <th>學號</th>
            <th>姓名</th>
            <th>系所</th>
            <th style={{ width: 64 }}>年級</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.seq}-${row.studentId}`}>
              <td>{row.seq}</td>
              <td className="font-monospace small">{row.studentId}</td>
              <td>{row.studentName || '—'}</td>
              <td className="small">{row.department || '—'}</td>
              <td>{row.grade ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default function ClassOverviewUploadModal({
  show,
  error,
  uploading,
  activeTab,
  onTabChange,
  uploadSemester,
  uploadCourseName,
  uploadCourseCode,
  uploadTeacherName,
  uploadFile,
  pdfFile,
  pdfPreview,
  pdfPreviewLoading,
  onHide,
  onSemesterChange,
  onCourseNameChange,
  onCourseCodeChange,
  onTeacherNameChange,
  onFileChange,
  onPdfFileChange,
  onPdfPreview,
  onExcelSubmit,
  onPdfSubmit,
  onDownloadSample,
}) {
  const suggestedClassName = useMemo(() => {
    const name = String(uploadCourseName || '').trim();
    const code = String(uploadCourseCode || '').trim();
    if (name && code) return `${name} ${code}`;
    return name || code || '';
  }, [uploadCourseName, uploadCourseCode]);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>匯入班級名單</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ImportCenterNotice variant="import" compact className="mb-2" />
        {error && show ? (
          <Alert variant="danger" className="py-2">{error}</Alert>
        ) : null}

        <Tab.Container activeKey={activeTab} onSelect={(key) => key && onTabChange(key)}>
          <Nav variant="tabs" className="mb-3">
            <Nav.Item>
              <Nav.Link eventKey="excel" disabled={uploading || pdfPreviewLoading}>Excel 匯入</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="pdf" disabled={uploading || pdfPreviewLoading}>PDF 匯入</Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="excel">
              <CourseMetaFields
                semester={uploadSemester}
                courseName={uploadCourseName}
                courseCode={uploadCourseCode}
                teacherName={uploadTeacherName}
                disabled={uploading}
                onSemesterChange={onSemesterChange}
                onCourseNameChange={onCourseNameChange}
                onCourseCodeChange={onCourseCodeChange}
                onTeacherNameChange={onTeacherNameChange}
              />
              {suggestedClassName ? (
                <Alert variant="light" className="py-2 small border">
                  寫入班級名稱：<strong>{suggestedClassName}</strong>
                </Alert>
              ) : null}
              <ImportUploadPanel
                title="上傳班級名冊（Excel）"
                description="選擇 Excel 檔案後按「上傳」送出。"
                acceptedFileTypes=".xlsx,.xls"
                selectedFile={uploadFile}
                onFileChange={(file) => onFileChange(file || null)}
                onSubmit={onExcelSubmit}
                isSubmitting={uploading}
                submitLabel={uploading ? '上傳中...' : '上傳'}
                disabled={uploading}
                className="border"
                notice={(
                  <div>
                    <strong>檔案格式要求：</strong>
                    <ul className="mb-2 mt-1 ps-3">
                      <li>必須包含：學號、姓名</li>
                      <li>可選包含：系所、年級、email</li>
                      <li>支援中英文欄位名稱</li>
                      <li>學期／課程名稱／課程代碼／老師請於上方填寫</li>
                    </ul>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={onDownloadSample}
                      disabled={uploading}
                    >
                      <i className="fas fa-download me-1" aria-hidden="true" />
                      下載範本
                    </Button>
                  </div>
                )}
              />
            </Tab.Pane>

            <Tab.Pane eventKey="pdf">
              <Alert variant="info" className="py-2 small">
                請上傳選課系統（selcrs）「修課學生名單」PDF。系統會自動帶出學期、課程名稱、課程代碼、老師姓名，並預覽學生清單後再確認匯入。
              </Alert>

              <ImportUploadPanel
                title="上傳修課名單（PDF）"
                description="選擇 PDF 後先按「解析預覽」，確認無誤再匯入。"
                acceptedFileTypes=".pdf"
                selectedFile={pdfFile}
                onFileChange={(file) => onPdfFileChange(file || null)}
                onSubmit={onPdfPreview}
                isSubmitting={pdfPreviewLoading}
                submitLabel={pdfPreviewLoading ? '解析中...' : '解析預覽'}
                disabled={uploading || pdfPreviewLoading}
                className="border mb-3"
                notice={(
                  <div className="small">
                    <strong>支援來源：</strong>
                    教務選課系統列印／另存的修課學生名單（需可選取文字，不支援純掃描圖）。
                  </div>
                )}
              />

              {pdfPreviewLoading ? (
                <div className="text-center py-3 text-muted">
                  <Spinner animation="border" size="sm" className="me-2" />
                  正在解析 PDF…
                </div>
              ) : null}

              {pdfPreview ? (
                <>
                  <CourseMetaFields
                    semester={uploadSemester}
                    courseName={uploadCourseName}
                    courseCode={uploadCourseCode}
                    teacherName={uploadTeacherName}
                    disabled={uploading}
                    onSemesterChange={onSemesterChange}
                    onCourseNameChange={onCourseNameChange}
                    onCourseCodeChange={onCourseCodeChange}
                    onTeacherNameChange={onTeacherNameChange}
                    semesterHint="已從 PDF 帶入，可手動修正後再匯入"
                  />
                  {suggestedClassName ? (
                    <Alert variant="light" className="py-2 small border">
                      寫入班級名稱：<strong>{suggestedClassName}</strong>
                      {pdfPreview.stats ? (
                        <span className="ms-2 text-muted">
                          （解析 {pdfPreview.stats.studentCount} 人）
                        </span>
                      ) : null}
                    </Alert>
                  ) : null}
                  {(pdfPreview.warnings || []).length ? (
                    <Alert variant="warning" className="py-2 small">
                      {(pdfPreview.warnings || []).slice(0, 5).map((w) => (
                        <div key={w}>{w}</div>
                      ))}
                    </Alert>
                  ) : null}
                  <div className="mb-2 fw-semibold">學生預覽（學號／姓名／系所／年級）</div>
                  <PdfPreviewTable students={pdfPreview.students} />
                  <div className="d-grid mt-3">
                    <Button
                      variant="primary"
                      onClick={onPdfSubmit}
                      disabled={uploading || pdfPreviewLoading}
                    >
                      {uploading ? '匯入中...' : `確認匯入 ${pdfPreview.stats?.studentCount || 0} 位學生`}
                    </Button>
                  </div>
                </>
              ) : null}
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={uploading || pdfPreviewLoading}>取消</Button>
      </Modal.Footer>
    </Modal>
  );
}
