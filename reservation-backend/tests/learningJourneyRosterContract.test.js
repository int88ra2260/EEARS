'use strict';

const fs = require('fs');
const path = require('path');
const learningJourneyRouter = require('../routes/learningJourneyRouter');

const ROSTER_DRY_RUN = '/admin/academic-course-roster/dry-run';
const ROSTER_APPLY = '/admin/academic-course-roster/apply';
const MOUNT_PREFIX = '/api/admin/learning-journey';

function routerPosts(router) {
  return router.stack
    .filter((layer) => layer.route && layer.route.methods && layer.route.methods.post)
    .map((layer) => layer.route.path);
}

function learningJourneyMounts(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const mounts = [];
  const pattern = /app\.use\(\s*(['"])([^'"]+)\1\s*,\s*learningJourneyRouter\s*\)/g;
  let match = pattern.exec(withoutComments);
  while (match) {
    mounts.push(match[2]);
    match = pattern.exec(withoutComments);
  }
  return mounts;
}

describe('legacy learning journey roster contract', () => {
  it('T5-P2 keeps the roster routes on the mounted router', () => {
    const posts = routerPosts(learningJourneyRouter);
    expect(posts).toEqual(expect.arrayContaining([ROSTER_DRY_RUN, ROSTER_APPLY]));
  });

  it('T5-P3 keeps the admin mount prefix used by the client', () => {
    const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    const mounts = learningJourneyMounts(source);
    expect(mounts).toContain(MOUNT_PREFIX);
    expect(`${MOUNT_PREFIX}${ROSTER_DRY_RUN}`).toBe(
      '/api/admin/learning-journey/admin/academic-course-roster/dry-run'
    );
    expect(`${MOUNT_PREFIX}${ROSTER_APPLY}`).toBe(
      '/api/admin/learning-journey/admin/academic-course-roster/apply'
    );
  });

  it('T5-N1 fails if only the v3 alias remains', () => {
    const onlyV3 = "app.use('/api/v3/learning-journey', learningJourneyRouter);";
    expect(learningJourneyMounts(onlyV3)).not.toContain(MOUNT_PREFIX);
  });

  it('T5-F1 ignores unrelated server.js text', () => {
    const source = [
      '// app.use(\'/api/admin/learning-journey\', learningJourneyRouter);',
      'app.use("/api/admin/learning-journey", learningJourneyRouter);',
      'const note = "learningJourneyRouter stays mounted";',
    ].join('\n');
    expect(learningJourneyMounts(source)).toEqual([MOUNT_PREFIX]);
  });
});
