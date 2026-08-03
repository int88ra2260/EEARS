'use strict';

const { ImportRollbackManifest } = require('../models');

const MAX_CREATED_IDS = 10000;
const MAX_UPDATED_SNAPSHOTS = 5000;
const MAX_RESERVATION_ROLLBACKS = 10000;

function trimList(items, max, fieldName) {
  const list = Array.isArray(items) ? items : [];
  if (list.length > max) {
    const err = new Error(`${fieldName} 超過安全上限（${max}），無法建立可回滾紀錄`);
    err.status = 413;
    throw err;
  }
  return list;
}

function trimIdList(ids, max, fieldName) {
  const list = Array.isArray(ids) ? ids.filter((id) => id != null) : [];
  if (list.length > max) {
    const err = new Error(`${fieldName} 超過安全上限（${max}），無法建立可回滾紀錄`);
    err.status = 413;
    throw err;
  }
  return list;
}

function validateClassRosterManifest(manifest) {
  if (!manifest || manifest.kind !== 'class_roster') {
    const err = new Error('class_roster manifest 格式不正確');
    err.status = 400;
    throw err;
  }
  if (!manifest.classId || !manifest.semester) {
    const err = new Error('class_roster manifest 缺少 classId 或 semester');
    err.status = 400;
    throw err;
  }
  return {
    kind: 'class_roster',
    classId: Number(manifest.classId),
    semester: String(manifest.semester).trim(),
    className: manifest.className ? String(manifest.className).trim() : null,
    createdMembershipIds: trimIdList(manifest.createdMembershipIds, MAX_CREATED_IDS, 'createdMembershipIds'),
    updatedSnapshots: trimList(manifest.updatedSnapshots, MAX_UPDATED_SNAPSHOTS, 'updatedSnapshots'),
  };
}

function validateEventCardExcelManifest(manifest) {
  if (!manifest || manifest.kind !== 'event_card_excel') {
    const err = new Error('event_card_excel manifest 格式不正確');
    err.status = 400;
    throw err;
  }
  if (!manifest.eventId) {
    const err = new Error('event_card_excel manifest 缺少 eventId');
    err.status = 400;
    throw err;
  }
  return {
    kind: 'event_card_excel',
    eventId: Number(manifest.eventId),
    reservationRollbacks: trimList(
      manifest.reservationRollbacks,
      MAX_RESERVATION_ROLLBACKS,
      'reservationRollbacks',
    ),
  };
}

async function saveManifest({ importBatchId, sourceModule, kind, auditLogId = null, manifest }) {
  const batchId = String(importBatchId || '').trim();
  if (!batchId) {
    const err = new Error('importBatchId 不可為空');
    err.status = 400;
    throw err;
  }
  const normalized =
    kind === 'class_roster'
      ? validateClassRosterManifest(manifest)
      : kind === 'event_card_excel'
        ? validateEventCardExcelManifest(manifest)
        : null;
  if (!normalized) {
    const err = new Error(`不支援的 manifest kind：${kind}`);
    err.status = 400;
    throw err;
  }

  const [row] = await ImportRollbackManifest.upsert({
    importBatchId: batchId,
    sourceModule: String(sourceModule || '').trim() || 'unknown',
    kind,
    auditLogId: auditLogId == null ? null : Number(auditLogId),
    manifestJson: normalized,
  });
  return row;
}

async function findByBatchId(importBatchId) {
  const batchId = String(importBatchId || '').trim();
  if (!batchId) return null;
  return ImportRollbackManifest.findOne({ where: { importBatchId: batchId } });
}

async function deleteByBatchId(importBatchId, options = {}) {
  const batchId = String(importBatchId || '').trim();
  if (!batchId) return 0;
  return ImportRollbackManifest.destroy({ where: { importBatchId: batchId }, ...options });
}

module.exports = {
  MAX_CREATED_IDS,
  MAX_UPDATED_SNAPSHOTS,
  MAX_RESERVATION_ROLLBACKS,
  saveManifest,
  findByBatchId,
  deleteByBatchId,
  validateClassRosterManifest,
  validateEventCardExcelManifest,
};
