'use strict';

const {
  looksLikeHtml,
  sanitizeEmailHtml,
  htmlToPlainText,
  plainTextToEmailHtml,
} = require('../utils/emailTemplateHtml');
const { normalizeAttachmentsInput } = require('../services/emailTemplateAttachmentService');

describe('emailTemplateHtml', () => {
  test('looksLikeHtml detects tags', () => {
    expect(looksLikeHtml('<p>Hi</p>')).toBe(true);
    expect(looksLikeHtml('plain text')).toBe(false);
  });

  test('sanitizeEmailHtml keeps bold underline color', () => {
    const html = sanitizeEmailHtml(
      '<p>A <strong>B</strong> <u>C</u> <span style="color: #ff0000" onclick="x()">D</span></p><script>evil()</script>'
    );
    expect(html).toContain('<strong>B</strong>');
    expect(html).toContain('<u>C</u>');
    expect(html).toContain('color: #ff0000');
    expect(html).not.toContain('script');
    expect(html).not.toContain('onclick');
  });

  test('htmlToPlainText strips tags', () => {
    expect(htmlToPlainText('<p>Hello<br>World</p>')).toMatch(/Hello\nWorld/);
  });

  test('plainTextToEmailHtml converts newlines', () => {
    expect(plainTextToEmailHtml('a\n\nb')).toContain('<p>');
  });
});

describe('emailTemplateAttachmentService', () => {
  test('normalizeAttachmentsInput caps and filters', () => {
    const list = normalizeAttachmentsInput([
      { url: '/uploads/media/a.png', filename: 'a.png', mime: 'image/png' },
      { url: '../etc/passwd', filename: 'bad' },
      { url: '/uploads/media/b.png', label: 'b' },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0].url).toBe('/uploads/media/a.png');
  });
});
