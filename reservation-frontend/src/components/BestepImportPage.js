// src/components/BestepImportPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Form, 
  Alert, 
  Row, 
  Col,
  Tabs,
  Tab
} from 'react-bootstrap';
import { handleAPIError } from '../utils/errorHandler';
import { importBestepAttendance, importBestepScores } from '../services/bestepAdminApi';
import {
  downloadBestepAttendanceTemplate,
  downloadBestepScoreTemplate,
} from '../utils/bestepImportTemplates';
import ImportUploadPanel from './admin/import/ImportUploadPanel';
import ImportResultSummary from './admin/import/ImportResultSummary';
import ImportErrorList from './admin/import/ImportErrorList';
import LearningPartnerTeamRankingPanel from './learning-partner/LearningPartnerTeamRankingPanel';

const SEMESTER_OPTIONS = [
  { value: '114-1', label: '114-1學期' },
  { value: '113-2', label: '113-2學期' },
  { value: '114-2', label: '114-2學期' },
  { value: '115-1', label: '115-1學期' },
  { value: '115-2', label: '115-2學期' }
];

function collectBestepImportIssues(result) {
  const warnings = [];
  const errors = [];
  const skipped = [];

  if (!result || typeof result !== 'object') {
    return { warnings, errors, skipped };
  }

  if (Array.isArray(result.warnings)) {
    warnings.push(...result.warnings);
  }

  if (Array.isArray(result.errors)) {
    errors.push(...result.errors);
  }
  if (Array.isArray(result.validationErrors)) {
    errors.push(...result.validationErrors);
  }
  if (Array.isArray(result.errorDetails)) {
    errors.push(...result.errorDetails);
  }

  if (Array.isArray(result.skippedDetails)) {
    skipped.push(...result.skippedDetails);
  } else if (Array.isArray(result.skipped) && result.skipped.length && typeof result.skipped[0] === 'object') {
    skipped.push(...result.skipped);
  }

  return { warnings, errors, skipped };
}

