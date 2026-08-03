const siteContentService = require('../services/siteContentService');
const auditLogService = require('../services/auditLogService');

function actorId(req) {
  return req.user?.id ?? null;
}

async function listSections(req, res, next) {
  try {
    const sections = await siteContentService.listAdminSections();
    return res.json({ sections });
  } catch (err) {
    return next(err);
  }
}

async function listBySection(req, res, next) {
  try {
    const data = await siteContentService.listAdmin({ section: req.params.section });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function upsertText(req, res, next) {
  try {
    const section = req.params.section;
    const before = req.body.contentKey
      ? await siteContentService.listAdmin({ section }).then((d) =>
          (d.items || []).find((i) => i.contentKey === req.body.contentKey)
        )
      : null;

    const row = await siteContentService.upsertTextEntry(section, req.body, actorId(req));

    auditLogService.logAuditAsync({
      module: 'site_content',
      action: before ? 'text_update' : 'text_create',
      entityType: 'SiteContentEntry',
      entityId: row.id,
      targetSummary: `文案 ${row.contentKey}`,
      beforeData: before || null,
      afterData: row,
      changedFields: auditLogService.diffShallow(before || {}, row),
      req,
    });

    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

async function createFaq(req, res, next) {
  try {
    const row = await siteContentService.createFaqEntry(req.body, actorId(req));

    auditLogService.logAuditAsync({
      module: 'site_content',
      action: 'faq_create',
      entityType: 'SiteContentEntry',
      entityId: row.id,
      targetSummary: `FAQ #${row.id}`,
      afterData: row,
      req,
    });

    return res.status(201).json(row);
  } catch (err) {
    return next(err);
  }
}

async function updateFaq(req, res, next) {
  try {
    const beforeList = await siteContentService.listAdmin({ section: 'faq' });
    const before = (beforeList.faq || []).find((f) => String(f.id) === String(req.params.id));

    const row = await siteContentService.updateFaqEntry(req.params.id, req.body, actorId(req));

    auditLogService.logAuditAsync({
      module: 'site_content',
      action: 'faq_update',
      entityType: 'SiteContentEntry',
      entityId: row.id,
      targetSummary: `FAQ #${row.id}`,
      beforeData: before || null,
      afterData: row,
      changedFields: auditLogService.diffShallow(before || {}, row),
      req,
    });

    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const removed = await siteContentService.deleteEntry(req.params.id);

    auditLogService.logAuditAsync({
      module: 'site_content',
      action:
        removed.entryType === 'faq'
          ? 'faq_delete'
          : removed.entryType === 'staff'
            ? 'staff_delete'
            : 'text_delete',
      entityType: 'SiteContentEntry',
      entityId: removed.id,
      targetSummary: removed.contentKey || `FAQ #${removed.id}`,
      beforeData: removed,
      req,
    });

    return res.json({ success: true, id: removed.id });
  } catch (err) {
    return next(err);
  }
}

async function reorderFaq(req, res, next) {
  try {
    const data = await siteContentService.reorderFaq(req.body.ids, actorId(req));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function seedFaq(req, res, next) {
  try {
    const result = await siteContentService.seedFaqFromDefaults(req.body.items, actorId(req), {
      overwrite: !!req.body.overwrite,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function seedText(req, res, next) {
  try {
    const section = req.params.section;
    const result = await siteContentService.seedTextFromDefaults(
      section,
      req.body.items,
      actorId(req),
      { overwrite: !!req.body.overwrite }
    );

    auditLogService.logAuditAsync({
      module: 'site_content',
      action: req.body.overwrite ? 'text_seed_overwrite' : 'text_seed',
      entityType: 'SiteContentEntry',
      entityId: null,
      targetSummary: `文案區塊 ${section}`,
      afterData: result,
      req,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const row = await siteContentService.createStaffEntry(req.params.section, req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'site_content',
      action: 'staff_create',
      entityType: 'SiteContentEntry',
      entityId: row.id,
      targetSummary: row.contentKey,
      afterData: row,
      req,
    });
    return res.status(201).json(row);
  } catch (err) {
    return next(err);
  }
}

async function updateStaff(req, res, next) {
  try {
    const row = await siteContentService.updateStaffEntry(req.params.id, req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'site_content',
      action: 'staff_update',
      entityType: 'SiteContentEntry',
      entityId: row.id,
      targetSummary: row.contentKey,
      afterData: row,
      req,
    });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

async function reorderStaff(req, res, next) {
  try {
    const data = await siteContentService.reorderStaff(req.params.section, req.body.ids, actorId(req));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function seedStaff(req, res, next) {
  try {
    const result = await siteContentService.seedStaffFromDefaults(
      req.params.section,
      req.body.items,
      actorId(req),
      { overwrite: !!req.body.overwrite }
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listSections,
  listBySection,
  upsertText,
  createFaq,
  updateFaq,
  remove,
  reorderFaq,
  seedFaq,
  seedText,
  createStaff,
  updateStaff,
  reorderStaff,
  seedStaff,
};
