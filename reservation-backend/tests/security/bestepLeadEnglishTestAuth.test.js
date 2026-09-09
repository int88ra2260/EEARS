'use strict';

const { buildAccessProfile } = require('../../auth/accessProfile');
const { englishTestDomainMiddleware } = require('../../middlewares/auth');

function runMiddleware(user) {
  const req = { user };
  req.accessProfile = buildAccessProfile(user);
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;
  englishTestDomainMiddleware(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res };
}

describe('englishTestDomainMiddleware', () => {
  it('allows office_staff bestep_lead', () => {
    const { nextCalled } = runMiddleware({ role: 'office_staff', staffLevel: 'bestep_lead' });
    expect(nextCalled).toBe(true);
  });

  it('allows office_staff deputy_manager', () => {
    const { nextCalled } = runMiddleware({ role: 'office_staff', staffLevel: 'deputy_manager' });
    expect(nextCalled).toBe(true);
  });

  it('allows worker bestep_ops', () => {
    const { nextCalled } = runMiddleware({ role: 'worker', workerLevel: 'bestep_ops' });
    expect(nextCalled).toBe(true);
  });

  it('denies worker event_ops', () => {
    const { nextCalled, res } = runMiddleware({ role: 'worker', workerLevel: 'event_ops' });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('denies office_staff event_lead even with english permissions in profile', () => {
    const { nextCalled, res } = runMiddleware({ role: 'office_staff', staffLevel: 'event_lead' });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('denies teacher regular', () => {
    const { nextCalled, res } = runMiddleware({ role: 'teacher', teacherLevel: 'regular' });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
