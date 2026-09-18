import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import QRCode from 'qrcode';
import {
  fetchEventLeaderAttendance,
  fetchEventLeaderCheckinQrMeta,
  manualUpsertLeaderAttendance,
  rotateEventLeaderCheckinQr,
} from '../../../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../../../utils/errorHandler';

const QR_SIZE = 240;
const LEGO_LOGO_URL = '/EMILEGO.png';

function statusBadge(status) {
  if (status === 'on_time') return <Badge bg="success">準時</Badge>;
  if (status === 'late') return <Badge bg="warning" text="dark">遲到</Badge>;
  if (status === 'manual') return <Badge bg="info">行政補登</Badge>;
  if (status === 'absent') return <Badge bg="secondary">未出席</Badge>;
  return <Badge bg="light" text="dark" className="border">未簽到</Badge>;
}

function buildCheckInDeepLink(eventId, token) {
  const url = new URL(`${window.location.origin}/admin/et-grouping/my-sessions`);
  url.searchParams.set('eventId', String(eventId));
  url.searchParams.set('checkInToken', token);
  return url.toString();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖示：${src}`));
    img.src = src;
  });
}

function fillRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/** 產生含中心 EMILEGO 防偽標的簽到 QR（高錯誤校正以維持可掃） */
async function buildCheckInQrDataUrl(text) {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#111111', light: '#ffffff' },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  try {
    const logo = await loadImage(LEGO_LOGO_URL);
    const logoSize = Math.round(QR_SIZE * 0.22);
    const pad = Math.round(logoSize * 0.14);
    const box = logoSize + pad * 2;
    const x = (QR_SIZE - box) / 2;
    const y = (QR_SIZE - box) / 2;

    ctx.fillStyle = '#ffffff';
    fillRoundedRect(ctx, x, y, box, box, Math.round(box * 0.18));
    ctx.drawImage(logo, x + pad, y + pad, logoSize, logoSize);
  } catch {
    // 圖示載入失敗時仍回傳純 QR，不阻斷簽到
  }

  return canvas.toDataURL('image/png');
}

export default function AdminEventLeaderAttendancePanel({ token, eventId, canManage }) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [attendance, setAttendance] = useState(null);
  const [qrMeta, setQrMeta] = useState(null);
  const [plainToken, setPlainToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualNotes, setManualNotes] = useState({});

  const load = useCallback(async () => {
    if (!token || !eventId || !canManage) return;
    setLoading(true);
    try {
      const [att, meta] = await Promise.all([
        fetchEventLeaderAttendance(token, eventId),
        fetchEventLeaderCheckinQrMeta(token, eventId),
      ]);
      setAttendance(att);
      setQrMeta(meta);
    } catch (e) {
      showErrorMessage(e.message || '載入 Leader 出席失敗');
      setAttendance(null);
      setQrMeta(null);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (!plainToken || !eventId) {
        setQrDataUrl('');
        return;
      }
      try {
        const dataUrl = await buildCheckInQrDataUrl(buildCheckInDeepLink(eventId, plainToken));
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    }
    renderQr();
    return () => { cancelled = true; };
  }, [plainToken, eventId]);

  const handleRotateQr = async () => {
    setActionLoading('qr');
    try {
      const data = await rotateEventLeaderCheckinQr(token, eventId);
      setPlainToken(data.token || '');
      setQrMeta({
        ...qrMeta,
        hasToken: true,
        expiresAt: data.expiresAt,
        rotatedAt: data.rotatedAt,
      });
      showSuccessMessage('已產生現場簽到 QR（請勿外流）');
    } catch (e) {
      showErrorMessage(e.message || '產生 QR 失敗');
    } finally {
      setActionLoading('');
    }
  };

  const handleManual = async (leaderTeacherId, status) => {
    setActionLoading(`manual-${leaderTeacherId}`);
    try {
      await manualUpsertLeaderAttendance(token, eventId, leaderTeacherId, {
        status,
        note: manualNotes[leaderTeacherId] || '',
      });
      showSuccessMessage('已補登出席');
      setPlainToken((prev) => prev);
      await load();
    } catch (e) {
      showErrorMessage(e.message || '補登失敗');
    } finally {
      setActionLoading('');
    }
  };

  if (!canManage) return null;

  return (
    <Card className="mb-3">
      <Card.Header className="py-2 fw-semibold">Leader 出席簽到（支薪）</Card.Header>
      <Card.Body>
        <p className="small text-muted mb-3">
          現場產生 QR 給 Leader 掃碼／輸入簽到碼。開始前 30 分～開始後 10 分為準時；之後至結束為遲到。不做簽退。
        </p>

        {loading ? (
          <div className="d-flex align-items-center gap-2 py-2">
            <Spinner animation="border" size="sm" />
            <span className="small">載入出席狀態…</span>
          </div>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-start mb-3">
              <Button
                size="sm"
                variant="primary"
                disabled={Boolean(actionLoading)}
                onClick={handleRotateQr}
              >
                {actionLoading === 'qr' ? '產生中…' : (qrMeta?.hasToken ? '重新產生簽到 QR' : '產生簽到 QR')}
              </Button>
              {qrMeta?.hasToken && !plainToken ? (
                <Alert variant="light" className="border small py-1 px-2 mb-0">
                  已有有效簽到碼（重新產生後才會顯示明文／QR）
                  {qrMeta.expiresAt ? ` · 效期至 ${new Date(qrMeta.expiresAt).toLocaleString('zh-TW')}` : ''}
                </Alert>
              ) : null}
            </div>

            {plainToken ? (
              <div className="border rounded p-3 mb-3 bg-light">
                <div className="row g-3 align-items-center">
                  <div className="col-auto">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Leader 簽到 QR（中心含 EMILEGO 防偽）"
                        width={QR_SIZE}
                        height={QR_SIZE}
                        className="bg-white rounded"
                      />
                    ) : (
                      <div className="text-muted small">QR 產生中…</div>
                    )}
                  </div>
                  <div className="col">
                    <div className="fw-semibold mb-1">現場簽到碼（僅此次產生可見）</div>
                    <code className="user-select-all d-inline-block mb-2" style={{ wordBreak: 'break-all' }}>
                      {plainToken}
                    </code>
                    <div className="small text-muted">
                      Leader 可用手機相機掃 QR 開啟簽到頁，或於「我的帶班場次」貼上此碼。
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="table-responsive">
              <Table size="sm" bordered className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Leader</th>
                    <th>組別</th>
                    <th>出席</th>
                    <th>簽到時間</th>
                    <th>補登</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.leaders || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">尚未指派 Leader</td>
                    </tr>
                  ) : (
                    attendance.leaders.map((row) => {
                      const status = row.attendance?.status || row.derivedStatus;
                      return (
                        <tr key={row.leaderTeacherId}>
                          <td>
                            {row.leaderName || `ID ${row.leaderTeacherId}`}
                            {row.studentId ? (
                              <span className="text-muted small ms-1">（{row.studentId}）</span>
                            ) : null}
                          </td>
                          <td>{(row.groupLabels || []).join(', ')}</td>
                          <td>{statusBadge(status)}</td>
                          <td className="small">
                            {row.attendance?.checkInAt
                              ? new Date(row.attendance.checkInAt).toLocaleString('zh-TW')
                              : '—'}
                          </td>
                          <td style={{ minWidth: 220 }}>
                            <Form.Control
                              size="sm"
                              className="mb-1"
                              placeholder="補登備註（可選）"
                              value={manualNotes[row.leaderTeacherId] || ''}
                              onChange={(e) => setManualNotes((prev) => ({
                                ...prev,
                                [row.leaderTeacherId]: e.target.value,
                              }))}
                            />
                            <div className="d-flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline-success"
                                disabled={Boolean(actionLoading)}
                                onClick={() => handleManual(row.leaderTeacherId, 'on_time')}
                              >
                                補登準時
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-warning"
                                disabled={Boolean(actionLoading)}
                                onClick={() => handleManual(row.leaderTeacherId, 'late')}
                              >
                                補登遲到
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={Boolean(actionLoading)}
                                onClick={() => handleManual(row.leaderTeacherId, 'manual')}
                              >
                                補登出席
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
