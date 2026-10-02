'use strict';

const { diffPendingMigrations } = require('../services/opsScriptsService');

describe('diffPendingMigrations', () => {
  it('returns migration files that are not in SequelizeMeta', () => {
    const pending = diffPendingMigrations(
      [
        '20261001170000-create-speaking-diagnostic-tables.js',
        '20260924120000-create-english-test-mail-bins.js',
        'notes.txt',
      ],
      ['20261001170000-create-speaking-diagnostic-tables.js']
    );
    expect(pending).toEqual(['20260924120000-create-english-test-mail-bins.js']);
  });
});