function getBestepSuccessCount(result) {
  if (!result || typeof result !== 'object') return 0;
  const keys = ['successCount', 'imported', 'success'];
  for (const key of keys) {
    if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
      const n = Number(result[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function getBestepSkippedCount(result) {
  if (!result || typeof result !== 'object') return 0;
  const keys = ['skippedCount', 'skipped'];
  for (const key of keys) {
    if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
      const n = Number(result[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function getBestepTotalCount(result) {
  if (!result || typeof result !== 'object') return undefined;
  const keys = ['totalRows', 'total', 'totalCount'];
  for (const key of keys) {
    if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
      const n = Number(result[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export default function BestepImportPage() {
  const navigate = useNavigate();
  
  // 出席資料匯入
  const [attendanceData, setAttendanceData] = useState({
    semester: '114-1',
    examType: 'LR',
    examDate: '',
    file: null
  });
  const [attendanceUploading, setAttendanceUploading] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [attendanceError, setAttendanceError] = useState('');

  // 成績資料匯入
  const [scoreData, setScoreData] = useState({
    semester: '114-1',
    file: null
  });
  const [scoreUploading, setScoreUploading] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreError, setScoreError] = useState('');

  const [rankingSemester, setRankingSemester] = useState('114-1');

  // 匯入出席資料
  const handleAttendanceImport = async () => {
    if (!attendanceData.file) {
      setAttendanceError('請選擇檔案');
      return;
    }

    if (!attendanceData.examDate) {
      setAttendanceError('請輸入考試日期');
      return;
    }

    setAttendanceUploading(true);
    setAttendanceError('');
    setAttendanceResult(null);

    try {
      const formData = new FormData();
      formData.append('file', attendanceData.file);
      formData.append('semester', attendanceData.semester);
      formData.append('examType', attendanceData.examType);
      formData.append('examDate', attendanceData.examDate);

      const token = localStorage.getItem('token');
      const result = await importBestepAttendance(token, formData);
      setAttendanceResult(result);
      setAttendanceData((prev) => ({ ...prev, file: null }));
    } catch (err) {
      setAttendanceError(handleAPIError(err));
    } finally {
      setAttendanceUploading(false);
    }
  };

  const handleAttendanceFormSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    if (fileFromPanel && fileFromPanel !== attendanceData.file) {
      setAttendanceData((prev) => ({ ...prev, file: fileFromPanel }));
    }
    await handleAttendanceImport();
  };

  // 匯入成績資料
  const handleScoreImport = async () => {
    if (!scoreData.file) {
      setScoreError('請選擇檔案');
      return;
    }

    setScoreUploading(true);
    setScoreError('');
    setScoreResult(null);

    try {
      const formData = new FormData();
      formData.append('file', scoreData.file);
      formData.append('semester', scoreData.semester);

      const token = localStorage.getItem('token');
      const result = await importBestepScores(token, formData);
      setScoreResult(result);
      setScoreData((prev) => ({ ...prev, file: null }));
    } catch (err) {
      setScoreError(handleAPIError(err));
    } finally {
      setScoreUploading(false);
    }
  };

  const handleScoreFormSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    if (fileFromPanel && fileFromPanel !== scoreData.file) {
      setScoreData((prev) => ({ ...prev, file: fileFromPanel }));
    }
    await handleScoreImport();
  };

  // 下載錯誤報表
  const handleDownloadErrorReport = (errorFileUrl) => {
    if (errorFileUrl) {
      window.open(errorFileUrl, '_blank');
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <p className="text-muted small mb-0">
          <i className="fas fa-file-upload me-2" aria-hidden="true"></i>
          由 Excel 匯入 LR（聽讀）、SW（說寫）等 BESTEP 出席資料。
        </p>
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate('/admin/classes')}
        >
          <i className="fas fa-arrow-left me-2"></i>
          返回
        </Button>
      </div>

      <Tabs defaultActiveKey="attendance" className="mb-4">
        {/* 出席資料匯入 */}
        <Tab eventKey="attendance" title="出席資料匯入">
          <Card>
            <Card.Header>
              <h5>匯入出席資料</h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <strong>說明：</strong>
                <ul className="mb-0 mt-2">
                  <li>請分別匯入 LR（聽讀）和 SW（說寫）兩場考試的出席資料</li>
                  <li>檔案格式：Excel (.xlsx, .xls)</li>
                  <li>建議欄位：學號、姓名、報考項目、L/R/S/W 出缺席、缺席原因（簡易格式：學號、姓名、出席狀態）</li>
                  <li>系統會自動識別欄位名稱（支援中英文）</li>
                  <li>可點「下載出席匯入範例」取得標準表頭與填寫說明</li>
                  <li>只有「報名成功」（status='success'）的學生才會被匯入</li>
                </ul>
              </Alert>

              <Row className="g-3 mb-3">
                <Col md={3}>
                  <Form.Label>學期 <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    value={attendanceData.semester}
                    onChange={(e) => setAttendanceData((prev) => ({ ...prev, semester: e.target.value }))}
                    disabled={attendanceUploading}
                  >
                    {SEMESTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>考試類型 <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    value={attendanceData.examType}
                    onChange={(e) => setAttendanceData((prev) => ({ ...prev, examType: e.target.value }))}
                    disabled={attendanceUploading}
                  >
                    <option value="LR">LR（聽讀）</option>
                    <option value="SW">SW（說寫）</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>考試日期 <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    value={attendanceData.examDate}
                    onChange={(e) => setAttendanceData((prev) => ({ ...prev, examDate: e.target.value }))}
                    disabled={attendanceUploading}
                  />
                </Col>
              </Row>

              {attendanceError && (
                <Alert variant="danger" className="mb-3">
                  {attendanceError}
                </Alert>
              )}

              <ImportUploadPanel
                title="匯入出席資料"
                description="請選擇 BESTEP 出席名單 Excel 檔案並送出。"
                acceptedFileTypes=".xlsx,.xls"
                selectedFile={attendanceData.file}
                onFileChange={(file) =>
                  setAttendanceData((prev) => ({
                    ...prev,
                    file: file || null
                  }))
                }
                onSubmit={handleAttendanceFormSubmit}
                isSubmitting={attendanceUploading}
                submitLabel={attendanceUploading ? '匯入中...' : '開始匯入'}
                disabled={
                  attendanceUploading ||
                  !attendanceData.semester ||
                  !attendanceData.examType ||
                  !attendanceData.examDate
                }
                notice={(
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={downloadBestepAttendanceTemplate}
                    disabled={attendanceUploading}
                  >
                    <i className="fas fa-download me-2" aria-hidden="true"></i>
                    下載出席匯入範例
                  </Button>
                )}
                className="border"
              />

              {attendanceResult && (
                <div className="mt-3">
                  <ImportResultSummary
                    result={attendanceResult}
                    successCount={getBestepSuccessCount(attendanceResult)}
                    skippedCount={getBestepSkippedCount(attendanceResult)}
                    totalCount={getBestepTotalCount(attendanceResult)}
                    failedCount={
                      Array.isArray(attendanceResult.errors) ? attendanceResult.errors.length : undefined
                    }
                    className="mb-2"
                  />
                  <ImportErrorList
                    errors={collectBestepImportIssues(attendanceResult).errors}
                    title="錯誤明細"
                  />
                  <ImportErrorList
                    errors={collectBestepImportIssues(attendanceResult).skipped}
                    title="略過明細"
                    variant="info"
                    className="mt-2"
                  />
                  {attendanceResult.errorFileUrl && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleDownloadErrorReport(attendanceResult.errorFileUrl)}
                    >
                      <i className="fas fa-download me-2"></i>
                      下載錯誤報表
                    </Button>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* 成績資料匯入 */}
        <Tab eventKey="scores" title="成績資料匯入">
          <Card>
            <Card.Header>
              <h5>匯入成績資料</h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <strong>說明：</strong>
                <ul className="mb-0 mt-2">
                  <li>檔案格式：Excel (.xlsx, .xls)</li>
                  <li>必須包含欄位：學號、姓名、聽力分數、閱讀分數、口說分數、寫作分數、各項 CEFR 等級</li>
                  <li>系統會自動識別欄位名稱（支援多種變體）</li>
                  <li>系統會自動計算總分、整體等級和達標狀態</li>
                  <li>可點「下載成績匯入範例」取得標準表頭與填寫說明</li>
                  <li>只有「報名成功」（status='success'）的學生才會被匯入</li>
                </ul>
              </Alert>

              <Row className="g-3 mb-3">
                <Col md={4}>
                  <Form.Label>學期 <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    value={scoreData.semester}
                    onChange={(e) => setScoreData((prev) => ({ ...prev, semester: e.target.value }))}
                    disabled={scoreUploading}
                  >
                    {SEMESTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              {scoreError && (
                <Alert variant="danger" className="mb-3">
                  {scoreError}
                </Alert>
              )}

              <ImportUploadPanel
                title="匯入成績資料"
                description="請選擇 BESTEP 成績 Excel 檔案並送出。"
                acceptedFileTypes=".xlsx,.xls"
                selectedFile={scoreData.file}
                onFileChange={(file) =>
                  setScoreData((prev) => ({
                    ...prev,
                    file: file || null
                  }))
                }
                onSubmit={handleScoreFormSubmit}
                isSubmitting={scoreUploading}
                submitLabel={scoreUploading ? '匯入中...' : '開始匯入'}
                disabled={scoreUploading || !scoreData.semester}
                notice={(
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={downloadBestepScoreTemplate}
                    disabled={scoreUploading}
                  >
                    <i className="fas fa-download me-2" aria-hidden="true"></i>
                    下載成績匯入範例
                  </Button>
                )}
                className="border"
              />

              {scoreResult && (
                <div className="mt-3">
                  <ImportResultSummary
                    result={scoreResult}
                    successCount={getBestepSuccessCount(scoreResult)}
                    skippedCount={getBestepSkippedCount(scoreResult)}
                    totalCount={getBestepTotalCount(scoreResult)}
                    failedCount={Array.isArray(scoreResult.errors) ? scoreResult.errors.length : undefined}
                    className="mb-2"
                  />
                  <ImportErrorList
                    errors={collectBestepImportIssues(scoreResult).errors}
                    title="錯誤明細"
                  />
                  <ImportErrorList
                    errors={collectBestepImportIssues(scoreResult).skipped}
                    title="略過明細"
                    variant="info"
                    className="mt-2"
                  />
                  {scoreResult.errorFileUrl && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleDownloadErrorReport(scoreResult.errorFileUrl)}
                    >
                      <i className="fas fa-download me-2"></i>
                      下載錯誤報表
                    </Button>
                  )}
                  {getBestepSuccessCount(scoreResult) > 0 && (
                    <Alert variant="success" className="mt-3 mb-0">
                      成績已寫入。請切換至「團體名次」分頁，選擇相同學期後按「重新計算名次」更新排行榜。
                    </Alert>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* 團體名次 */}
        <Tab eventKey="ranking" title="團體名次">
          <LearningPartnerTeamRankingPanel
            semester={rankingSemester}
            onSemesterChange={setRankingSemester}
            showWorkflowHint
            importPageLink={null}
          />
        </Tab>
      </Tabs>
    </div>
  );
}
