const { Op } = require('sequelize');
const { SiteContentEntry } = require('../models');
const {
  SITE_CONTENT_SECTIONS,
  VALID_SECTIONS,
  STRUCTURED_SECTIONS,
  isStaffSection,
  staffGroupFromSection,
  isValidSection,
  isAllowedTextKey,
  isDeprecatedSection,
  isValidStaffSlug,
} = require('../constants/siteContentManifest');

const ENTRY_TEXT = 'text';
const ENTRY_FAQ = 'faq';
const ENTRY_STAFF = 'staff';

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function serializeTextEntry(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    entryType: plain.entryType,
    section: plain.section,
    contentKey: plain.contentKey,
    label: plain.label,
    valueZh: plain.valueZh,
    valueEn: plain.valueEn,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeStaffEntry(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const slug = plain.contentKey ? String(plain.contentKey).split('.').pop() : String(plain.id);
  return {
    id: plain.id,
    entryType: plain.entryType,
    section: plain.section,
    slug,
    contentKey: plain.contentKey,
    label: plain.label,
    name: { zh: plain.valueZh, en: plain.valueEn },
    role: { zh: plain.bodyZh, en: plain.bodyEn },
    email: plain.email || null,
    extension: plain.extension || null,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function serializeFaqEntry(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    entryType: plain.entryType,
    section: 'faq',
    label: plain.label,
    question: { zh: plain.valueZh, en: plain.valueEn },
    answer: { zh: plain.bodyZh, en: plain.bodyEn },
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    updatedAt: plain.updatedAt,
  };
}

function validateTextPayload(section, body) {
  const errors = [];
  const contentKey = trimOrNull(body.contentKey);
  const valueZh = trimOrNull(body.valueZh);
  const valueEn = trimOrNull(body.valueEn);
  const allowsExactOnStructured = Boolean(
    contentKey && SITE_CONTENT_SECTIONS[section]?.exactKeys?.includes(contentKey)
  );

  if (!isValidSection(section) || (STRUCTURED_SECTIONS.includes(section) && !allowsExactOnStructured)) {
    errors.push('無效的 section');
  }
  if (!contentKey) {
    errors.push('contentKey 必填');
  } else if (!isAllowedTextKey(section, contentKey)) {
    errors.push('contentKey 不在允許清單內');
  }
  if (!valueZh && !valueEn) {
    errors.push('至少需填寫中文或英文內容');
  }
  return { errors, contentKey, valueZh, valueEn };
}

function validateFaqPayload(body, { isCreate }) {
  const errors = [];
  const valueZh = trimOrNull(body.valueZh ?? body.questionZh);
  const valueEn = trimOrNull(body.valueEn ?? body.questionEn);
  const bodyZh = trimOrNull(body.bodyZh ?? body.answerZh);
  const bodyEn = trimOrNull(body.bodyEn ?? body.answerEn);
  const label = trimOrNull(body.label) || valueZh || 'FAQ';

  if (!valueZh && !valueEn) {
    errors.push('問題至少需填寫中文或英文');
  }
  if (!bodyZh && !bodyEn) {
    errors.push('答案至少需填寫中文或英文');
  }
  if (!isCreate && body.sortOrder !== undefined && !Number.isFinite(Number(body.sortOrder))) {
    errors.push('sortOrder 必須為數字');
  }

  return { errors, label, valueZh, valueEn, bodyZh, bodyEn };
}

function validateStaffPayload(body, section, { isCreate }) {
  const errors = [];
  const slug = trimOrNull(body.slug);
  const valueZh = trimOrNull(body.valueZh ?? body.nameZh);
  const valueEn = trimOrNull(body.valueEn ?? body.nameEn);
  const bodyZh = trimOrNull(body.bodyZh ?? body.roleZh);
  const bodyEn = trimOrNull(body.bodyEn ?? body.roleEn);
  const email = trimOrNull(body.email);
  const extension = trimOrNull(body.extension);
  const label = trimOrNull(body.label) || valueZh || slug || '成員';

  if (!isStaffSection(section)) {
    errors.push('無效的師資 section');
  }
  if (isCreate && !slug) {
    errors.push('slug 必填（英文小寫與連字號，例如 huang-shuping）');
  } else if (slug && !isValidStaffSlug(slug)) {
    errors.push('slug 格式不正確');
  }
  if (!valueZh && !valueEn) {
    errors.push('姓名至少需填寫中文或英文');
  }
  if (!bodyZh && !bodyEn) {
    errors.push('職稱至少需填寫中文或英文');
  }

  return { errors, slug, label, valueZh, valueEn, bodyZh, bodyEn, email, extension };
}

async function getPublicBundle() {
  const rows = await SiteContentEntry.findAll({
    where: { isActive: true },
    order: [
      ['entryType', 'ASC'],
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const textOverrides = {};
  const faq = [];
  const staff = { faculty: [], admin: [] };

  rows.forEach((row) => {
    if (row.entryType === ENTRY_FAQ) {
      faq.push(serializeFaqEntry(row));
      return;
    }
    if (row.entryType === ENTRY_STAFF) {
      const serialized = serializeStaffEntry(row);
      if (row.section === 'staff_admin') {
        staff.admin.push(serialized);
      } else {
        staff.faculty.push(serialized);
      }
      return;
    }
    if (row.entryType === ENTRY_TEXT && row.contentKey) {
      textOverrides[row.contentKey] = {
        zh: row.valueZh,
        en: row.valueEn,
      };
    }
  });

  return {
    textOverrides,
    faq,
    staff,
    updatedAt: rows.length
      ? rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), rows[0].updatedAt)
      : null,
  };
}

async function listAdmin({ section }) {
  if (section === 'faq') {
    const rows = await SiteContentEntry.findAll({
      where: { entryType: ENTRY_FAQ },
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    const pageTitleRow = await SiteContentEntry.findOne({
      where: { entryType: ENTRY_TEXT, contentKey: 'faq.title' },
    });
    return {
      section,
      sectionLabel: SITE_CONTENT_SECTIONS.faq.label,
      faq: rows.map(serializeFaqEntry),
      pageTitle: pageTitleRow ? serializeTextEntry(pageTitleRow) : null,
      allowedExactKeys: SITE_CONTENT_SECTIONS.faq.exactKeys || [],
    };
  }

  if (isStaffSection(section)) {
    const rows = await SiteContentEntry.findAll({
      where: { entryType: ENTRY_STAFF, section },
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return {
      section,
      sectionLabel: SITE_CONTENT_SECTIONS[section].label,
      staff: rows.map(serializeStaffEntry),
    };
  }

  if (!isValidSection(section) || STRUCTURED_SECTIONS.includes(section)) {
    const err = new Error('無效的 section');
    err.status = 400;
    throw err;
  }

  const rows = await SiteContentEntry.findAll({
    where: { entryType: ENTRY_TEXT, section },
    order: [['contentKey', 'ASC']],
  });

  return {
    section,
    sectionLabel: SITE_CONTENT_SECTIONS[section].label,
    items: rows.map(serializeTextEntry),
    allowedPrefixes: SITE_CONTENT_SECTIONS[section].prefixes,
  };
}

async function listAdminSections() {
  return VALID_SECTIONS.filter((id) => !isDeprecatedSection(id)).map((id) => ({
    id,
    label: SITE_CONTENT_SECTIONS[id].label,
  }));
}

async function upsertTextEntry(section, body, userId) {
  const { errors, contentKey, valueZh, valueEn } = validateTextPayload(section, body);
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const label = trimOrNull(body.label) || contentKey;
  const payload = {
    entryType: ENTRY_TEXT,
    section,
    contentKey,
    label,
    valueZh,
    valueEn,
    bodyZh: null,
    bodyEn: null,
    isActive: body.isActive !== undefined ? !!body.isActive : true,
    updatedBy: userId || null,
  };

  const existing = await SiteContentEntry.findOne({ where: { contentKey } });
  if (existing) {
    await existing.update(payload);
    return serializeTextEntry(existing);
  }

  const created = await SiteContentEntry.create(payload);
  return serializeTextEntry(created);
}

async function createFaqEntry(body, userId) {
  const { errors, label, valueZh, valueEn, bodyZh, bodyEn } = validateFaqPayload(body, { isCreate: true });
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const maxSort = await SiteContentEntry.max('sortOrder', {
    where: { entryType: ENTRY_FAQ },
  });
  const sortOrder = Number.isFinite(maxSort) ? maxSort + 1 : 0;

  const created = await SiteContentEntry.create({
    entryType: ENTRY_FAQ,
    section: 'faq',
    contentKey: null,
    label,
    valueZh,
    valueEn,
    bodyZh,
    bodyEn,
    sortOrder,
    isActive: body.isActive !== undefined ? !!body.isActive : true,
    updatedBy: userId || null,
  });

  return serializeFaqEntry(created);
}

async function updateFaqEntry(id, body, userId) {
  const row = await SiteContentEntry.findOne({
    where: { id, entryType: ENTRY_FAQ },
  });
  if (!row) {
    const err = new Error('找不到 FAQ 項目');
    err.status = 404;
    throw err;
  }

  const { errors, label, valueZh, valueEn, bodyZh, bodyEn } = validateFaqPayload(body, { isCreate: false });
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const patch = {
    label: body.label !== undefined ? label : row.label,
    updatedBy: userId || null,
  };
  if (body.valueZh !== undefined || body.questionZh !== undefined) patch.valueZh = valueZh;
  if (body.valueEn !== undefined || body.questionEn !== undefined) patch.valueEn = valueEn;
  if (body.bodyZh !== undefined || body.answerZh !== undefined) patch.bodyZh = bodyZh;
  if (body.bodyEn !== undefined || body.answerEn !== undefined) patch.bodyEn = bodyEn;
  if (body.isActive !== undefined) patch.isActive = !!body.isActive;
  if (body.sortOrder !== undefined) patch.sortOrder = parseInt(body.sortOrder, 10) || 0;

  await row.update(patch);
  return serializeFaqEntry(row);
}

async function deleteEntry(id, { entryType } = {}) {
  const where = { id };
  if (entryType) where.entryType = entryType;

  const row = await SiteContentEntry.findOne({ where });
  if (!row) {
    const err = new Error('找不到文案項目');
    err.status = 404;
    throw err;
  }

  await row.destroy();
  return { id: row.id, entryType: row.entryType, contentKey: row.contentKey };
}

async function reorderFaq(ids, userId) {
  if (!Array.isArray(ids) || ids.length === 0) {
    const err = new Error('ids 必填');
    err.status = 400;
    throw err;
  }

  const rows = await SiteContentEntry.findAll({
    where: { entryType: ENTRY_FAQ, id: { [Op.in]: ids.map((x) => parseInt(x, 10)) } },
  });

  if (rows.length !== ids.length) {
    const err = new Error('部分 FAQ 項目不存在');
    err.status = 400;
    throw err;
  }

  await Promise.all(
    ids.map((id, index) =>
      SiteContentEntry.update(
        { sortOrder: index, updatedBy: userId || null },
        { where: { id: parseInt(id, 10), entryType: ENTRY_FAQ } }
      )
    )
  );

  return listAdmin({ section: 'faq' });
}

function mapFaqSeedRow(item, index, userId) {
  return {
    entryType: ENTRY_FAQ,
    section: 'faq',
    contentKey: null,
    label: item.label || item.questionZh || `FAQ ${index + 1}`,
    valueZh: item.questionZh || null,
    valueEn: item.questionEn || null,
    bodyZh: item.answerZh || null,
    bodyEn: item.answerEn || null,
    sortOrder: index,
    isActive: true,
    updatedBy: userId || null,
  };
}

async function seedFaqFromDefaults(items, userId, { overwrite = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { seeded: 0, updated: 0, skipped: 0, total: 0 };
  }

  if (overwrite) {
    await SiteContentEntry.destroy({ where: { entryType: ENTRY_FAQ } });
    await SiteContentEntry.bulkCreate(items.map((item, index) => mapFaqSeedRow(item, index, userId)));
    return { seeded: items.length, updated: 0, skipped: 0, total: items.length };
  }

  const existing = await SiteContentEntry.findAll({
    where: { entryType: ENTRY_FAQ },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  if (existing.length === 0) {
    await SiteContentEntry.bulkCreate(items.map((item, index) => mapFaqSeedRow(item, index, userId)));
    return { seeded: items.length, updated: 0, skipped: 0, total: items.length };
  }

  let seeded = 0;
  const skipped = existing.length;
  for (let index = existing.length; index < items.length; index += 1) {
    await SiteContentEntry.create(mapFaqSeedRow(items[index], index, userId));
    seeded += 1;
  }

  return { seeded, updated: 0, skipped, total: items.length };
}

async function seedTextFromDefaults(section, items, userId, { overwrite = false } = {}) {
  if (!isValidSection(section) || STRUCTURED_SECTIONS.includes(section)) {
    const err = new Error('無效的 section');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { seeded: 0, updated: 0, skipped: 0, total: 0 };
  }

  let seeded = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const contentKey = trimOrNull(item.contentKey);
    if (!contentKey || !isAllowedTextKey(section, contentKey)) {
      skipped += 1;
      continue;
    }

    const valueZh = trimOrNull(item.valueZh);
    const valueEn = trimOrNull(item.valueEn);
    if (!valueZh && !valueEn) {
      skipped += 1;
      continue;
    }

    const existing = await SiteContentEntry.findOne({
      where: { entryType: ENTRY_TEXT, contentKey },
    });
    const payload = {
      entryType: ENTRY_TEXT,
      section,
      contentKey,
      label: trimOrNull(item.label) || contentKey,
      valueZh,
      valueEn,
      isActive: true,
      updatedBy: userId || null,
    };

    if (!existing) {
      await SiteContentEntry.create(payload);
      seeded += 1;
    } else if (overwrite) {
      await existing.update(payload);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { seeded, updated, skipped, total: items.length };
}

function staffContentKey(section, slug) {
  const group = staffGroupFromSection(section);
  return `staff.${group}.${slug}`;
}

async function createStaffEntry(section, body, userId) {
  const { errors, slug, label, valueZh, valueEn, bodyZh, bodyEn, email, extension } = validateStaffPayload(
    body,
    section,
    { isCreate: true }
  );
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const contentKey = staffContentKey(section, slug);
  const existing = await SiteContentEntry.findOne({ where: { contentKey } });
  if (existing) {
    const err = new Error('slug 已存在');
    err.status = 409;
    throw err;
  }

  const maxSort = await SiteContentEntry.max('sortOrder', {
    where: { entryType: ENTRY_STAFF, section },
  });
  const sortOrder = Number.isFinite(maxSort) ? maxSort + 1 : 0;

  const created = await SiteContentEntry.create({
    entryType: ENTRY_STAFF,
    section,
    contentKey,
    label,
    valueZh,
    valueEn,
    bodyZh,
    bodyEn,
    email,
    extension,
    sortOrder,
    isActive: body.isActive !== undefined ? !!body.isActive : true,
    updatedBy: userId || null,
  });

  return serializeStaffEntry(created);
}

async function updateStaffEntry(id, body, userId) {
  const row = await SiteContentEntry.findOne({
    where: { id, entryType: ENTRY_STAFF },
  });
  if (!row) {
    const err = new Error('找不到成員');
    err.status = 404;
    throw err;
  }

  const { errors, label, valueZh, valueEn, bodyZh, bodyEn, email, extension } = validateStaffPayload(
    body,
    row.section,
    { isCreate: false }
  );
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  const patch = {
    label: body.label !== undefined ? label : row.label,
    updatedBy: userId || null,
  };
  if (body.valueZh !== undefined || body.nameZh !== undefined) patch.valueZh = valueZh;
  if (body.valueEn !== undefined || body.nameEn !== undefined) patch.valueEn = valueEn;
  if (body.bodyZh !== undefined || body.roleZh !== undefined) patch.bodyZh = bodyZh;
  if (body.bodyEn !== undefined || body.roleEn !== undefined) patch.bodyEn = bodyEn;
  if (body.email !== undefined) patch.email = email;
  if (body.extension !== undefined) patch.extension = extension;
  if (body.isActive !== undefined) patch.isActive = !!body.isActive;
  if (body.sortOrder !== undefined) patch.sortOrder = parseInt(body.sortOrder, 10) || 0;

  await row.update(patch);
  return serializeStaffEntry(row);
}

async function reorderStaff(section, ids, userId) {
  if (!isStaffSection(section)) {
    const err = new Error('無效的 section');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    const err = new Error('ids 必填');
    err.status = 400;
    throw err;
  }

  const rows = await SiteContentEntry.findAll({
    where: {
      entryType: ENTRY_STAFF,
      section,
      id: { [Op.in]: ids.map((x) => parseInt(x, 10)) },
    },
  });

  if (rows.length !== ids.length) {
    const err = new Error('部分成員不存在');
    err.status = 400;
    throw err;
  }

  await Promise.all(
    ids.map((id, index) =>
      SiteContentEntry.update(
        { sortOrder: index, updatedBy: userId || null },
        { where: { id: parseInt(id, 10), entryType: ENTRY_STAFF, section } }
      )
    )
  );

  return listAdmin({ section });
}

function mapStaffSeedRow(section, item, index, userId) {
  const slug = trimOrNull(item.slug || item.id);
  return {
    entryType: ENTRY_STAFF,
    section,
    contentKey: staffContentKey(section, slug),
    label: item.label || item.nameZh || item.name?.zh || slug,
    valueZh: item.nameZh || item.name?.zh || null,
    valueEn: item.nameEn || item.name?.en || null,
    bodyZh: item.roleZh || item.role?.zh || null,
    bodyEn: item.roleEn || item.role?.en || null,
    email: trimOrNull(item.email),
    extension: trimOrNull(item.extension),
    sortOrder: index,
    isActive: true,
    updatedBy: userId || null,
  };
}

async function seedStaffFromDefaults(section, items, userId, { overwrite = false } = {}) {
  if (!isStaffSection(section)) {
    const err = new Error('無效的 section');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { seeded: 0, updated: 0, skipped: 0, total: 0 };
  }

  if (overwrite) {
    await SiteContentEntry.destroy({ where: { entryType: ENTRY_STAFF, section } });
    await SiteContentEntry.bulkCreate(items.map((item, index) => mapStaffSeedRow(section, item, index, userId)));
    return { seeded: items.length, updated: 0, skipped: 0, total: items.length };
  }

  const existing = await SiteContentEntry.findAll({
    where: { entryType: ENTRY_STAFF, section },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const existingKeys = new Set(existing.map((row) => row.contentKey));

  if (existing.length === 0) {
    await SiteContentEntry.bulkCreate(items.map((item, index) => mapStaffSeedRow(section, item, index, userId)));
    return { seeded: items.length, updated: 0, skipped: 0, total: items.length };
  }

  let seeded = 0;
  let skipped = 0;
  let sortOrder = existing.length;
  for (const item of items) {
    const slug = trimOrNull(item.slug || item.id);
    const contentKey = staffContentKey(section, slug);
    if (existingKeys.has(contentKey)) {
      skipped += 1;
      continue;
    }
    await SiteContentEntry.create(mapStaffSeedRow(section, item, sortOrder, userId));
    sortOrder += 1;
    seeded += 1;
  }

  return { seeded, updated: 0, skipped, total: items.length };
}

module.exports = {
  ENTRY_TEXT,
  ENTRY_FAQ,
  ENTRY_STAFF,
  getPublicBundle,
  listAdmin,
  listAdminSections,
  upsertTextEntry,
  createFaqEntry,
  updateFaqEntry,
  createStaffEntry,
  updateStaffEntry,
  deleteEntry,
  reorderFaq,
  reorderStaff,
  seedFaqFromDefaults,
  seedTextFromDefaults,
  seedStaffFromDefaults,
  serializeTextEntry,
  serializeFaqEntry,
  serializeStaffEntry,
};
