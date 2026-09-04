/**
 * 英語實踐歷程護照：申請前信箱驗證碼 UI
 */
import React, { useEffect, useState } from 'react';
import {
  sendElpEmailVerificationCode,
  verifyElpEmailCode,
} from '../../services/englishLearningPassportApi';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default function ElpEmailVerificationPanel({
  email,
  studentId,
  disabled = false,
  emailVerificationToken,
  verifiedEmail,
  onTokenChange,
  errorMessage,
}) {
  const [code, setCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusVariant, setStatusVariant] = useState('secondary');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  const normalizedEmail = normalizeEmail(email);
  const verifiedOk =
    !!emailVerificationToken
    && normalizeEmail(verifiedEmail) === normalizedEmail
    && !!normalizedEmail;

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  useEffect(() => {
    setCode('');
    setStatusMsg('');
  }, [normalizedEmail]);

  if (disabled) return null;

  if (!normalizedEmail) {
    return (
      <div className="mb-3">
        <div className="form-text text-muted">請先填寫電子郵件後，即可寄送驗證碼。</div>
      </div>
    );
  }

  const handleSend = async () => {
    setSending(true);
    setStatusMsg('');
    try {
      const { ok, data } = await sendElpEmailVerificationCode({
        email: normalizedEmail,
        studentId: studentId || undefined,
      });
      if (!ok) {
        setStatusVariant('danger');
        setStatusMsg(data.message || data.error || '寄送失敗，請稍後再試');
        if (data.retryAfterSec) setCooldownSec(Number(data.retryAfterSec) || 60);
        return;
      }
      setStatusVariant('success');
      setStatusMsg(data.message || '驗證碼已寄出，請至信箱查收（含垃圾信件匣）');
      setCooldownSec(60);
      if (typeof onTokenChange === 'function') {
        onTokenChange({ token: null, verifiedEmail: null });
      }
    } catch (_e) {
      setStatusVariant('danger');
      setStatusMsg('寄送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setStatusMsg('');
    try {
      const { ok, data } = await verifyElpEmailCode({
        email: normalizedEmail,
        code: String(code || '').trim(),
      });
      if (!ok) {
        setStatusVariant('danger');
        setStatusMsg(data.message || data.error || '驗證失敗');
        return;
      }
      setStatusVariant('success');
      setStatusMsg('信箱驗證成功，可以申請護照');
      if (typeof onTokenChange === 'function') {
        onTokenChange({
          token: data.emailVerificationToken,
          verifiedEmail: data.email || normalizedEmail,
        });
      }
    } catch (_e) {
      setStatusVariant('danger');
      setStatusMsg('驗證失敗，請稍後再試');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mb-3 text-start" data-testid="elp-email-verification">
      <label className="form-label">
        信箱驗證碼 <span className="text-danger">*</span>
      </label>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={handleSend}
          disabled={sending || cooldownSec > 0}
        >
          {sending ? '寄送中...' : cooldownSec > 0 ? `重新寄送（${cooldownSec}s）` : '寄送驗證碼'}
        </button>
        <span className="form-text mb-0">將寄至：{normalizedEmail}</span>
      </div>
      <div className="input-group" style={{ maxWidth: 420 }}>
        <input
          type="text"
          className="form-control"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="請輸入 6 位驗證碼"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={verifiedOk}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleVerify}
          disabled={verifying || verifiedOk || String(code).length !== 6}
        >
          {verifiedOk ? '已驗證' : verifying ? '驗證中...' : '確認驗證'}
        </button>
      </div>
      {verifiedOk ? (
        <div className="text-success mt-1 small">✓ 信箱已驗證</div>
      ) : null}
      {(statusMsg || errorMessage) ? (
        <div className={`text-${errorMessage ? 'danger' : statusVariant} mt-1 small`}>
          {errorMessage || statusMsg}
        </div>
      ) : null}
      <div className="form-text">
        驗證碼約 10 分鐘有效。未完成驗證無法送出護照申請。
      </div>
    </div>
  );
}
