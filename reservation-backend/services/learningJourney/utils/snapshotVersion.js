'use strict';

const { RULE_VERSION, BUILD_VERSION } = require('../../../constants/learningJourneyEventConstants');
const pkg = require('../../../package.json');

function buildSnapshotVersion({ scope = 'global', cutoffAt = new Date(), sequence = 1 } = {}) {
  const cutoff = cutoffAt instanceof Date ? cutoffAt : new Date(cutoffAt);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const build = pkg.version || BUILD_VERSION;
  return `${scope}-${y}${m}${d}-v${sequence}|rules:${RULE_VERSION}|build:${build}`;
}

function parseSnapshotVersion(version) {
  const raw = String(version || '');
  const [prefix, rulesPart, buildPart] = raw.split('|');
  const rules = (rulesPart || '').replace(/^rules:/, '');
  const build = (buildPart || '').replace(/^build:/, '');
  return { prefix, ruleVersion: rules || null, buildVersion: build || null, raw };
}

module.exports = {
  buildSnapshotVersion,
  parseSnapshotVersion,
};
