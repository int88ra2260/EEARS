'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../services/leaderPublicProfileService', () => ({
  listAdmin: jest.fn(async () => []),
  listPublic: jest.fn(async () => [{
    id: 'ada',
    name: '測試 Ada',
    photo: '',
    degree: '',
    experience: '',
    languages: '',
    focus: '',
    videoId: '',
  }]),
  createProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
  reorderProfiles: jest.fn(),
}));

jest.mock('../../middlewares/auth', () => {
  const actual = jest.requireActual('../../middlewares/auth');
  const { buildAccessProfile } = jest.requireActual('../../auth/accessProfile');
  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    req.user = {
      id: 1,
      role,
      staffLevel: req.headers['x-test-staff-level'] || null,
      teacherLevel: req.headers['x-test-teacher-level'] || null,
      workerLevel: req.headers['x-test-worker-level'] || null,
    };
    req.accessProfile = buildAccessProfile(req.user);
    return next();
  };
  return { ...actual, authMiddleware };
});

const publicLeaderTeamRouter = require('../../routes/publicLeaderTeamRouter');
const adminLeaderPublicProfileRouter = require('../../routes/adminLeaderPublicProfileRouter');

const app = express();
app.use(express.json());
app.use('/api/leaders-team', publicLeaderTeamRouter);
app.use('/api/admin/leader-public-profiles', adminLeaderPublicProfileRouter);

describe('leader public profile auth', () => {
  it('publishes the card list without a login', async () => {
    const res = await request(app).get('/api/leaders-team');
    expect(res.status).toBe(200);
    expect(res.body.leaders).toEqual([
      expect.objectContaining({ id: 'ada', name: '測試 Ada' }),
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/studentId|hourlyRate|email/);
  });

  it('hides the editor from anonymous users, leaders, and regular teachers', async () => {
    const anonymous = await request(app).get('/api/admin/leader-public-profiles');
    expect(anonymous.status).toBe(401);

    const leader = await request(app)
      .get('/api/admin/leader-public-profiles')
      .set('x-test-role', 'leader');
    expect(leader.status).toBe(403);

    const teacher = await request(app)
      .get('/api/admin/leader-public-profiles')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular');
    expect(teacher.status).toBe(403);
  });

  it('lets ET managers and content editors open the editor', async () => {
    const manager = await request(app)
      .get('/api/admin/leader-public-profiles')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'et_manager');
    expect(manager.status).toBe(200);
    expect(manager.body.leaders).toEqual([]);

    const editor = await request(app)
      .get('/api/admin/leader-public-profiles')
      .set('x-test-role', 'worker')
      .set('x-test-worker-level', 'content_editor');
    expect(editor.status).toBe(200);
  });
});
