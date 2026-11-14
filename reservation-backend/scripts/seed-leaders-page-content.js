#!/usr/bin/env node
/**
 * 初始化 LEADERS 頁面的輪播圖片和文案
 * 
 * 用法：
 *   node scripts/seed-leaders-page-content.js
 */
'use strict';

const { SiteContentEntry } = require('../models');

// 預設輪播圖片（來自原本 LeadersTeamPage.jsx 的 LEADER_SLIDES）
const DEFAULT_CAROUSEL_SLIDES = [
  {
    imageUrl: '/images/leaders/nice-to-meet-you.jpg',
    altZh: 'English Table LEADERS 與師長合影，螢幕上寫著 Nice to Meet You',
    altEn: 'English Table LEADERS and teachers in front of a Nice to Meet You screen',
    label: '合影 - Nice to Meet You',
  },
  {
    imageUrl: '/images/leaders/group-hall.jpg',
    altZh: 'English Table LEADERS 在階梯教室合影',
    altEn: 'English Table LEADERS gathered in a tiered classroom',
    label: '階梯教室合影',
  },
  {
    imageUrl: '/images/leaders/writing-awards.jpg',
    altZh: '英文寫作比賽頒獎合影',
    altEn: 'Group photo at an English writing contest award ceremony',
    label: '寫作比賽頒獎',
  },
];

// 預設文案（來自原本 translations.js 的 leadersTeam 區塊）
const DEFAULT_TEXT_CONTENT = [
  {
    contentKey: 'leadersTeam.pageTitle',
    label: '頁面標題',
    valueZh: 'LEADERS 團隊',
    valueEn: 'LEADERS',
  },
  {
    contentKey: 'leadersTeam.pageLead',
    label: '頁面導言',
    valueZh: '來自不同系所與國家的學生，鼓勵同學用英語表達、分享觀點，並進行文化交流。',
    valueEn: 'Students from different departments and countries who encourage classmates to speak, share ideas, and exchange cultures in English.',
  },
  {
    contentKey: 'leadersTeam.introTitle',
    label: '介紹區塊標題',
    valueZh: '關於 LEADERS',
    valueEn: 'About the LEADERS',
  },
  {
    contentKey: 'leadersTeam.intro',
    label: '介紹區塊內容',
    valueZh: '中山大學 English Table LEADERS 團隊由一群優秀、充滿熱情的學生組成。他們來自不同系所與國家，具備卓越的溝通能力，致力於鼓勵同學用英語表達、分享自己的觀點，並與不同背景的人進行文化交流。',
    valueEn: 'NSYSU English Table LEADERS are enthusiastic students from different departments and countries. They communicate with confidence, and they encourage classmates to express themselves in English, share their views, and exchange cultures with people from different backgrounds.',
  },
  {
    contentKey: 'leadersTeam.listTitle',
    label: '列表標題',
    valueZh: '本學期 LEADERS',
    valueEn: "This semester's LEADERS",
  },
];

async function seedCarousel() {
  console.log('\n=== 輪播圖片 ===\n');

  const existing = await SiteContentEntry.findAll({
    where: { entryType: 'leaders_carousel' },
  });

  if (existing.length > 0) {
    console.log(`已有 ${existing.length} 張輪播圖片，略過。`);
    return 0;
  }

  let created = 0;
  for (let i = 0; i < DEFAULT_CAROUSEL_SLIDES.length; i++) {
    const slide = DEFAULT_CAROUSEL_SLIDES[i];
    await SiteContentEntry.create({
      entryType: 'leaders_carousel',
      section: 'leaders_carousel',
      contentKey: null,
      label: slide.label,
      valueZh: slide.imageUrl,
      valueEn: null,
      bodyZh: slide.altZh,
      bodyEn: slide.altEn,
      sortOrder: i,
      isActive: true,
    });
    console.log(`  建立：${slide.label}`);
    created++;
  }

  return created;
}

async function seedText() {
  console.log('\n=== 頁面文案 ===\n');

  let created = 0;
  let skipped = 0;

  for (const item of DEFAULT_TEXT_CONTENT) {
    const existing = await SiteContentEntry.findOne({
      where: { contentKey: item.contentKey },
    });

    if (existing) {
      console.log(`  略過：${item.label}（已存在）`);
      skipped++;
      continue;
    }

    await SiteContentEntry.create({
      entryType: 'text',
      section: 'leaders_team',
      contentKey: item.contentKey,
      label: item.label,
      valueZh: item.valueZh,
      valueEn: item.valueEn,
      bodyZh: null,
      bodyEn: null,
      sortOrder: 0,
      isActive: true,
    });
    console.log(`  建立：${item.label}`);
    created++;
  }

  return { created, skipped };
}

async function main() {
  console.log('初始化 LEADERS 頁面內容...');

  const carouselCreated = await seedCarousel();
  const textResult = await seedText();

  console.log('\n=== 完成 ===');
  console.log(`輪播圖片：建立 ${carouselCreated} 張`);
  console.log(`頁面文案：建立 ${textResult.created} 筆，略過 ${textResult.skipped} 筆`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('初始化失敗：', err);
    process.exit(1);
  });
