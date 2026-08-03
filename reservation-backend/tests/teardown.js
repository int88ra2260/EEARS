'use strict';

module.exports = async function globalTeardown() {
  try {
    const sequelize = require('../db');
    if (sequelize && typeof sequelize.close === 'function') {
      await sequelize.close();
    }
  } catch (_) {
    // Ignore teardown cleanup failures in test environment.
  }
};
