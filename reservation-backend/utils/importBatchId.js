'use strict';

function newImportBatchId(module, type) {
  const mod = String(module || 'import').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const kind = String(type || 'batch').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${mod}:${kind}:${ts}:${rand}`;
}

module.exports = {
  newImportBatchId,
};
