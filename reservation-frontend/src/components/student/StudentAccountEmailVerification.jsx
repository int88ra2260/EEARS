import React, { useEffect, useState } from 'react';
import {
  sendStudentEmailVerification,
  verifyStudentEmailCode,
} from '../../services/studentAuthApi';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default function StudentAccountEmailVerification({
  email,
  studentId,
  emailVerificationToken,
  verifiedEmail,
  onVerified,
}) {
  const [code, setCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusVariant, setStatusVariant] = useState('secondary');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  const normalizedEmail = normalizeEmail(email);
  const verifiedOk = Boolean(
    emailVerificationToken
    && normalizeEmail(verifiedEmail) === normalizedEmail
    && normalizedEmail,
  );

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;
    const timer = setTimeout(() => setCooldownSec((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSec]);

  useEffect(() => {
    setCode('');
    setStatusMsg('');
  }, [normalizedEmail]);

  if (!normalizedEmail) {
    return <p className="form-text">請先填寫信箱，再寄送驗證碼。</p>;
  }

  const handleSend = async () => {
    setSending(true);
    setStatusMsg('');
    try {
      const { ok, data } = await sendStudentEmailVerification({
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
      setStatusMsg(data.message || '驗證碼已寄出，請到信箱查收，也看一下垃圾信件匣');
      setCooldownSec(60);
      onVerified({ token: '', verifiedEmail: '' });
    } catch {
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
      const { ok, data } = await verifyStudentEmailCode({
        email: normalizedEmail,
        code: String(code || '').trim(),
      });
      if (!ok) {
        setStatusVariant('danger');
        setStatusMsg(data.message || data.error || '驗證失敗');
        return;
      }
      setStatusVariant('success');
      setStatusMsg('信箱已驗證，可以建立帳號');
      onVerified({
        token: data.emailVerificationToken,
        verifiedEmail: data.email || normalizedEmail,
      });
    } catch {
      setStatusVariant('danger');
      setStatusMsg('驗證失敗，請稍後再試');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor="student-register-code">信箱驗證碼</label>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={handleSend}
          disabled={sending || cooldownSec > 0}
        >
          {sending ? '寄送中…' : cooldownSec > 0 ? `重新寄送（${cooldownSec} 秒）` : '寄送驗證碼'}
        </button>
        <span className="form-text mb-0">將寄到 {normalizedEmail}</span>
      </div>
      <div className="input-group">
        <input
          id="student-register-code"
          className="form-control"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 位驗證碼"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={verifiedOk}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleVerify}
          disabled={verifying || verifiedOk || code.length !== 6}
        >
          {verifiedOk ? '已驗證' : verifying ? '驗證中…' : '確認驗證'}
        </button>
      </div>
      {verifiedOk ? <p className="text-success small mt-2 mb-0">這個信箱已驗證。</p> : null}
      {statusMsg ? <p className={`text-${statusVariant} small mt-2 mb-0`}>{statusMsg}</p> : null}
      <p className="form-text mb-0">驗證碼約 10 分鐘內有效。完成驗證後才能建立帳號。</p>
    </div>
  );
}
