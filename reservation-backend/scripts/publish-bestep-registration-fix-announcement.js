/**
 * 一次性：彙整培力英檢報名近期修復，更新／建立公開公告並發布。
 * 用法：node scripts/publish-bestep-registration-fix-announcement.js
 */
require('dotenv').config();

const { sequelize, Announcement } = require('../models');
const announcementService = require('../services/announcementService');
const { ANNOUNCEMENT_STATUS } = require('../constants/announcementConstants');

/** 沿用 9/7 已分享連結，僅更新標題／內容 */
const SLUG = 'bestep-registration-fixes-2026-09-07';
const LEGACY_SLUG = 'bestep-registration-fixes-2026-09-07';

const TITLE = '【系統通知】培力英檢報名問題已修復（9/7–9/10）';

const SUMMARY =
  '培力英檢線上報名近日異常已修復並持續補強。請重新整理頁面後繼續報名；已成功提交者無須重填。';

const CONTENT = [
  '各位同學好：',
  '',
  '近日（2026/9/7–9/10）培力英檢線上報名系統曾出現部分異常，造成填寫、驗證信與上傳操作不便，造成困擾，敬請見諒。',
  '',
  '目前相關問題皆已修復，並已完成後續補強，報名流程可正常使用。請同學重新整理報名頁面後，再繼續完成報名。',
  '',
  '【請依下列情況處理】',
  '• 已成功提交報名：無須重填，可於「檢視與修正」確認資料。',
  '• 提交失敗、畫面卡住，或資料顯示異常：請重新進入報名流程完成填寫。',
  '• 收不到驗證碼／提示寄送過於頻繁：請稍候再試，並先檢查垃圾信件匣；勿短時間內重複連點「寄送驗證碼」。',
  '• 證件照上傳失敗：請確認檔案為 JPG／PNG，且大小符合頁面提示後再上傳。',
  '• 若頁面仍顯示舊畫面：請強制重新整理（Windows：Ctrl + F5；Mac：Cmd + Shift + R）後再試。',
  '',
  '【本次已修復項目】',
  '1. 報名表單題目順序與後台設定不一致',
  '2. 通訊地址等欄位顯示／預填異常',
  '3. 「是否有身心障礙手冊」等條件題未依選擇正確收合或展開',
  '4. 表單驗證與條件顯示（依作答顯示後續題目）不穩定',
  '5. Email 驗證碼寄送／輸入體驗與過度連點防護',
  '6. 證件照等檔案上傳失敗時的錯誤提示不清',
  '7. 成績證明／應考項目相關欄位驗證與顯示',
  '8. 豁免審查進度於學生端的狀態提示',
  '9. 其他近日回報的報名流程與學期時程判斷問題',
  '',
  '報名前請仍務必閱讀西灣學院官方公告，完整規定、獎勵與注意事項以官方網頁為準。',
  '',
  '如仍有問題，請洽全英語卓越教學中心 emicenter@mail.nsysu.edu.tw，或系統管理員。',
  '',
  '全英語卓越教學中心　敬啟',
].join('\n');

const TAGS = ['培力英檢', '報名', '系統修復'];

async function main() {
  const existingByNewSlug = await Announcement.findOne({ where: { slug: SLUG } });
  const legacy = await Announcement.findOne({ where: { slug: LEGACY_SLUG } });

  let target = existingByNewSlug || legacy;
  let result;

  const payload = {
    title: TITLE,
    slug: SLUG,
    summary: SUMMARY,
    content: CONTENT,
    category: 'system',
    tags: TAGS,
    isPinned: true,
    audienceType: 'all',
    seoTitle: TITLE,
    seoDescription: SUMMARY,
  };

  if (target) {
    const id = target.id;
    // 若沿用舊 slug 列，先改 slug／內容再確保已發布
    result = await announcementService.updateAnnouncement(id, payload, null);
    if (result.status !== ANNOUNCEMENT_STATUS.PUBLISHED || !result.isPublished) {
      result = await announcementService.publishAnnouncement(id, null);
    }
    console.log(
      JSON.stringify(
        {
          action: 'updated',
          id: result.id,
          slug: result.slug,
          status: result.status,
          isPublished: result.isPublished,
          isPinned: result.isPinned,
          title: result.title,
        },
        null,
        2
      )
    );
  } else {
    result = await announcementService.createAnnouncement(
      {
        ...payload,
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        isPublished: true,
        publishedAt: new Date(),
      },
      null
    );
    console.log(
      JSON.stringify(
        {
          action: 'created',
          id: result.id,
          slug: result.slug,
          status: result.status,
          isPublished: result.isPublished,
          isPinned: result.isPinned,
          title: result.title,
        },
        null,
        2
      )
    );
  }

  console.log(`\n前台連結：/announcements/${result.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
