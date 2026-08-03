'use strict';

const {
  EtTaskTemplate,
  EtTaskTemplateItem,
  sequelize,
} = require('../../models');
const { serializeTaskItem } = require('./etTaskScope');

async function resolveTemplate({ semesterId = null } = {}) {
  if (semesterId != null) {
    const semesterTemplate = await EtTaskTemplate.findOne({
      where: { semesterId, isActive: true },
      order: [['id', 'DESC']],
    });
    if (semesterTemplate) return semesterTemplate;
  }
  return EtTaskTemplate.findOne({
    where: { semesterId: null, isDefault: true, isActive: true },
    order: [['id', 'DESC']],
  });
}

async function listTaskTemplate({ semesterId = null } = {}) {
  const template = await resolveTemplate({ semesterId });
  if (!template) return { template: null, items: [] };

  const items = await EtTaskTemplateItem.findAll({
    where: { templateId: template.id },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });

  return {
    template: {
      id: template.id,
      semesterId: template.semesterId,
      name: template.name,
      isDefault: template.isDefault,
      isActive: template.isActive,
    },
    items: items.map(serializeTaskItem),
  };
}

async function upsertTaskTemplateItems(items = [], { semesterId = null } = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('請提供至少一筆任務項目');
  }

  const transaction = await sequelize.transaction();
  try {
    let template = await resolveTemplate({ semesterId });
    if (!template) {
      template = await EtTaskTemplate.create({
        semesterId,
        name: semesterId != null ? 'ET 學期任務模板' : 'ET 全域預設任務',
        isDefault: semesterId == null,
        isActive: true,
      }, { transaction });
    }

    for (const item of items) {
      const code = String(item.code || '').trim();
      if (!code) throw new Error('任務代碼不可為空');
      const payload = {
        templateId: template.id,
        code,
        label: String(item.label || code).trim(),
        description: item.description || null,
        bandScope: String(item.bandScope || 'ALL').trim().toUpperCase(),
        sortOrder: Number(item.sortOrder) || 0,
        isRequired: item.isRequired === true,
        isActive: item.isActive !== false,
      };

      const existing = await EtTaskTemplateItem.findOne({
        where: { templateId: template.id, code },
        transaction,
      });
      if (existing) {
        await existing.update(payload, { transaction });
      } else {
        await EtTaskTemplateItem.create(payload, { transaction });
      }
    }

    await transaction.commit();
    return listTaskTemplate({ semesterId });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  listTaskTemplate,
  upsertTaskTemplateItems,
  resolveTemplate,
};
