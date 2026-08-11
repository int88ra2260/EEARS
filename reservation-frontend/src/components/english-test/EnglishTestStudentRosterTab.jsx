import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';

import ImportUploadPanel from '../admin/import/ImportUploadPanel';
import ImportResultSummary from '../admin/import/ImportResultSummary';
import ImportErrorList from '../admin/import/ImportErrorList';

import { downloadBlob } from '../../services/englishTestApi';
import {
  downloadEnglishTestRosterSampleXlsx,
  fetchEnglishTestStudentRosterAdmin,
  uploadEnglishTestStudentRosterAdmin,
} from '../../services/englishTestRosterAdminApi';

const DEFAULT_LIMIT = 30;

export default function EnglishTestStudentRosterTab({ token }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [uploadMeta, setUploadMeta] = useState(null);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(DEFAULT_LIMIT);
  const [uploading, setUploading] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchEnglishTestStudentRosterAdmin(token, { offset, limit });
      setEntries(data.entries || []);
      setTotalEntries(Number(data.totalEntries || 0));
      setUploadMeta(data.upload || null);
      setUploadResult(null);
    } catch (err) {
      setEntries([]);
      setTotalEntries(0);
      setUploadMeta(null);
      setUploadResult(null);
      // eslint-disable-next-line no-console
      console.error('載入學名單預覽失敗:', err);
    } finally {
      setLoading(false);
    }
  }, [token, offset, limit]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const conflictsMapped = useMemo(() => {
    const conflicts = uploadResult?.conflicts;
    if (!Array.isArray(conflicts) || conflicts.length === 0) return [];
    return conflicts.map((c) => ({
      row: c.row ?? '-',
      field: '學號',
      message: '同一學號對應到多筆身分證字號（已跳過該學號）',
      value: c.expectedIdNumber && c.actualIdNumber ? `${c.expectedIdNumber} / ${c.actualIdNumber}` : '-',
      raw: c,
    }));
  }, [uploadResult]);

  const invalidRows = uploadResult?.invalidRows || [];

  const handleUpload = useCallback(
    async (event, file) => {
      if (!file || !token) return;
      setUploading(true);
      try {
        const result = await uploadEnglishTestStudentRosterAdmin(token, file);
        setUploadResult(result);
        setSelectedFile(null);
        setOffset(0);

        // 重新載入最新預覽
        const data = await fetchEnglishTestStudentRosterAdmin(token, { offset: 0, limit });
        setEntries(data.entries || []);
        setTotalEntries(Number(data.totalEntries || 0));
        setUploadMeta(data.upload || null);
      } catch (err) {
        setUploadResult({
          success: false,
          message: err?.message || '上傳失敗',
        });
        // eslint-disable-next-line no-console
        console.error('學名單上傳失敗:', err);
      } finally {
        setUploading(false);
      }
    },
    [token, limit]
  );

  const handleDownloadSample = useCallback(async () => {
    if (!token) return;
    const blob = await downloadEnglishTestRosterSampleXlsx(token);
    downloadBlob(blob, 'english-test-student-roster-sample.xlsx');
  }, [token]);

  const canLoadMore = offset + limit < totalEntries;

  return (
    <div className="pt-3">
      <Card className="mb-3">
        <Card.Header className="bg-secondary text-white py-2 small fw-semibold">學名單比對（學號/身分證）</Card.Header>
        <Card.Body>
          <Alert variant="info" className="py-2 small mb-3">
            上傳後會依 Excel 的「學號」「身分證字號」建立對照表，並在學生端報名時直接阻擋不相符的資料。
            系統僅使用這兩欄進行比對（其餘欄位可忽略）。
          </Alert>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button variant="outline-primary" size="sm" onClick={handleDownloadSample} disabled={!token || uploading}>
              下載名單範例檔（xlsx）
            </Button>
          </div>

          <ImportUploadPanel
            title="上傳最新學名單 Excel"
            description="上傳時會自動覆蓋先前的對照資料（只保留最新一份）。"
            acceptedFileTypes=".xlsx,.xls"
            selectedFile={selectedFile}
            onFileChange={setSelectedFile}
            onSubmit={handleUpload}
            isSubmitting={uploading}
            submitLabel={uploading ? '上傳中…' : '開始上傳'}
            disabled={!token || uploading}
            className="border"
          >
            <div className="small text-muted">
              Excel 表頭必須包含：`學號`、`身分證字號`。範例檔可直接下載使用。
            </div>
          </ImportUploadPanel>

          {uploadResult?.success !== true && (uploadResult?.message || uploadResult?.error) ? (
            <Alert variant="warning" className="mt-3 py-2 small">
              {uploadResult?.message || uploadResult?.error}
            </Alert>
          ) : null}

          {uploadResult && uploadResult?.success === true ? (
            <div className="mt-3">
              <ImportResultSummary
                result={uploadResult}
                successCount={uploadResult.insertedCount}
                failedCount={invalidRows.length}
                skippedCount={uploadResult.conflictCount}
                totalCount={uploadResult.upload?.rowCount}
                className="mb-2"
                showRawResult={false}
              />
              <ImportErrorList errors={invalidRows} title="無效列明細" variant="danger" className="mb-2" />
              <ImportErrorList errors={conflictsMapped} title="衝突（重複學號且身分證不一致）" variant="warning" className="mb-0" />
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="bg-primary text-white py-2 small fw-semibold">最新對照表預覽</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span className="small text-muted">載入中…</span>
            </div>
          ) : (
            <>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <div className="small text-muted">
                  總筆數：<strong>{totalEntries}</strong>
                  ，目前顯示：{Math.min(totalEntries, offset + entries.length)} 筆
                  {uploadMeta?.fileNameOriginal ? (
                    <>
                      <div className="mt-1">
                        最新上傳檔案：<strong>{uploadMeta.fileNameOriginal}</strong>
                      </div>
                      <div className="mt-1">
                        列數：{uploadMeta.rowCount ?? '-'}；有效：{uploadMeta.validCount ?? '-'}；衝突/略過：{uploadMeta.conflictCount ?? '-'}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1">尚未上傳學名單（目前沒有對照表）。</div>
                  )}
                </div>
                {canLoadMore ? (
                  <Button size="sm" variant="outline-primary" onClick={() => setOffset((o) => o + limit)} disabled={loading}>
                    載入更多
                  </Button>
                ) : null}
              </div>

              <div className="table-responsive">
                <Table size="sm" bordered hover className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '160px' }}>學號</th>
                      <th style={{ width: '160px' }}>身分證字號</th>
                      <th>姓名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length ? (
                      entries.map((r) => (
                        <tr key={r.studentId}>
                          <td style={{ fontFamily: 'monospace' }}>{r.studentId}</td>
                          <td style={{ fontFamily: 'monospace' }}>{r.idNumber}</td>
                          <td>{r.nameZh || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center text-muted">
                          暫無資料，請先上傳學名單 Excel。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

