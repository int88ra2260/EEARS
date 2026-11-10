'use strict';

/** 公開介紹頁的初始名單。只含顯示名，不含學號、信箱或時薪。 */
const SEED = [
  ['udon', '謝宗叡 Udon'],
  ['audrey', '吳采嫣 Audrey'],
  ['angela', '蔡郁萱 Angela'],
  ['andrew', '吳昱熲 Andrew'],
  ['angelique', '葉安雅 Angelique'],
  ['sherina', '林美玲 Sherina'],
  ['nat', '席娜婷 Nat'],
  ['lance', '黃冠勛 Lance'],
  ['louise', '阮氏文莊 Louise'],
  ['alison', '鄧瓊安 Alison'],
  ['satyam', '司塔揚 Satyam'],
  ['ara', '艾若文 Ara'],
  ['portia', '黎阮紅明 Portia'],
  ['summer', '焦澄 Summer'],
  ['uswa', '巫珊娜 Uswa'],
  ['elvina', '林意甜 Elvina'],
  ['alexx', '古清越 Alexx'],
  ['michael', '阮珍元 Michael'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaderPublicProfiles', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      slug: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      displayName: { type: Sequelize.STRING(80), allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isPublished: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      photoUrl: { type: Sequelize.STRING(500), allowNull: true },
      degree: { type: Sequelize.STRING(120), allowNull: true },
      experience: { type: Sequelize.STRING(300), allowNull: true },
      languages: { type: Sequelize.STRING(120), allowNull: true },
      focus: { type: Sequelize.STRING(120), allowNull: true },
      videoId: { type: Sequelize.STRING(20), allowNull: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('LeaderPublicProfiles', ['isPublished', 'sortOrder'], {
      name: 'idx_leader_public_profiles_published_order',
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      'LeaderPublicProfiles',
      SEED.map(([slug, displayName], index) => ({
        slug,
        displayName,
        sortOrder: index,
        isPublished: true,
        photoUrl: null,
        degree: null,
        experience: null,
        languages: null,
        focus: null,
        videoId: null,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaderPublicProfiles');
  },
};
