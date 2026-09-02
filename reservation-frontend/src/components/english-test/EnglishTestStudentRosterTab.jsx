import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Form from 'react-bootstrap/Form';

import ImportUploadPanel from '../admin/import/ImportUploadPanel';
import ImportResultSummary from '../admin/import/ImportResultSummary';
import ImportErrorList from '../admin/import/ImportErrorList';

import { downloadBlob } from '../../services/englishTestApi';
import {
  deleteEnglishTestStudentRosterAdmin,
  downloadEnglishTestRosterSampleXlsx,
  fetchEnglishTestStudentRosterAdmin,
  updateEnglishTestStudentRosterMatchFields,
  uploadEnglishTestStudentRosterAdmin,
} from '../../services/englishTestRosterAdminApi';

const DEFAULT_LIMIT = 30;

const MATCH_FIELD_OPTIONS = [
  { key: 'studentId', label: '學號' },
  { key: 'name', label: '姓名' },
  { key: 'idNumber', label: '身分證字號' },
];

const DEFAULT_MATCH_FIELDS = {
  studentId: true,
  name: false,
  idNumber: true,
};

function formatMatchFieldsSummary(matchFields) {
  const selected = MATCH_FIELD_OPTIONS.filter((o) => matchFields?.[o.key]).map((o) => o.label);
  return selected.length ? selected.join('、') : '（未設定）';
}

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
  const [deleting, setDeleting] = useState(false);

  const [matchFields, setMatchFields] = useState(DEFAULT_MATCH_FIELDS);
  const [savedMatchFields, setSavedMatchFields] = useState(DEFAULT_MATCH_FIELDS);
  const [savingMatchFields, setSavingMatchFields] = useState(false);
  const [matchFieldsMessage, setMatchFieldsMessage] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchEnglishTestStudentRosterAdmin(token, { offset, limit });
      setEntries(data.entries || []);
      setTotalEntries(Number(data.totalEntries || 0));
      setUploadMeta(data.upload || null);
      const fields = data.matchFields || DEFAULT_MATCH_FIELDS;
      setMatchFields(fields);
      setSavedMatchFields(fields);
      setUploadResult(null);
    } catch (err) {
      setEntries([]);
      setTotalEntries(0);
      setUploadMeta(null);
      setUploadResult(null);
      // eslint-disable-next-line no-console
      console.error('載入在學名單預覽失敗:', err);
    } finally {
      setLoading(false);
    }
  }, [token, offset, limit]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const matchFieldsDirty = useMemo(
    () => MATCH_FIELD_OPTIONS.some((o) => !!matchFields[o.key] !== !!savedMatchFields[o.key]),
    [matchFields, savedMatchFields]
  );

  const hasAnyMatchField = useMemo(
    () => MATCH_FIELD_OPTIONS.some((o) => matchFields[o.key]),
    [matchFields]
  );

  const conflictsMapped = useMemo(() => {
    const conflicts = uploadResult?.conflicts;
    if (!Array.isArray(conflicts) || conflicts.length === 0) return [];
    return conflicts.map((c) => ({
      row: c.row ?? '-',
      field: '學號',
      message: '同一學號對應到多筆不一致資料（已跳過該學號）',
      value: [
        c.expectedIdNumber && c.actualIdNumber ? `${c.expectedIdNumber} / ${c.actualIdNumber}` : null,
        c.expectedNameZh && c.actualNameZh ? `${c.expectedNameZh} / ${c.actualNameZh}` : null,
      ]
        .filter(Boolean)
        .join('；') || '-',
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
        console.error('在學名單上傳失敗:', err);
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

  const handleMatchFieldToggle = useCallback((key) => {
    setMatchFieldsMessage(null);
    setMatchFields((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const stillHasOne = MATCH_FIELD_OPTIONS.some((o) => next[o.key]);
      if (!stillHasOne) return prev;
      return next;
    });
  }, []);

  const handleSaveMatchFields = useCallback(async () => {
    if (!token || !hasAnyMatchField) return;
    setSavingMatchFields(true);
    setMatchFieldsMessage(null);
    try {
      const data = await updateEnglishTestStudentRosterMatchFields(token, matchFields);
      const saved = data.matchFields || matchFields;
      setMatchFields(saved);
      setSavedMatchFields(saved);
      setMatchFieldsMessage({ variant: 'success', text: '比對欄位設定已儲存。' });
    } catch (err) {
      setMatchFieldsMessage({ variant: 'danger', text: err?.message || '儲存失敗' });
    } finally {
      setSavingMatchFields(false);
    }
  }, [token, matchFields, hasAnyMatchField]);

  const handleDeleteRoster = useCallback(async () => {
    if (!token) return;
    const ok = window.confirm(
      '確定要刪除目前在學名單對照表？\n刪除後，學生端身分驗證將不再比對名單，直到重新上傳。'
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteEnglishTestStudentRosterAdmin(token);
      setUploadResult(null);
      setOffset(0);
      await loadPreview();
    } catch (err) {
      window.alert(err?.message || '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }, [token, loadPreview]);

  const canLoadMore = offset + limit < totalEntries;
  const hasRoster = totalEntries > 0 || !!uploadMeta;

  return (
    <div className="pt-3">
      <Card className="mb-3">
        <Card.Header className="bg-secondary text-white py-2 small fw-semibold">在學名單比對設定</Card.Header>
        <Card.Body>
          <Alert variant="info" className="py-2 small mb-3">
            學生端於<strong>步驟二：身分驗證</strong>提交時，會依下方勾選的欄位與上傳的在學名單 Excel 比對；
            勾選多項時，須在同一筆 Excel 列全部符合才會通過。不符者無法繼續報名。
            請上傳僅含在學學生的名單；「學籍狀態」等其餘欄位不會自動篩選。
          </Alert>

          <div className="mb-3">
            <div className="small fw-semibold mb-2">比對欄位（至少勾選一項）</div>
            <div className="d-flex flex-wrap gap-3">
              {MATCH_FIELD_OPTIONS.map((option) => (
                <Form.Check
                  key={option.key}
                  type="checkbox"
                  id={`roster-match-${option.key}`}
                  label={option.label}
                  checked={!!matchFields[option.key]}
                  onChange={() => handleMatchFieldToggle(option.key)}
                  disabled={!token || savingMatchFields}
                />
              ))}
            </div>
            <div className="small text-muted mt-2">
              目前生效：{formatMatchFieldsSummary(savedMatchFields)}
              {matchFieldsDirty ? '（有未儲存的變更）' : null}
            </div>
            {matchFieldsMessage ? (
              <Alert variant={matchFieldsMessage.variant} className="py-2 small mt-2 mb-0">
                {matchFieldsMessage.text}
              </Alert>
            ) : null}
            <div className="mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveMatchFields}
                disabled={!token || savingMatchFields || !matchFieldsDirty || !hasAnyMatchField}
              >
                {savingMatchFields ? '儲存中…' : '儲存比對設定'}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header className="bg-secondary text-white py-2 small fw-semibold">上傳在學名單 Excel</Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button variant="outline-primary" size="sm" onClick={handleDownloadSample} disabled={!token || uploading}>
              下載名單範例檔（xlsx）
            </Button>
            {hasRoster ? (
              <Button variant="outline-danger" size="sm" onClick={handleDeleteRoster} disabled={!token || deleting || uploading}>
                {deleting ? '刪除中…' : '刪除目前名單'}
              </Button>
            ) : null}
          </div>

          <ImportUploadPanel
            title="上傳最新在學名單 Excel"
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
              Excel 表頭必須包含：`學號`、`身分證字號`、`姓名`。範例檔可直接下載使用。
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
              <ImportErrorList errors={conflictsMapped} title="衝突（同一學號資料不一致）" variant="warning" className="mb-0" />
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
                    <div className="mt-1">尚未上傳在學名單（目前沒有對照表，身分驗證不會比對）。</div>
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
                          暫無資料，請先上傳在學名單 Excel。
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
