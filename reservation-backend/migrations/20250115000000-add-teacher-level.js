'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('teachers');

    // 添加 teacherLevel 欄位
    if (!tableDefinition.teacherLevel) {
      await queryInterface.addColumn('teachers', 'teacherLevel', {
        type: Sequelize.ENUM('executive', 'et_manager', 'if_manager', 'jt_manager', 'regular'),
        allowNull: true,
        defaultValue: 'regular',
        comment: '老師層級：executive=執行長, et_manager=English Table負責人, if_manager=International Forum負責人, jt_manager=Job Talk負責人, regular=一般老師'
      });
    }

    // 設定特定人員的層級
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 執行長：黃舒屏
      await queryInterface.sequelize.query(
        "UPDATE teachers SET teacherLevel = 'executive' WHERE name = '黃舒屏'",
        { transaction }
      );

      // English Table負責人：莊家雄
      await queryInterface.sequelize.query(
        "UPDATE teachers SET teacherLevel = 'et_manager' WHERE name = '莊家雄'",
        { transaction }
      );

      // International Forum負責人：戴藤懋
      await queryInterface.sequelize.query(
        "UPDATE teachers SET teacherLevel = 'if_manager' WHERE name = '戴藤懋'",
        { transaction }
      );

      // Job Talk負責人：傅安德
      await queryInterface.sequelize.query(
        "UPDATE teachers SET teacherLevel = 'jt_manager' WHERE name = '傅安德'",
        { transaction }
      );

      // 其餘老師預設為 regular（已在欄位定義中設定）。舊版空資料庫在此 migration
      // 執行時尚未有 role 欄位，因此需保留向前相容。
      const regularTeacherWhere = tableDefinition.role
        ? "teacherLevel IS NULL AND role = 'teacher'"
        : 'teacherLevel IS NULL';
      await queryInterface.sequelize.query(
        `UPDATE teachers SET teacherLevel = 'regular' WHERE ${regularTeacherWhere}`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const tableDefinition = await queryInterface.describeTable('teachers');

    if (tableDefinition.teacherLevel) {
      await queryInterface.removeColumn('teachers', 'teacherLevel');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teachers_teacherLevel";');
    }
  }
};
