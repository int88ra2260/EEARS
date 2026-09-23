import React, { useEffect } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import useCheckinKiosk from '../../hooks/useCheckinKiosk';
import { isEnglishTableEventType } from '../../utils/eventCapacityFields';
import { resolveEventTypeDisplayName } from '../../services/eventTypeApi';
import './adminEventCheckinKiosk.css';

export default function AdminEventCheckinKioskPage() {
  const { eventId } = useParams();
  const { token, accessProfile, setAdminPageMeta } = useOutletContext() || {};

  const k = useCheckinKiosk({ token, accessProfile, eventId });
  const isEt = isEnglishTableEventType(k.eventType);

  useEffect(() => {
    if (!setAdminPageMeta) return undefined;
    setAdminPageMeta({
      pageTitle: k.eventName ? `現場簽到｜${k.eventName}` : '現場簽到 Kiosk',
      breadcrumbLeaf: '現場簽到 Kiosk',
      kioskMode: true,
    });
    return () => setAdminPageMeta(null);
  }, [setAdminPageMeta, k.eventName]);

  const detailPath = `/admin/operations/${encodeURIComponent(eventId)}?tab=checkin`;

  if (k.loading) {
    return (
      <div className="admin-checkin-kiosk d-flex align-items-center gap-2 py-5 justify-content-center">
        <Spinner animation="border" size="sm" />
        <span>載入現場簽到名單…</span>
      </div>
    );
  }

  if (k.error) {
    return (
      <div className="admin-checkin-kiosk">
        <Alert variant="danger" className="mb-3">{k.error}</Alert>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={k.reload}>重試</Button>
          <Link to={detailPath} className="btn btn-outline-secondary">返回活動簽到</Link>
        </div>
      </div>
    );
  }

  if (!k.canCheckinStudents) {
    return (
      <div className="admin-checkin-kiosk">
        <Alert variant="warning">您沒有學生簽到權限。</Alert>
        <Link to={detailPath} className="btn btn-outline-secondary">返回活動簽到</Link>
      </div>
    );
  }

  if (!k.canAccessCurrentEvent) {
    return (
      <div className="admin-checkin-kiosk">
        <Alert variant="warning">您無法存取此活動類型的簽到。</Alert>
        <Link to="/admin/operations" className="btn btn-outline-secondary">返回活動列表</Link>
      </div>
    );
  }

  return (
    <div className="admin-checkin-kiosk">
      <div className="admin-checkin-kiosk__top">
        <div>
          <h1 className="admin-checkin-kiosk__title">{k.eventName || '活動現場簽到'}</h1>
          <p className="admin-checkin-kiosk__meta">
            {k.eventDate || '—'}
            {k.eventStartTime ? `｜${k.eventStartTime}` : ''}
            {k.eventType ? `｜${resolveEventTypeDisplayName(k.eventType)}` : ''}
            {!k.todayEvent ? '｜非今日（補簽到）' : ''}
          </p>
        </div>
        <div className="admin-checkin-kiosk__stats" aria-live="polite">
          <div className="admin-checkin-kiosk__stat admin-checkin-kiosk__stat--pending">
            <span className="admin-checkin-kiosk__stat-label">待簽到</span>
            <span className="admin-checkin-kiosk__stat-value">{k.pendingCount}</span>
          </div>
          <div className="admin-checkin-kiosk__stat admin-checkin-kiosk__stat--done">
            <span className="admin-checkin-kiosk__stat-label">已簽到</span>
            <span className="admin-checkin-kiosk__stat-value">{k.checkedInCount}</span>
          </div>
        </div>
      </div>

      {!k.canCheckinNow ? (
        <Alert variant="secondary" className="mb-3">
          目前不可簽到（僅當天活動可現場簽到；補簽到需活動管理權限）。
        </Alert>
      ) : null}

      <div className="admin-checkin-kiosk__modes mb-3">
        <Form.Check
          type="switch"
          id="kiosk-scan-mode"
          label="掃碼模式（簽到碼／學號掃入後自動搜尋）"
          checked={k.scanMode}
          onChange={(e) => k.setScanMode(e.target.checked)}
        />
        <Form.Check
          type="switch"
          id="kiosk-quick-checkin"
          label="快速簽到（唯一命中直接簽到，不勾護照）"
          checked={k.quickCheckin}
          disabled={!k.scanMode}
          onChange={(e) => k.setQuickCheckin(e.target.checked)}
        />
      </div>

      <Form
        className="admin-checkin-kiosk__input-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          k.runSearch();
        }}
      >
        <Form.Label htmlFor="kiosk-student-query" className="fw-semibold">
          掃描學生證／預約 QR，或輸入學號／姓名／簽到碼
        </Form.Label>
        <div className="admin-checkin-kiosk__input-row">
          <Form.Control
            id="kiosk-student-query"
            ref={k.inputRef}
            className="admin-checkin-kiosk__input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={k.query}
            onChange={(e) => k.setQuery(e.target.value)}
            onFocus={k.focusInput}
            placeholder="例：F1234567 或 R-000360"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={k.checkinBusy}
          />
          <Button
            type="submit"
            variant="primary"
            className="admin-checkin-kiosk__search-btn"
            disabled={k.checkinBusy || !String(k.query || '').trim()}
          >
            搜尋
          </Button>
        </div>
        <p className="admin-checkin-kiosk__hint">
          支援學生證條碼與確認信個人 QR（簽到碼 R-XXXXXX）。手機請點「搜尋」。
        </p>
      </Form>

      {k.phase === 'confirm' && k.selected ? (
        <div className="admin-checkin-kiosk__panel">
          <p className="admin-checkin-kiosk__panel-title">確認簽到</p>
          <p className="admin-checkin-kiosk__student-id">{k.selected.studentId}</p>
          <p className="admin-checkin-kiosk__student-name">
            {k.selected.studentName || k.selected.name || '—'}
          </p>
          {isEt ? (
            <p className="text-muted mb-2">組別：{k.selected.group || '—'}</p>
          ) : null}
          <Form.Check
            type="checkbox"
            id="kiosk-passport"
            label="計入英語實踐歷程護照（與課堂加分擇一）"
            checked={k.countsTowardPassport}
            onChange={(e) => k.setCountsTowardPassport(e.target.checked)}
            disabled={k.checkinBusy || !k.canCheckinNow}
            className="mb-0"
          />
          <div className="admin-checkin-kiosk__actions">
            <Button
              variant="success"
              onClick={k.handleCheckin}
              disabled={k.checkinBusy || !k.canCheckinNow}
            >
              {k.checkinBusy
                ? '簽到中…'
                : !k.todayEvent && k.canManageEvents
                  ? '確認補簽到'
                  : '確認簽到'}
            </Button>
            <Button
              variant="outline-secondary"
              onClick={k.resetToIdle}
              disabled={k.checkinBusy}
            >
              取消
            </Button>
          </div>
        </div>
      ) : null}

      {k.phase === 'pick' && k.matchResult ? (
        <div className="admin-checkin-kiosk__panel">
          <p className="admin-checkin-kiosk__panel-title">請選擇學生</p>
          {k.matchResult.pending.length === 0 ? (
            <p className="text-muted mb-2">沒有待簽到結果；下方為已簽到／違規命中。</p>
          ) : null}
          <ul className="admin-checkin-kiosk__pick-list">
            {k.matchResult.pending.map((row) => (
              <li key={`p-${row.id}`}>
                <button type="button" onClick={() => k.goConfirm(row)}>
                  <strong>{row.studentId}</strong>
                  {' '}
                  {row.studentName || row.name || ''}
                  {isEt && row.group ? `｜${row.group}` : ''}
                  <span className="text-success ms-2">待簽到</span>
                </button>
              </li>
            ))}
            {k.matchResult.done.map((row) => (
              <li key={`d-${row.id}`}>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                >
                  <strong>{row.studentId}</strong>
                  {' '}
                  {row.studentName || row.name || ''}
                  <span className="text-muted ms-2">已簽到</span>
                </button>
              </li>
            ))}
            {k.matchResult.violations.map((row) => (
              <li key={`v-${row.id}`}>
                <button type="button" disabled aria-disabled="true">
                  <strong>{row.studentId}</strong>
                  {' '}
                  {row.studentName || row.name || ''}
                  <span className="text-danger ms-2">已登記違規</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-checkin-kiosk__actions">
            <Button variant="outline-secondary" onClick={k.resetToIdle}>重新輸入</Button>
          </div>
        </div>
      ) : null}

      {k.phase === 'feedback' && k.feedback ? (
        <div
          className={`admin-checkin-kiosk__feedback admin-checkin-kiosk__feedback--${k.feedback.tone}`}
          role="status"
        >
          <p className="admin-checkin-kiosk__feedback-title">{k.feedback.title}</p>
          <p className="admin-checkin-kiosk__feedback-detail">{k.feedback.detail}</p>
          {k.feedback.tone !== 'success' ? (
            <div className="admin-checkin-kiosk__actions justify-content-center">
              <Button variant="outline-secondary" onClick={k.resetToIdle}>繼續下一位</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="admin-checkin-kiosk__roster" aria-label="尚未簽到名單">
        <div className="admin-checkin-kiosk__roster-head">
          <h2 className="admin-checkin-kiosk__roster-title">
            尚未簽到（{k.pendingCount}）
          </h2>
          <p className="admin-checkin-kiosk__roster-meta mb-0">
            已簽到 {k.checkedInCount}｜未簽到 {k.pendingCount}
          </p>
        </div>
        {k.pendingRows.length === 0 ? (
          <p className="admin-checkin-kiosk__roster-empty">目前沒有待簽到學生。</p>
        ) : (
          <div className="admin-checkin-kiosk__roster-scroll">
            <table className="admin-checkin-kiosk__roster-table">
              <thead>
                <tr>
                  <th>學號</th>
                  <th>姓名</th>
                  {isEt ? <th>組別</th> : null}
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {k.pendingRows.map((row) => {
                  const selected = k.selected?.id === row.id;
                  return (
                    <tr key={row.id} className={selected ? 'is-selected' : undefined}>
                      <td className="admin-checkin-kiosk__roster-sid">{row.studentId}</td>
                      <td>{row.studentName || row.name || '—'}</td>
                      {isEt ? <td>{row.group || '—'}</td> : null}
                      <td className="admin-checkin-kiosk__roster-action">
                        {k.canCheckinNow ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={selected ? 'success' : 'outline-success'}
                            disabled={k.checkinBusy}
                            onClick={() => k.goConfirm(row)}
                          >
                            {selected ? '選取中' : '簽到'}
                          </Button>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-checkin-kiosk__footer">
        <Button variant="outline-secondary" size="sm" onClick={k.reload} disabled={k.checkinBusy}>
          重新整理名單
        </Button>
        <Link to={detailPath} className="btn btn-link btn-sm">
          返回完整簽到頁
        </Link>
      </div>
    </div>
  );
}
