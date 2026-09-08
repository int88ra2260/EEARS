/**
 * 培力英檢報名：信箱驗證碼 UI（寄送／輸入）
 * 驗證可於輸入滿 6 碼時自動進行，或由父層在「提交報名」時呼叫 ensureVerified()。
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  sendEnglishTestEmailVerificationCode,
  verifyEnglishTestEmailCode,
} from '../../../services/englishTestPublicApi';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const EnglishTestEmailVerificationPanel = forwardRef(function EnglishTestEmailVerificationPanel({
  email,
  studentId,
  disabled = false,
  /** 修改流程：既有信箱；與目前 email 相同則不需重驗 */
  originalEmail = null,
  emailVerificationToken,
  verifiedEmail,
  onTokenChange,
  errorMessage,
}, ref) {
  const [code, setCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusVariant, setStatusVariant] = useState('secondary');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const verifyInFlightRef = useRef(false);
  const verifyPromiseRef = useRef(null);
  const lastAutoAttemptRef = useRef('');
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  const normalizedEmail = normalizeEmail(email);
  const originalNormalized = originalEmail != null ? normalizeEmail(originalEmail) : null;
  const emailUnchanged = originalNormalized != null && normalizedEmail === originalNormalized && !!normalizedEmail;
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
    lastAutoAttemptRef.current = '';
  }, [normalizedEmail]);

  const runVerify = useCallback(async (rawCode) => {
    const trimmed = String(rawCode || '').trim();
    if (!normalizedEmail) {
      return { ok: false, error: '請先填寫電子郵件' };
    }
    if (emailUnchanged) {
      return { ok: true, token: null, verifiedEmail: normalizedEmail, skipped: true };
    }
    if (
      emailVerificationToken
      && normalizeEmail(verifiedEmail) === normalizedEmail
    ) {
      return {
        ok: true,
        token: emailVerificationToken,
        verifiedEmail: normalizedEmail,
      };
    }
    if (trimmed.length !== 6) {
      return { ok: false, error: '請輸入信箱收到的 6 位驗證碼後再提交報名' };
    }
    if (verifyPromiseRef.current) {
      return verifyPromiseRef.current;
    }

    const verifyPromise = (async () => {
      verifyInFlightRef.current = true;
      setVerifying(true);
      setStatusMsg('');
      try {
        const { ok, data } = await verifyEnglishTestEmailCode({
          email: normalizedEmail,
          code: trimmed,
        });
        if (!ok) {
          const err = data.error || data.message || '驗證失敗';
          setStatusVariant('danger');
          setStatusMsg(err);
          return { ok: false, error: err };
        }
        const token = data.emailVerificationToken;
        const nextEmail = data.email || normalizedEmail;
        setStatusVariant('success');
        setStatusMsg('信箱驗證成功');
        if (typeof onTokenChangeRef.current === 'function') {
          onTokenChangeRef.current({ token, verifiedEmail: nextEmail });
        }
        return { ok: true, token, verifiedEmail: nextEmail };
      } catch (_e) {
        const err = '驗證失敗，請稍後再試';
        setStatusVariant('danger');
        setStatusMsg(err);
        return { ok: false, error: err };
      } finally {
        verifyInFlightRef.current = false;
        setVerifying(false);
        verifyPromiseRef.current = null;
      }
    })();

    verifyPromiseRef.current = verifyPromise;
    return verifyPromise;
  }, [normalizedEmail, emailUnchanged, emailVerificationToken, verifiedEmail]);

  useImperativeHandle(ref, () => ({
    ensureVerified: () => runVerify(code),
    getCode: () => String(code || '').trim(),
  }), [runVerify, code]);

  // 輸入滿 6 碼時自動驗證（同一組碼失敗不重試，避免迴圈）
  useEffect(() => {
    if (disabled || emailUnchanged || verifiedOk || verifying) return;
    if (String(code).length !== 6) return;
    if (lastAutoAttemptRef.current === code) return;
    lastAutoAttemptRef.current = code;
    void runVerify(code);
  }, [code, disabled, emailUnchanged, verifiedOk, verifying, runVerify]);

  if (disabled) return null;

  if (emailUnchanged) {
    return (
      <div className="mb-3">
        <div className="alert alert-light border mb-0 py-2" style={{ fontSize: '0.9rem' }}>
          信箱未變更，無需重新驗證。
        </div>
      </div>
    );
  }

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
      const { ok, data } = await sendEnglishTestEmailVerificationCode({
        email: normalizedEmail,
        studentId: studentId || undefined,
      });
      if (!ok) {
        setStatusVariant('danger');
        setStatusMsg(data.error || data.message || '寄送失敗，請稍後再試');
        if (data.retryAfterSec) setCooldownSec(Number(data.retryAfterSec) || 60);
        return;
      }
      setStatusVariant('success');
      setStatusMsg(data.message || '驗證碼已寄出，請至信箱查收（含垃圾信件匣）');
      setCooldownSec(60);
      lastAutoAttemptRef.current = '';
      if (typeof onTokenChangeRef.current === 'function') {
        onTokenChangeRef.current({ token: null, verifiedEmail: null });
      }
    } catch (_e) {
      setStatusVariant('danger');
      setStatusMsg('寄送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-3" data-testid="english-test-email-verification">
      <label className="form-label">
        信箱驗證碼 <span style={{ color: 'red' }}>*</span>
      </label>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleSend}
          disabled={sending || cooldownSec > 0}
        >
          {sending ? '寄送中...' : cooldownSec > 0 ? `重新寄送（${cooldownSec}s）` : '寄送驗證碼'}
        </button>
        <span className="form-text mb-0">驗證碼將寄至：{normalizedEmail}</span>
      </div>
      <input
        type="text"
        className="form-control"
        style={{ maxWidth: 280 }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="請輸入 6 位驗證碼"
        value={code}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 6);
          if (next !== code) lastAutoAttemptRef.current = '';
          setCode(next);
        }}
        disabled={verifiedOk || verifying}
      />
      {verifying ? (
        <div className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          驗證中...
        </div>
      ) : null}
      {verifiedOk ? (
        <div className="text-success mt-1" style={{ fontSize: '0.9rem' }}>
          ✓ 信箱已驗證
        </div>
      ) : null}
      {(statusMsg || errorMessage) ? (
        <div className={`text-${errorMessage ? 'danger' : statusVariant} mt-1`} style={{ fontSize: '0.9rem' }}>
          {errorMessage || statusMsg}
        </div>
      ) : null}
      <div className="form-text">
        請至填寫的信箱收取驗證碼（約 10 分鐘內有效）。輸入 6 位驗證碼後會自動驗證；
        若尚未顯示「已驗證」，直接按頁面底部「提交報名／確認更新」也會一併完成驗證並送出。
        若未收到，請檢查垃圾信件匣後再重新寄送。
      </div>
    </div>
  );
});

export default EnglishTestEmailVerificationPanel;
