'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../controllers/adminAnnouncementController', () => ({
  list: (req, res) => res.json({ ok: true, staffLevel: req.user?.staffLevel || null }),
  getById: (req, res) => res.json({ ok: true }),
  create: (req, res) => res.json({ ok: true }),
  update: (req, res) => res.json({ ok: true }),
  remove: (req, res) => res.json({ ok: true }),
  bulkAction: (req, res) => res.json({ ok: true }),
  getRevisions: (req, res) => res.json({ ok: true }),
  postRestoreRevision: (req, res) => res.json({ ok: true }),
  postPublish: (req, res) => res.json({ ok: true }),
  postUnpublish: (req, res) => res.json({ ok: true }),
  postArchive: (req, res) => res.json({ ok: true }),
  postDuplicate: (req, res) => res.json({ ok: true }),
  patchPublish: (req, res) => res.json({ ok: true }),
  patchPin: (req, res) => res.json({ ok: true }),
}));

jest.mock('../../middlewares/announcementGuards', () => ({
  adminAnnouncementLimiter: (req, res, next) => next(),
}));

jest.mock('../../middlewares/auth', () => {
  const actual = jest.requireActual('../../middlewares/auth');
  const { buildAccessProfile: mockBuildAccessProfile } = jest.requireActual('../../auth/accessProfile');
  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = {
      id: 1,
      role,
      staffLevel: req.headers['x-test-staff-level'] || null,
      teacherLevel: req.headers['x-test-teacher-level'] || null,
    };
    req.accessProfile = mockBuildAccessProfile(req.user);
    return next();
  };
  return { ...actual, authMiddleware };
});

const adminAnnouncementRouter = require('../../routes/adminAnnouncementRouter');

const app = express();
app.use(express.json());
app.use('/api/admin/announcements', adminAnnouncementRouter);

describe('office_staff announcement auth', () => {
  it('event_lead with can_manage_announcements can list announcements', async () => {
    const res = await request(app)
      .get('/api/admin/announcements')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.staffLevel).toBe('event_lead');
  });

  it('teacher regular without announcement permission is denied', async () => {
    const res = await request(app)
      .get('/api/admin/announcements')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular');

    expect(res.status).toBe(403);
  });
});
