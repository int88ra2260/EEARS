import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Stack from 'react-bootstrap/Stack';
import { SCOPE_HINTS, SCOPE_LABELS } from '../../../constants/accountManagement';
import { DEFAULT_EVENT_TYPES } from '../../../constants/eventTypeCatalog';
import { SYSTEM_SCOPES, isEventActivityScope } from '../../../constants/scopes';
import { fetchPublicEventTypes } from '../../../services/eventTypeApi';

function toggleScope(prev, code, checked) {
  if (checked) return Array.from(new Set([...prev, code]));
  return prev.filter((x) => x !== code);
}

/**
 * 帳號「資料範圍」自訂：活動類型多選 + 其他業務 scope。
 */
export default function AccountScopeEditor({ customScopes, setCustomScopes }) {
  const [eventTypes, setEventTypes] = useState(() =>
    DEFAULT_EVENT_TYPES.filter((r) => r.isActive).map((r) => ({ ...r }))
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const list = await fetchPublicEventTypes({ force: true });
        if (!cancelled && Array.isArray(list) && list.length) {
          setEventTypes(list.filter((r) => r.isActive !== false));
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || '載入活動類型失敗，已使用預設清單');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const eventCodes = useMemo(() => eventTypes.map((r) => r.code), [eventTypes]);

  /** 帳號上有、但目錄已停用／刪除的活動類型 code */
  const orphanEventScopes = useMemo(() => {
    const known = new Set(eventCodes);
    return (customScopes || []).filter((s) => isEventActivityScope(s) && !known.has(s));
  }, [customScopes, eventCodes]);

  const selectedEventCount = eventCodes.filter((c) => customScopes.includes(c)).length;
  const allEventsSelected = eventCodes.length > 0 && selectedEventCount === eventCodes.length;

  const selectAllEvents = () => {
    setCustomScopes((prev) => Array.from(new Set([...prev, ...eventCodes])));
  };

  const clearEvents = () => {
    const drop = new Set(eventCodes);
    setCustomScopes((prev) => prev.filter((s) => !drop.has(s)));
  };

  return (
    <div className="border rounded p-3 bg-light">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <div className="fw-medium">活動類型</div>
          <div className="small text-muted">決定此帳號可管理哪些活動（存成 scope code）</div>
        </div>
        <div className="d-flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            disabled={loading || !eventCodes.length || allEventsSelected}
            onClick={selectAllEvents}
          >
            全選活動
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            disabled={loading || selectedEventCount === 0}
            onClick={clearEvents}
          >
            清除活動
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-3 text-center text-muted small">
          <Spinner animation="border" size="sm" className="me-2" />
          載入活動類型…
        </div>
      ) : (
        <div className="row g-2 mb-2">
          {eventTypes.map((row) => {
            const code = row.code;
            const label = row.displayName
              ? `${row.displayName}${row.abbreviation ? `（${row.abbreviation}）` : ''}`
              : (SCOPE_LABELS[code] || code);
            return (
              <div className="col-md-6" key={code}>
                <Form.Check
                  type="checkbox"
                  id={`scope-event-${code}`}
                  label={label}
                  checked={customScopes.includes(code)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCustomScopes((prev) => toggleScope(prev, code, checked));
                  }}
                />
                <div className="small text-muted ms-4 mb-1">
                  可存取此類型的活動、預約與相關名單。
                  <code className="ms-1">{code}</code>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loadError ? <Alert variant="warning" className="small py-2">{loadError}</Alert> : null}

      {orphanEventScopes.length ? (
        <Alert variant="secondary" className="small py-2">
          <div className="fw-medium mb-1">帳號上仍保留、但目前目錄未啟用的活動類型</div>
          <Stack gap={1}>
            {orphanEventScopes.map((code) => (
              <Form.Check
                key={code}
                type="checkbox"
                id={`scope-orphan-${code}`}
                label={<span><code>{code}</code>（已停用或已刪除）</span>}
                checked={customScopes.includes(code)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCustomScopes((prev) => toggleScope(prev, code, checked));
                }}
              />
            ))}
          </Stack>
        </Alert>
      ) : null}

      <hr className="my-3" />

      <div className="fw-medium mb-1">其他業務範圍</div>
      <div className="small text-muted mb-2">班級、問卷、英檢等非單一活動類型的範圍</div>
      <Stack gap={2}>
        {SYSTEM_SCOPES.map((s) => (
          <div key={s}>
            <Form.Check
              type="checkbox"
              id={`scope-system-${s}`}
              label={SCOPE_LABELS[s] || s}
              checked={customScopes.includes(s)}
              onChange={(e) => {
                const checked = e.target.checked;
                setCustomScopes((prev) => toggleScope(prev, s, checked));
              }}
            />
            {SCOPE_HINTS[s] ? (
              <div className="small text-muted ms-4">{SCOPE_HINTS[s]}</div>
            ) : null}
          </div>
        ))}
      </Stack>
    </div>
  );
}
