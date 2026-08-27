import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import useToast from '../../components/ui/useToast';
import {
  fetchEmailTemplates,
  previewEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  testSendEmailTemplate,
} from '../../services/emailTemplatesAdminApi';

const CATEGORY_ORDER = ['reservation', 'english_test', 'learning_partner'];

export default function AdminEmailTemplatesPage() {
  const { token } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKey = searchParams.get('key') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchEmailTemplates(token);
      setTemplates(list);
    } catch (err) {
      toast.error(err.message || '載入郵件模板失敗');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey]
  );

  useEffect(() => {
    if (!selected) return;
    // 一律帶入「目前實際使用」的可編輯稿（覆寫或系統預設還原）
    setSubjectTemplate(selected.editableSubject || selected.codeDefaultSubject || '');
    setBodyTemplate(selected.editableBody || selected.codeDefaultBody || '');
    setIsEnabled(selected.isEnabled !== false);
    setNotes(selected.override?.notes || '');
    setPreview(null);
    setDirty(false);
  }, [selected?.key, selected?.override?.updatedAt, selected?.isEnabled, selected?.editableSubject, selected?.editableBody]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.key.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    });
  }, [templates, categoryFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category).push(t);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: map.get(c)[0]?.categoryLabel || c,
      items: map.get(c),
    }));
  }, [filtered]);

  const selectKey = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key) next.set('key', key);
    else next.delete('key');
    setSearchParams(next, { replace: true });
  };

  const handleLoadDefault = () => {
    if (!selected) return;
    setSubjectTemplate(selected.baselineEditableSubject || selected.codeDefaultSubject || '');
    setBodyTemplate(selected.baselineEditableBody || selected.codeDefaultBody || '');
    setDirty(true);
    toast.info('已載入系統預設文案到編輯器（尚未儲存）');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const baselineSubject = (selected.baselineEditableSubject || '').trim();
      const baselineBody = (selected.baselineEditableBody || '').trim();
      const nextSubject = subjectTemplate.trim();
      const nextBody = bodyTemplate.trim();
      // 與系統預設稿相同 → 存 null（繼續走程式預設）；有改才存覆寫
      const subjectTemplatePayload = nextSubject === '' || nextSubject === baselineSubject ? null : subjectTemplate;
      const bodyTemplatePayload = nextBody === '' || nextBody === baselineBody ? null : bodyTemplate;

      const { data, warnings } = await saveEmailTemplate(token, selected.key, {
        subjectTemplate: subjectTemplatePayload,
        bodyTemplate: bodyTemplatePayload,
        isEnabled,
        notes: notes.trim() === '' ? null : notes,
      });
      setTemplates((prev) => prev.map((t) => (t.key === data.key ? data : t)));
      setDirty(false);
      if (warnings?.length) toast.warning(warnings.join('；'));
      else toast.success('已儲存郵件設定');
    } catch (err) {
      toast.error(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    if (!window.confirm(`確定將「${selected.name}」恢復為系統預設？\n將刪除後台覆寫。`)) return;
    setSaving(true);
    try {
      const data = await resetEmailTemplate(token, selected.key);
      setTemplates((prev) => prev.map((t) => (t.key === data.key ? data : t)));
      setDirty(false);
      toast.success('已恢復系統預設');
    } catch (err) {
      toast.error(err.message || '重設失敗');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selected) return;
    try {
      const data = await previewEmailTemplate(token, selected.key, {
        subjectTemplate: subjectTemplate.trim() === '' ? null : subjectTemplate,
        bodyTemplate: bodyTemplate.trim() === '' ? null : bodyTemplate,
      });
      setPreview(data);
      if (data.warnings?.length) toast.warning(data.warnings.join('；'));
    } catch (err) {
      toast.error(err.message || '預覽失敗');
    }
  };

  const handleTestSend = async () => {
    if (!selected) return;
    if (!testTo.includes('@')) {
      toast.warning('請輸入有效測試信箱');
      return;
    }
    if (!window.confirm(`確定寄送測試信到 ${testTo}？\n主旨會加上［測試］前綴。`)) return;
    setSaving(true);
    try {
      const data = await testSendEmailTemplate(token, selected.key, {
        to: testTo.trim(),
        subjectTemplate: subjectTemplate.trim() === '' ? null : subjectTemplate,
        bodyTemplate: bodyTemplate.trim() === '' ? null : bodyTemplate,
      });
      toast.success(`測試信已寄出：${data.subject}`);
      if (data.warnings?.length) toast.warning(data.warnings.join('；'));
    } catch (err) {
      toast.error(err.message || '測試寄信失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid px-2 px-md-3 py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <p className="text-muted small mb-0">
            開啟任一封信會自動帶入目前文案；動態內容以{' '}
            <code>{'{{變數名}}'}</code> 表示（不會出現範例姓名）。預覽／測試寄信才會代入範例資料。
          </p>
        </div>
        <Link to="/admin/settings/system" className="btn btn-outline-secondary btn-sm">
          返回系統設定
        </Link>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-2">
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 160 }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">全部分類</option>
                  <option value="reservation">活動預約</option>
                  <option value="english_test">培力英檢</option>
                  <option value="learning_partner">學習有伴</option>
                </select>
                <input
                  className="form-control form-control-sm"
                  placeholder="搜尋名稱／key…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="text-muted small py-4 text-center">載入中…</div>
              ) : (
                <div className="list-group list-group-flush" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  {grouped.map((group) => (
                    <div key={group.category} className="mb-2">
                      <div className="small text-muted fw-semibold px-1 py-1">{group.label}</div>
                      {group.items.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          className={`list-group-item list-group-item-action py-2 ${selectedKey === t.key ? 'active' : ''}`}
                          onClick={() => selectKey(t.key)}
                        >
                          <div className="d-flex justify-content-between gap-2">
                            <span className="fw-semibold">{t.name}</span>
                            <span className="d-flex gap-1">
                              {!t.isEnabled && <span className="badge text-bg-secondary">停用</span>}
                              {t.hasOverride && <span className="badge text-bg-warning">已覆寫</span>}
                            </span>
                          </div>
                          <div className={`small ${selectedKey === t.key ? 'text-white-50' : 'text-muted'}`}>
                            {t.key}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                  {grouped.length === 0 && (
                    <div className="text-muted small text-center py-3">沒有符合的模板</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          {!selected ? (
            <div className="card">
              <div className="card-body text-muted py-5 text-center">
                請從左側選擇一封郵件開始設定
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                  <div>
                    <h5 className="mb-1">{selected.name}</h5>
                    <div className="small text-muted">{selected.description}</div>
                    <code className="small">{selected.key}</code>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="et-mail-enabled"
                      checked={isEnabled}
                      onChange={(e) => {
                        setIsEnabled(e.target.checked);
                        setDirty(true);
                      }}
                    />
                    <label className="form-check-label" htmlFor="et-mail-enabled">
                      {isEnabled ? '啟用寄送' : '已停用（不會寄出）'}
                    </label>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="small fw-semibold mb-1">可用變數</div>
                  <div className="d-flex flex-wrap gap-1">
                    {(selected.variables || []).map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title={v.description || v.name}
                        onClick={() => {
                          setBodyTemplate((prev) => `${prev}{{${v.name}}}`);
                          setDirty(true);
                        }}
                      >
                        {`{{${v.name}}}`}
                        {v.required ? ' *' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    主旨
                    {!selected.hasSubjectOverride && (
                      <span className="text-muted fw-normal">（目前為系統預設）</span>
                    )}
                  </label>
                  <input
                    className="form-control"
                    value={subjectTemplate}
                    onChange={(e) => {
                      setSubjectTemplate(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    正文
                    {!selected.hasBodyOverride && (
                      <span className="text-muted fw-normal">（目前為系統預設）</span>
                    )}
                  </label>
                  <textarea
                    className="form-control font-monospace"
                    rows={14}
                    value={bodyTemplate}
                    onChange={(e) => {
                      setBodyTemplate(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">備註（僅後台可見）</label>
                  <input
                    className="form-control form-control-sm"
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="例如：2026 暑期文案"
                  />
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving || !dirty} onClick={handleSave}>
                    {saving ? '儲存中…' : '儲存'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleLoadDefault}>
                    還原系統預設文案
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={saving} onClick={handleReset}>
                    重設（刪除覆寫）
                  </button>
                  <button type="button" className="btn btn-outline-info btn-sm" onClick={handlePreview}>
                    預覽
                  </button>
                </div>

                <div className="border rounded p-3 mb-3 bg-light">
                  <div className="fw-semibold small mb-2">測試寄信</div>
                  <div className="d-flex flex-wrap gap-2">
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      style={{ maxWidth: 280 }}
                      placeholder="你的信箱"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                    />
                    <button type="button" className="btn btn-sm btn-warning" disabled={saving} onClick={handleTestSend}>
                      寄出測試信
                    </button>
                  </div>
                </div>

                {preview && (
                  <div className="border rounded p-3">
                    <div className="fw-semibold mb-2">預覽結果</div>
                    <div className="small text-muted mb-1">收件（範例）：{preview.to}</div>
                    <div className="fw-semibold mb-2">{preview.subject}</div>
                    <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
                      {preview.body}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
