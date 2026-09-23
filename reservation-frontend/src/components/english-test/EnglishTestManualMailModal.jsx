import React, { useEffect, useState } from 'react';
import {
  deleteEnglishTestMailTemplate,
  fetchEnglishTestMailOptions,
  fetchEnglishTestMailSends,
  saveEnglishTestMailTemplate,
} from '../../services/englishTestApi';

const PLACEHOLDER_HINT = '{{studentNameZh}}、{{studentId}}、{{name}}、{{email}}、{{examTypeZh}}、{{statusZh}}、{{rejectionReasonsText}}、{{registrationShortLink}}';

const EMPTY_TEMPLATE = { id: null, name: '', subjectTemplate: '', bodyTemplate: '' };

function formatSentAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-TW', { hour12: false });
}

export default function EnglishTestManualMailModal({
  token,
  open,
  panel,
  onPanelChange,
  onClose,
  selectedIds,
  sending,
  onSend,
}) {
  const [catalog, setCatalog] = useState([]);
  const [custom, setCustom] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [source, setSource] = useState('catalog');
  const [templateKey, setTemplateKey] = useState('');
  const [customTemplateId, setCustomTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(EMPTY_TEMPLATE);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [studentQuery, setStudentQuery] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoadingOptions(true);
    setOptionsError('');
    fetchEnglishTestMailOptions(token)
      .then((data) => {
        if (cancelled) return;
        const nextCatalog = data.catalog || [];
        const nextCustom = data.custom || [];
        setCatalog(nextCatalog);
        setCustom(nextCustom);
        setTemplateKey((current) => current || nextCatalog[0]?.key || '');
        setCustomTemplateId((current) => current || (nextCustom[0] ? String(nextCustom[0].id) : ''));
      })
      .catch((error) => {
        if (!cancelled) setOptionsError(error.message || '載入寄信選項失敗');
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open || panel !== 'history') return undefined;
    let cancelled = false;
    setLoadingLogs(true);
    setLogError('');
    fetchEnglishTestMailSends(token, {
      page: String(logPage),
      limit: '20',
      studentId: studentQuery.trim(),
    })
      .then((data) => {
        if (cancelled) return;
        setLogs(data.data || []);
        setLogTotal(Number(data.total) || 0);
      })
      .catch((error) => {
        if (!cancelled) setLogError(error.message || '載入寄信紀錄失敗');
      })
      .finally(() => {
        if (!cancelled) setLoadingLogs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, panel, token, logPage, studentQuery]);

  if (!open) return null;

  const reloadOptions = async () => {
    const data = await fetchEnglishTestMailOptions(token);
    setCatalog(data.catalog || []);
    setCustom(data.custom || []);
    return data;
  };

  const handleSend = async () => {
    const payload = { ids: selectedIds, source };
    if (source === 'catalog') payload.templateKey = templateKey;
    if (source === 'custom') payload.customTemplateId = Number(customTemplateId);
    if (source === 'adhoc') {
      payload.subject = subject;
      payload.body = body;
    }
    try {
      await onSend(payload);
      setLogPage(1);
      onPanelChange('history');
    } catch {
      // 錯誤已由 hook 顯示
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      await saveEnglishTestMailTemplate(token, {
        name: draft.name,
        subjectTemplate: draft.subjectTemplate,
        bodyTemplate: draft.bodyTemplate,
      }, draft.id);
      setDraft(EMPTY_TEMPLATE);
      const data = await reloadOptions();
      const newest = (data.custom || [])[0];
      if (newest) setCustomTemplateId(String(newest.id));
    } catch (error) {
      setOptionsError(error.message || '儲存範本失敗');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await deleteEnglishTestMailTemplate(token, id);
      if (draft.id === id) setDraft(EMPTY_TEMPLATE);
      await reloadOptions();
    } catch (error) {
      setOptionsError(error.message || '刪除範本失敗');
    }
  };

  const logPages = Math.max(1, Math.ceil(logTotal / 20));

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">指定寄信</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="關閉" />
          </div>
          <div className="modal-body">
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button type="button" className={`nav-link ${panel === 'send' ? 'active' : ''}`} onClick={() => onPanelChange('send')}>
                  寄給所選
                </button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${panel === 'templates' ? 'active' : ''}`} onClick={() => onPanelChange('templates')}>
                  自訂範本
                </button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${panel === 'history' ? 'active' : ''}`} onClick={() => onPanelChange('history')}>
                  寄信紀錄
                </button>
              </li>
            </ul>

            {optionsError && <div className="alert alert-danger py-2">{optionsError}</div>}

            {panel === 'send' && (
              <>
                <p className="small text-muted">
                  已勾選 {selectedIds.length} 人。原本依狀態一鍵發信仍可使用。此處只寄給勾選的人，且不更改報名狀態。
                </p>
                <div className="mb-3">
                  <label className="form-label">信件來源</label>
                  <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="catalog">郵件設定裡的信</option>
                    <option value="custom">自訂範本</option>
                    <option value="adhoc">本次貼上主旨與內文</option>
                  </select>
                </div>
                {loadingOptions && <p className="small text-muted">載入範本中…</p>}
                {source === 'catalog' && (
                  <div className="mb-3">
                    <label className="form-label">郵件設定範本</label>
                    <select className="form-select" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                      {catalog.map((item) => (
                        <option key={item.key} value={item.key}>{item.name}</option>
                      ))}
                    </select>
                    {catalog.find((item) => item.key === templateKey)?.description && (
                      <div className="form-text">{catalog.find((item) => item.key === templateKey).description}</div>
                    )}
                  </div>
                )}
                {source === 'custom' && (
                  <div className="mb-3">
                    <label className="form-label">自訂範本</label>
                    {custom.length === 0 ? (
                      <div className="form-text">尚無自訂範本，請先到「自訂範本」建立。</div>
                    ) : (
                      <select className="form-select" value={customTemplateId} onChange={(e) => setCustomTemplateId(e.target.value)}>
                        {custom.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {source === 'adhoc' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">主旨</label>
                      <input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">內文</label>
                      <textarea className="form-control" rows="8" value={body} onChange={(e) => setBody(e.target.value)} />
                    </div>
                  </>
                )}
                <p className="small text-muted mb-0">可用變數：{PLACEHOLDER_HINT}</p>
              </>
            )}

            {panel === 'templates' && (
              <>
                <p className="small text-muted">自訂範本存在系統裡，寄信時可重複選用。不會改到郵件設定裡的正式範本。</p>
                <div className="mb-2">
                  <label className="form-label">名稱</label>
                  <input className="form-control" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} maxLength={80} />
                </div>
                <div className="mb-2">
                  <label className="form-label">主旨</label>
                  <input className="form-control" value={draft.subjectTemplate} onChange={(e) => setDraft((prev) => ({ ...prev, subjectTemplate: e.target.value }))} maxLength={200} />
                </div>
                <div className="mb-2">
                  <label className="form-label">內文</label>
                  <textarea className="form-control" rows="6" value={draft.bodyTemplate} onChange={(e) => setDraft((prev) => ({ ...prev, bodyTemplate: e.target.value }))} />
                </div>
                <p className="small text-muted">可用變數：{PLACEHOLDER_HINT}</p>
                <button type="button" className="btn btn-primary btn-sm" disabled={savingTemplate} onClick={handleSaveTemplate}>
                  {draft.id ? '更新範本' : '新增範本'}
                </button>
                {draft.id && (
                  <button type="button" className="btn btn-link btn-sm" onClick={() => setDraft(EMPTY_TEMPLATE)}>取消編輯</button>
                )}
                <ul className="list-group mt-3">
                  {custom.length === 0 && <li className="list-group-item text-muted">尚無自訂範本</li>}
                  {custom.map((item) => (
                    <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                      <div>
                        <div className="fw-semibold">{item.name}</div>
                        <div className="small text-muted">{item.subjectTemplate}</div>
                      </div>
                      <div className="btn-group btn-group-sm">
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setDraft(item)}>編輯</button>
                        <button type="button" className="btn btn-outline-danger" onClick={() => handleDeleteTemplate(item.id)}>刪除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {panel === 'history' && (
              <>
                <div className="d-flex gap-2 mb-3">
                  <input
                    className="form-control form-control-sm"
                    placeholder="以學號篩選"
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setLogPage(1);
                    }}
                  />
                </div>
                {loadingLogs && <p className="small text-muted">載入紀錄中…</p>}
                {logError && <div className="alert alert-danger py-2">{logError}</div>}
                {!loadingLogs && logs.length === 0 && <p className="text-muted small">尚無指定寄信紀錄</p>}
                {logs.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>時間</th>
                          <th>學號</th>
                          <th>姓名</th>
                          <th>信箱</th>
                          <th>版本</th>
                          <th>主旨</th>
                          <th>結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((row) => (
                          <tr key={row.id}>
                            <td className="text-nowrap">{formatSentAt(row.sentAt)}</td>
                            <td>{row.studentId}</td>
                            <td>{row.studentName}</td>
                            <td>{row.email}</td>
                            <td>{row.versionLabel}</td>
                            <td>{row.subject}</td>
                            <td>{row.status === 'success' ? '成功' : `失敗${row.errorMessage ? `：${row.errorMessage}` : ''}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {logTotal > 20 && (
                  <div className="d-flex justify-content-between align-items-center">
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={logPage <= 1} onClick={() => setLogPage((p) => p - 1)}>上一頁</button>
                    <span className="small text-muted">{logPage} / {logPages}</span>
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={logPage >= logPages} onClick={() => setLogPage((p) => p + 1)}>下一頁</button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>關閉</button>
            {panel === 'send' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending || selectedIds.length === 0 || (source === 'custom' && !customTemplateId) || (source === 'catalog' && !templateKey)}
                onClick={handleSend}
              >
                {sending ? '寄送中…' : `寄給所選 ${selectedIds.length} 人`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
