const {
  buildEnvelope,
  parseResult,
  isAccepted,
  authStu,
  getStuAttr,
} = require('../services/nsysuSsoClient');

describe('nsysuSsoClient', () => {
  it('escapes the password inside the SOAP body', () => {
    const xml = buildEnvelope('authStu', ['B123456789', 'a&b<c>', 'ENC', '1;2']);
    expect(xml).toContain('a&amp;b&lt;c&gt;');
    expect(xml).not.toContain('a&b<c>');
    expect(xml).toContain('<urn:authStu');
  });

  it('reads the Result element', () => {
    const xml = '<ns1:authStuResponse><Result xsi:type="xsd:string">0</Result></ns1:authStuResponse>';
    expect(parseResult(xml)).toBe('0');
    expect(isAccepted('0')).toBe(false);
    expect(isAccepted('1')).toBe(true);
  });

  it('treats authStu 0 as a failed login and splits student attributes', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<Result xsi:type="xsd:string">0</Result>',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<Result>B123456789;王小明;ming@gmail.com;1</Result>',
      });

    await expect(authStu({
      stuid: 'B123456789',
      password: 'secret',
    }, { fetch: fetchImpl, endpoint: 'https://sso.example/ws' })).resolves.toBe(false);

    await expect(getStuAttr({
      stuid: 'B123456789',
      password: 'secret',
    }, { fetch: fetchImpl, endpoint: 'https://sso.example/ws' })).resolves.toEqual({
      STUID: 'B123456789',
      CNAME: '王小明',
      EMAIL: 'ming@gmail.com',
      STAT_COD: '1',
    });

    const body = fetchImpl.mock.calls[0][1].body;
    expect(body).toContain('<param2 xsi:type="xsd:string">secret</param2>');
    expect(fetchImpl.mock.calls[0][1].headers.SOAPAction).toBe('urn:xmethods-delayed-demo#authStu');
  });
});