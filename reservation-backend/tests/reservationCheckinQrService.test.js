'use strict';

const {
  formatBookingCode,
  buildReservationCheckinQr,
  appendCheckinCodeToText,
  attachReservationCheckinQr,
} = require('../services/reservationCheckinQrService');

describe('reservationCheckinQrService', () => {
  test('formatBookingCode pads ids', () => {
    expect(formatBookingCode(360)).toBe('R-000360');
  });

  test('buildReservationCheckinQr returns png buffer', async () => {
    const qr = await buildReservationCheckinQr(360);
    expect(qr.bookingCode).toBe('R-000360');
    expect(Buffer.isBuffer(qr.pngBuffer)).toBe(true);
    expect(qr.pngBuffer.length).toBeGreaterThan(100);
    expect(qr.cid).toBe('eears-checkin-qr');
  });

  test('attachReservationCheckinQr adds html and attachment', async () => {
    const mail = await attachReservationCheckinQr(
      { to: 'a@b.com', subject: 't', text: 'hello' },
      { reservationId: 12 },
    );
    expect(mail.text).toContain('R-000012');
    expect(mail.html).toContain('cid:eears-checkin-qr');
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].cid).toBe('eears-checkin-qr');
  });

  test('buildCheckinQrPreviewFromMail exposes data URL', async () => {
    const {
      buildCheckinQrPreviewFromMail,
    } = require('../services/reservationCheckinQrService');
    const mail = await attachReservationCheckinQr(
      { to: 'a@b.com', subject: 't', text: 'hello' },
      { reservationId: 7 },
    );
    const preview = buildCheckinQrPreviewFromMail(mail);
    expect(preview.bookingCode).toBe('R-000007');
    expect(preview.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(preview.htmlPreview).toContain(preview.dataUrl);
  });

  test('appendCheckinCodeToText is idempotent when code already present', () => {
    const once = appendCheckinCodeToText('body', 'R-000001');
    const twice = appendCheckinCodeToText(once, 'R-000001');
    expect(twice).toBe(once);
  });
});
