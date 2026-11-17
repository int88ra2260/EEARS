import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/**
 * 把現場簽到碼畫成 QR。內容必須是 booking code（例 R-010957），與確認信、預約成功視窗相同。
 */
export default function CheckinQrCanvas({ value, size = 180, className = '' }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const code = String(value || '').trim();
  const drawable = Boolean(code) && code !== '（未提供）';

  useEffect(() => {
    let cancelled = false;
    async function drawQr() {
      if (!drawable || !canvasRef.current) return;
      try {
        await QRCode.toCanvas(canvasRef.current, code, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#111111', light: '#ffffff' },
        });
        if (!cancelled) setError('');
      } catch (err) {
        if (!cancelled) setError('QR 產生失敗，請改以簽到碼出示');
      }
    }
    drawQr();
    return () => {
      cancelled = true;
    };
  }, [code, drawable, size]);

  if (!drawable) return null;

  return (
    <div className={className}>
      <canvas ref={canvasRef} aria-label={`簽到 QR ${code}`} />
      {error ? <div className="small text-danger mt-1">{error}</div> : null}
    </div>
  );
}
