/**
 * 郵件模板頁：培力驗證碼略過全站限流開關 + 目前 API 用量
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchEmailRateLimitGuard,
  updateEmailRateLimitGuard,
} from '../../services/emailTemplatesAdminApi';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-TW', { hour12: false });
  } catch {
    return iso;
  }
}

export default function EmailRateLimitGuardPanel({ token, toast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipOtp, setSkipOtp] = useState(true);
  const [usage, setUsage] = useState(null);
  const [otpLimits, setOtpLimits] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmailRateLimitGuard(token);
      setSkipOtp(data.skipGlobalForEnglishTestEmailOtp !== false);
      setUsage(data.usage || null);
      setOtpLimits(data.otpDedicatedLimits || null);
    } catch (err) {
      toast.error(err.message || '載入限流狀態失敗');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (checked) => {
    setSaving(true);
    try {
      const data = await updateEmailRateLimitGuard(token, checked);
      setSkipOtp(data.skipGlobalForEnglishTestEmailOtp !== false);
      setUsage(data.usage || usage);
      toast.success(
        checked
          ? '已開啟：培力驗證碼略過全站 IP 限流（仍保留驗證碼專用限流）'
          : '已關閉：培力驗證碼會計入全站 IP 限流'
      );
    } catch (err) {
      toast.error(err.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const u = usage || {};
  const busyPct = Number(u.busiestUtilizationPct) || 0;
  const busyTone = busyPct >= 90 ? 'danger' : busyPct >= 70 ? 'warning' : 'success';

  return (
    <div className="card mb-3 border-primary-subtle">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <h2 className="h6 mb-1">培力英檢驗證碼 × 全站 API 限流</h2>
            <p className="small text-muted mb-0">
              校園／電信常共用對外 IP。若下方「最忙客戶端用量」偏高，學生按一次「寄送驗證碼」也可能被全站限流擋下。
              開啟此開關後，驗證碼寄送／驗證不再佔用全站 IP 桶，仍受專用限流保護。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={load}
            disabled={loading || saving}
          >
            重新整理用量
          </button>
        </div>

        {loading && !usage ? (
          <div className="text-muted small">載入中…</div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-3">
              <div>
                <div className="fw-semibold">略過全站限流（僅驗證碼路徑）</div>
                <div className="small text-muted">
                  路徑：
                  <code>/english-test/email-verification/send</code>
                  {' · '}
                  <code>/verify</code>
                </div>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={skipOtp}
                  disabled={saving || loading}
                  onChange={(e) => handleToggle(e.target.checked)}
                  aria-label="略過全站限流"
                />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">全站上限／視窗</div>
                  <div className="fw-semibold">
                    {u.enabled === false ? '已停用' : `${u.max ?? '—'} / ${u.windowMinutes ?? '—'} 分`}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">追蹤中的客戶端</div>
                  <div className="fw-semibold">{u.trackedClients ?? 0}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">視窗內總請求數</div>
                  <div className="fw-semibold">{u.totalHitsInWindow ?? 0}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className={`border rounded p-2 h-100 border-${busyTone}-subtle`}>
                  <div className="small text-muted">最忙客戶端用量</div>
                  <div className={`fw-semibold text-${busyTone}`}>
                    {u.busiestHits ?? 0}（{busyPct}%）
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6 col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">接近上限（≥80%）</div>
                  <div className="fw-semibold">{u.nearLimitClients ?? 0}</div>
                </div>
              </div>
              <div className="col-6 col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">累計 429（本程序）</div>
                  <div className="fw-semibold">{u.rejectedTotal ?? 0}</div>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">最近一次 429</div>
                  <div className="fw-semibold small">
                    {formatTime(u.lastRejectedAt)}
                    {u.lastRejectedPath ? (
                      <span className="text-muted d-block text-truncate" title={u.lastRejectedPath}>
                        {u.lastRejectedPath}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {otpLimits && (
              <div className="small text-muted mb-2">
                驗證碼專用限流：寄送 {otpLimits.send?.max} 次／{otpLimits.send?.windowMinutes} 分；
                驗證 {otpLimits.verify?.max} 次／{otpLimits.verify?.windowMinutes} 分；
                重寄冷卻 {otpLimits.resendCooldownSeconds} 秒。
              </div>
            )}

            {(u.topClients || []).length > 0 ? (
              <div className="table-responsive" style={{ maxHeight: 220, overflow: 'auto' }}>
                <table className="table table-sm table-striped mb-0">
                  <thead>
                    <tr>
                      <th>客戶端（遮罩）</th>
                      <th className="text-end">請求數</th>
                      <th className="text-end">剩餘</th>
                      <th className="text-end">用量%</th>
                      <th>視窗重置</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.topClients.map((row) => (
                      <tr key={row.keyMasked + row.resetAt}>
                        <td><code className="small">{row.keyMasked}</code></td>
                        <td className="text-end">{row.hits}</td>
                        <td className="text-end">{row.remaining}</td>
                        <td className="text-end">{row.utilizationPct}%</td>
                        <td className="small">{formatTime(row.resetAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="small text-muted">目前尚無全站限流計數（可能限流已關閉，或重啟後尚無公開流量）。</div>
            )}

            <div className="small text-muted mt-2">
              資料時間：{formatTime(u.generatedAt)} · 用量為本機記憶體（PM2 多程序時各程序獨立）
            </div>
          </>
        )}
      </div>
    </div>
  );
}
