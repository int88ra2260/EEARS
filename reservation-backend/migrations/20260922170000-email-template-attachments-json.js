'use strict';

/** 郵件模板覆寫：媒體庫附件清單（JSON） */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('email_template_overrides', 'attachmentsJson', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '媒體庫附件 [{ mediaId, url, filename, mime, label }]；null/[] = 無附件',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('email_template_overrides', 'attachmentsJson');
  },
};
