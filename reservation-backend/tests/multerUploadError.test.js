const express = require('express');
const multer = require('multer');
const request = require('supertest');
const {
  isMultipartParseError,
  createMulterUploadErrorHandler,
} = require('../middlewares/multerUploadError');

describe('multerUploadError', () => {
  describe('isMultipartParseError', () => {
    it('detects Unexpected end of form', () => {
      expect(isMultipartParseError(new Error('Unexpected end of form'))).toBe(true);
    });

    it('detects missing boundary', () => {
      expect(isMultipartParseError(new Error('Multipart: Boundary not found'))).toBe(true);
    });

    it('ignores unrelated errors', () => {
      expect(isMultipartParseError(new Error('ENOENT'))).toBe(false);
    });
  });

  describe('createMulterUploadErrorHandler', () => {
    function buildApp() {
      const app = express();
      const upload = multer({ storage: multer.memoryStorage() });
      app.post('/upload', upload.single('file'), (req, res) => {
        res.json({ ok: true });
      });
      app.use(createMulterUploadErrorHandler());
      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });
      return app;
    }

    it('returns 400 MULTIPART_PARSE_FAILED for empty multipart body', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW')
        .set('Content-Length', '0')
        .send('');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MULTIPART_PARSE_FAILED');
      expect(res.body.error).toMatch(/不完整|格式錯誤/);
    });

    it('returns 400 for Multer LIMIT_FILE_SIZE', async () => {
      const app = express();
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 },
      });
      app.post('/upload', upload.single('file'), (req, res) => res.json({ ok: true }));
      app.use(createMulterUploadErrorHandler());

      const res = await request(app)
        .post('/upload')
        .attach('file', Buffer.alloc(64, 1), 'big.bin');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UPLOAD_FILE_TOO_LARGE');
    });
  });
});
