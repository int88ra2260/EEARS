'use strict';

/**
 * 回歸：公開「檢視與修正」PUT 使用 multipart FormData。
 * multer 必須在 requireLookupMinimumFields 之前，否則 req.body 為空 → 400 Invalid query.
 */
describe('english-test public update middleware order', () => {
  test('multer runs before lookup field guards on PUT /registrations/update', () => {
    // eslint-disable-next-line global-require
    const router = require('../routes/englishTestRegistrationRouter');
    const layer = router.stack.find(
      (l) => l.route
        && l.route.path === '/english-test/registrations/update'
        && l.route.methods.put
    );
    expect(layer).toBeTruthy();

    const handlers = layer.route.stack.map((s) => s.handle);
    const multerIdx = handlers.findIndex((h) => {
      const src = Function.prototype.toString.call(h);
      return src.includes('multipart') || src.includes('Multer') || h.name === 'multerMiddleware';
    });
    const lookupIdx = handlers.findIndex((h) => {
      // requireLookupMinimumFields 回傳的閉包會檢查 studentId/name/email
      const src = Function.prototype.toString.call(h);
      return src.includes('Invalid query') && src.includes('studentId');
    });

    expect(multerIdx).toBeGreaterThanOrEqual(0);
    expect(lookupIdx).toBeGreaterThanOrEqual(0);
    expect(multerIdx).toBeLessThan(lookupIdx);
  });
});
