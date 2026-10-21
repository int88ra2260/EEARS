'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_accounts', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      studentId: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      passwordHash: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: '本地密碼。未來改由校園單一入口登入時可為空',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      ssoProvider: {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: '未來身分來源，例如 nsysu',
      },
      ssoSubject: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: '身分提供者的穩定 subject，不存學校密碼',
      },
      passwordChangedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('student_accounts', ['studentId'], {
      unique: true,
      name: 'student_accounts_student_id_unique',
    });
    await queryInterface.addIndex('student_accounts', ['email'], {
      unique: true,
      name: 'student_accounts_email_unique',
    });
    await queryInterface.addIndex('student_accounts', ['ssoProvider', 'ssoSubject'], {
      unique: true,
      name: 'student_accounts_sso_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_accounts');
  },
};
