const {
  sanitizeAnnouncementHtml,
  isAnnouncementHtmlContent,
} = require('../utils/sanitizeAnnouncementHtml');

describe('sanitizeAnnouncementHtml', () => {
  it('strips script and event handlers', () => {
    const out = sanitizeAnnouncementHtml(
      '<p onclick="alert(1)">hello</p><script>alert(1)</script><img src="/x.png" onerror="alert(1)" alt="a">'
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('<p>');
    expect(out).toContain('src="/x.png"');
  });

  it('keeps safe formatting, links, tables', () => {
    const html =
      '<p style="color: #2a5d9f; font-family: \'Times New Roman\', Times, serif"><strong>A</strong></p>' +
      '<a href="https://example.com">link</a>' +
      '<table><tr><th>H</th></tr><tr><td>C</td></tr></table>';
    const out = sanitizeAnnouncementHtml(html);
    expect(out).toContain('strong');
    expect(out).toContain('https://example.com');
    expect(out).toContain('<table>');
    expect(out).toContain('font-family');
  });

  it('blocks javascript: urls', () => {
    const out = sanitizeAnnouncementHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });
});

describe('isAnnouncementHtmlContent', () => {
  it('detects html vs plain', () => {
    expect(isAnnouncementHtmlContent('<p>hi</p>')).toBe(true);
    expect(isAnnouncementHtmlContent('純文字公告\n第二行')).toBe(false);
  });
});
